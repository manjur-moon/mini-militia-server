import mongoose from "mongoose";
import { createPaginationMeta } from "@mini-militia/shared";
import { AuditLog } from "../models/audit-log.model.js";
import { MatchResult } from "../models/match-result.model.js";
import { Match } from "../models/match.model.js";
import { Notification } from "../models/notification.model.js";
import { Player } from "../models/player.model.js";
import { Season } from "../models/season.model.js";
import { authUserRepository } from "../repositories/auth-user.repository.js";
import { AppError } from "../utils/app-error.js";
import { analyticsService } from "./analytics.service.js";
import { hallOfFameService } from "./hall-of-fame.service.js";
import { mvpService } from "./mvp.service.js";

export const SEASON_FINALIZATION_VERSION = "season-finalization-v1";
const SCHEDULED_STATUSES = Object.freeze(["upcoming", "active", "completed"]);
const ALLOWED_TRANSITIONS = Object.freeze({
  draft: new Set(["upcoming", "active"]),
  upcoming: new Set(["draft", "active"]),
  active: new Set(["completed"]),
  completed: new Set(["archived"]),
  archived: new Set(),
});

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function requestAuditFields(requestMeta = {}) {
  return {
    ipAddress: requestMeta.ipAddress ?? null,
    userAgent: requestMeta.userAgent ?? null,
    requestId: requestMeta.requestId ?? null,
  };
}

function seasonNotFound() {
  return new AppError({
    statusCode: 404,
    code: "SEASON_NOT_FOUND",
    message: "Season was not found.",
  });
}

function serializePlayer(player) {
  if (!player) return null;
  return {
    id: String(player._id),
    playerId: player.playerId,
    name: player.name,
    photoUrl: player.profileImage?.secureUrl ?? null,
    status: player.status,
  };
}

function serializeAward(award) {
  if (!award) return null;
  return {
    id: String(award._id ?? award.id),
    playerId: String(award.playerId),
    score: award.score,
    formulaVersion: award.formulaVersion,
    awardedAt: award.awardedAt,
  };
}

function serializeSeason(season, relations = {}) {
  const value = season?.toObject?.() ?? season;
  if (!value) return null;
  return {
    id: String(value._id),
    name: value.name,
    slug: value.slug,
    description: value.description,
    startAt: value.startAt,
    endAt: value.endAt,
    timezone: value.timezone,
    status: value.status,
    championPlayerId: value.championPlayerId ? String(value.championPlayerId) : null,
    champion: relations.champion ?? null,
    mvpAwardId: value.mvpAwardId ? String(value.mvpAwardId) : null,
    mvpAward: relations.mvpAward ?? null,
    activatedAt: value.activatedAt ?? null,
    completedAt: value.completedAt ?? null,
    archivedAt: value.archivedAt ?? null,
    finalization: value.finalization ?? {
      status: "not_started",
      version: null,
      startedAt: null,
      completedAt: null,
      errorCode: null,
    },
    finalizedSnapshot: value.finalizedSnapshot ?? null,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function buildIdentifierFilter(identifier) {
  return mongoose.isValidObjectId(identifier)
    ? { $or: [{ _id: identifier }, { slug: identifier.toLowerCase() }] }
    : { slug: identifier.toLowerCase() };
}

export function seasonRangesOverlap(leftStart, leftEnd, rightStart, rightEnd) {
  return (
    new Date(leftStart) < new Date(rightEnd) && new Date(leftEnd) > new Date(rightStart)
  );
}

export function canTransitionSeason(from, to) {
  return Boolean(ALLOWED_TRANSITIONS[from]?.has(to));
}

export function inferSeasonStatus(startAt, endAt, now = new Date()) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (now < start) return "upcoming";
  if (now >= end) return "completed";
  return "active";
}

export function createSeasonService({
  SeasonModel = Season,
  MatchModel = Match,
  MatchResultModel = MatchResult,
  PlayerModel = Player,
  NotificationModel = Notification,
  AuditLogModel = AuditLog,
  userRepository = authUserRepository,
  analytics = analyticsService,
  mvp = mvpService,
  hallOfFame = hallOfFameService,
} = {}) {
  async function findByIdentifier(identifier, { session } = {}) {
    const query = SeasonModel.findOne(buildIdentifierFilter(identifier));
    if (session) query.session(session);
    const season = await query;
    if (!season) throw seasonNotFound();
    return season;
  }

  async function assertNoScheduleOverlap({
    startAt,
    endAt,
    excludeSeasonId = null,
    session = null,
  }) {
    const filter = {
      status: { $in: SCHEDULED_STATUSES },
      startAt: { $lt: new Date(endAt) },
      endAt: { $gt: new Date(startAt) },
    };
    if (excludeSeasonId) filter._id = { $ne: excludeSeasonId };
    const query = SeasonModel.findOne(filter).select({
      name: 1,
      slug: 1,
      startAt: 1,
      endAt: 1,
    });
    if (session) query.session(session);
    const conflict = await query.lean();
    if (conflict) {
      throw new AppError({
        statusCode: 409,
        code: "SEASON_DATE_OVERLAP",
        message: `The requested schedule overlaps ${conflict.name}.`,
        errors: [
          {
            path: "startAt",
            message: `Conflicting season: ${conflict.slug} (${new Date(conflict.startAt).toISOString()} – ${new Date(conflict.endAt).toISOString()}).`,
          },
        ],
      });
    }
  }

  async function hydrateSeason(season) {
    if (!season) return null;
    const [champion, award] = await Promise.all([
      season.championPlayerId
        ? PlayerModel.findById(season.championPlayerId)
            .select({ playerId: 1, name: 1, profileImage: 1, status: 1 })
            .lean()
        : null,
      season.mvpAwardId
        ? mongoose.model("MVPAward").findById(season.mvpAwardId).lean()
        : null,
    ]);
    return serializeSeason(season, {
      champion: serializePlayer(champion),
      mvpAward: serializeAward(award),
    });
  }

  async function notifyActiveUsers(type, title, message, season, session = null) {
    const users = await userRepository
      .users()
      .find({ status: "active" }, { projection: { _id: 1, id: 1 } })
      .toArray();
    if (!users.length) return 0;
    const documents = users.map((user) => ({
      userId: String(user._id ?? user.id),
      type,
      title,
      message,
      relatedEntity: { entityType: "season", entityId: String(season._id) },
      data: { seasonId: String(season._id), slug: season.slug, status: season.status },
    }));
    await NotificationModel.insertMany(documents, session ? { session } : undefined);
    return documents.length;
  }

  async function finalizeSeason(seasonId, { actor, reason, requestMeta }) {
    const season = await SeasonModel.findById(seasonId);
    if (!season) throw seasonNotFound();
    if (season.status !== "completed") {
      throw new AppError({
        statusCode: 409,
        code: "SEASON_NOT_COMPLETED",
        message: "Only a completed season can be finalized.",
      });
    }

    await SeasonModel.updateOne(
      { _id: seasonId },
      {
        $set: {
          finalization: {
            status: "processing",
            version: SEASON_FINALIZATION_VERSION,
            startedAt: new Date(),
            completedAt: null,
            errorCode: null,
          },
        },
      },
    );

    try {
      await analytics.recalculatePeriod(
        {
          periodType: "season",
          seasonId: String(seasonId),
          reason,
        },
        actor,
        requestMeta,
      );
      const [summary, leaderboard, mvpResult] = await Promise.all([
        analytics.getPeriodAnalytics({
          periodType: "season",
          seasonId: String(seasonId),
        }),
        analytics.getLeaderboard({
          metric: "overall",
          periodType: "season",
          seasonId: String(seasonId),
          page: 1,
          limit: 100,
          force: true,
        }),
        mvp.recalculateAward(
          {
            periodType: "season",
            seasonId: String(seasonId),
            reason,
          },
          actor,
          requestMeta,
        ),
      ]);
      const champion = leaderboard.entries[0]?.player ?? null;
      const award = mvpResult.award ?? null;

      const hallResult = await hallOfFame.recalculate(
        {
          category: "season_champion",
          seasonId: String(seasonId),
          reason,
        },
        actor,
        requestMeta,
      );

      const finalizedAt = new Date();
      const snapshot = {
        version: SEASON_FINALIZATION_VERSION,
        finalizedAt,
        analytics: summary,
        leaderboard: leaderboard.entries,
        champion,
        mvp: award,
        hallOfFame: hallResult.results?.[0] ?? null,
      };
      const updated = await SeasonModel.findByIdAndUpdate(
        seasonId,
        {
          $set: {
            championPlayerId: champion?.id ?? null,
            mvpAwardId: award?.id ?? null,
            finalizedSnapshot: snapshot,
            finalization: {
              status: "completed",
              version: SEASON_FINALIZATION_VERSION,
              startedAt: season.finalization?.startedAt ?? finalizedAt,
              completedAt: finalizedAt,
              errorCode: null,
            },
            updatedBy: actor.id,
          },
        },
        { new: true, runValidators: true },
      );
      return hydrateSeason(updated);
    } catch (error) {
      await SeasonModel.updateOne(
        { _id: seasonId },
        {
          $set: {
            "finalization.status": "failed",
            "finalization.version": SEASON_FINALIZATION_VERSION,
            "finalization.errorCode": "SEASON_FINALIZATION_FAILED",
            "finalization.completedAt": null,
          },
        },
      );
      throw error;
    }
  }

  return Object.freeze({
    async list(query, { includeDraft = false } = {}) {
      const filter = includeDraft ? {} : { status: { $ne: "draft" } };
      if (query.status) filter.status = query.status;
      if (query.search) {
        const pattern = new RegExp(escapeRegex(query.search), "i");
        filter.$or = [{ name: pattern }, { slug: pattern }, { description: pattern }];
      }
      const skip = (query.page - 1) * query.limit;
      const [items, totalItems] = await Promise.all([
        SeasonModel.find(filter)
          .sort({ [query.sortBy]: query.sortOrder === "asc" ? 1 : -1, _id: 1 })
          .skip(skip)
          .limit(query.limit)
          .lean(),
        SeasonModel.countDocuments(filter),
      ]);
      return {
        items: items.map((season) => serializeSeason(season)),
        pagination: createPaginationMeta({
          page: query.page,
          limit: query.limit,
          totalItems,
        }),
      };
    },

    async get(identifier, { includeDraft = false } = {}) {
      const season = await findByIdentifier(identifier);
      if (!includeDraft && season.status === "draft") throw seasonNotFound();
      return hydrateSeason(season);
    },

    async getActive() {
      const season = await SeasonModel.findOne({ status: "active" }).lean();
      return season ? hydrateSeason(season) : null;
    },

    async getLeaderboard(identifier, query) {
      const season = await findByIdentifier(identifier);
      const result = await analytics.getLeaderboard({
        metric: query.metric,
        periodType: "season",
        seasonId: String(season._id),
        page: query.page,
        limit: query.limit,
      });
      return { season: serializeSeason(season), ...result };
    },

    async getStatistics(identifier) {
      const season = await findByIdentifier(identifier);
      const analyticsResult = await analytics.getPeriodAnalytics({
        periodType: "season",
        seasonId: String(season._id),
      });
      const award = await mvp.getCurrentAward({
        periodType: "season",
        seasonId: String(season._id),
      });
      return {
        season: await hydrateSeason(season),
        analytics: analyticsResult,
        mvp: award.award,
      };
    },

    async create({ actor, input, requestMeta }) {
      const { reason, ...fields } = input;
      if (fields.status === "upcoming") {
        await assertNoScheduleOverlap(fields);
      }
      let season;
      try {
        season = await SeasonModel.create({
          ...fields,
          createdBy: actor.id,
          updatedBy: actor.id,
        });
      } catch (error) {
        if (error?.code === 11000) {
          throw new AppError({
            statusCode: 409,
            code: "SEASON_SLUG_EXISTS",
            message: "A season already uses this slug.",
          });
        }
        throw error;
      }
      await AuditLogModel.create({
        actorUserId: actor.id,
        action: "season.created",
        entityType: "season",
        entityId: String(season._id),
        previousValue: null,
        newValue: serializeSeason(season),
        reason,
        ...requestAuditFields(requestMeta),
      });
      return serializeSeason(season);
    },

    async update({ actor, seasonId, input, requestMeta }) {
      const season = await SeasonModel.findById(seasonId);
      if (!season) throw seasonNotFound();
      if (!["draft", "upcoming"].includes(season.status)) {
        throw new AppError({
          statusCode: 409,
          code: "SEASON_LOCKED",
          message: "Only draft or upcoming seasons can change their schedule.",
        });
      }
      const { reason, ...changes } = input;
      const nextStart = changes.startAt ? new Date(changes.startAt) : season.startAt;
      const nextEnd = changes.endAt ? new Date(changes.endAt) : season.endAt;
      if (nextEnd <= nextStart) {
        throw new AppError({
          statusCode: 422,
          code: "INVALID_SEASON_RANGE",
          message: "Season endAt must be later than startAt.",
        });
      }
      if (season.status === "upcoming") {
        await assertNoScheduleOverlap({
          startAt: nextStart,
          endAt: nextEnd,
          excludeSeasonId: season._id,
        });
      }
      const previous = serializeSeason(season);
      Object.assign(season, changes, { updatedBy: actor.id });
      try {
        await season.save();
      } catch (error) {
        if (error?.code === 11000) {
          throw new AppError({
            statusCode: 409,
            code: "SEASON_SLUG_EXISTS",
            message: "A season already uses this slug.",
          });
        }
        throw error;
      }
      await AuditLogModel.create({
        actorUserId: actor.id,
        action: "season.updated",
        entityType: "season",
        entityId: String(season._id),
        previousValue: previous,
        newValue: serializeSeason(season),
        reason,
        ...requestAuditFields(requestMeta),
      });
      return serializeSeason(season);
    },

    async changeStatus({ actor, seasonId, status, reason, requestMeta }) {
      const current = await SeasonModel.findById(seasonId);
      if (!current) throw seasonNotFound();
      if (current.status === status) return hydrateSeason(current);
      if (!canTransitionSeason(current.status, status)) {
        throw new AppError({
          statusCode: 409,
          code: "INVALID_SEASON_TRANSITION",
          message: `A season cannot move from ${current.status} to ${status}.`,
        });
      }

      if (["upcoming", "active"].includes(status)) {
        await assertNoScheduleOverlap({
          startAt: current.startAt,
          endAt: current.endAt,
          excludeSeasonId: current._id,
        });
      }
      if (status === "active") {
        const now = new Date();
        if (now < current.startAt || now >= current.endAt) {
          throw new AppError({
            statusCode: 409,
            code: "SEASON_OUTSIDE_ACTIVE_WINDOW",
            message: "A season can be activated only inside its configured date range.",
          });
        }
      }
      if (status === "archived" && current.status === "completed") {
        if (current.finalization?.status !== "completed") {
          throw new AppError({
            statusCode: 409,
            code: "SEASON_NOT_FINALIZED",
            message: "Complete season finalization before archiving.",
          });
        }
      }

      const previous = serializeSeason(current);
      const now = new Date();
      current.status = status;
      current.updatedBy = actor.id;
      if (status === "active") current.activatedAt = now;
      if (status === "completed") {
        current.completedAt = now;
        current.finalization = {
          status: "processing",
          version: SEASON_FINALIZATION_VERSION,
          startedAt: now,
          completedAt: null,
          errorCode: null,
        };
      }
      if (status === "archived") current.archivedAt = now;
      try {
        await current.save();
      } catch (error) {
        if (error?.code === 11000 && status === "active") {
          throw new AppError({
            statusCode: 409,
            code: "ACTIVE_SEASON_EXISTS",
            message: "Another season is already active.",
          });
        }
        throw error;
      }
      await AuditLogModel.create({
        actorUserId: actor.id,
        action: status === "completed" ? "season.completed" : "season.updated",
        entityType: "season",
        entityId: String(current._id),
        previousValue: previous,
        newValue: serializeSeason(current),
        reason,
        ...requestAuditFields(requestMeta),
      });

      if (status === "active") {
        await notifyActiveUsers(
          "season_started",
          `${current.name} has started`,
          `The ${current.name} league season is now active.`,
          current,
        );
      }
      if (status === "completed") {
        await notifyActiveUsers(
          "season_completed",
          `${current.name} has completed`,
          `The ${current.name} season is complete. Final rankings are being prepared.`,
          current,
        );
        return finalizeSeason(current._id, { actor, reason, requestMeta });
      }
      return hydrateSeason(current);
    },

    async recalculate({ actor, seasonId, reason, requestMeta }) {
      const season = await SeasonModel.findById(seasonId);
      if (!season) throw seasonNotFound();
      if (!["active", "completed"].includes(season.status)) {
        throw new AppError({
          statusCode: 409,
          code: "SEASON_RECALCULATION_NOT_ALLOWED",
          message: "Only active or completed seasons can be recalculated.",
        });
      }
      if (season.status === "completed") {
        return finalizeSeason(season._id, { actor, reason, requestMeta });
      }
      const recalculation = await analytics.recalculatePeriod(
        {
          periodType: "season",
          seasonId: String(season._id),
          reason,
        },
        actor,
        requestMeta,
      );
      const award = await mvp.recalculateAward(
        {
          periodType: "season",
          seasonId: String(season._id),
          reason,
        },
        actor,
        requestMeta,
      );
      return { season: serializeSeason(season), recalculation, mvp: award.award };
    },

    async resolveForMatch({ matchDate, requestedSeasonId = null, session = null }) {
      const instant = new Date(matchDate);
      if (Number.isNaN(instant.getTime())) {
        throw new AppError({
          statusCode: 422,
          code: "INVALID_MATCH_DATE",
          message: "A valid match date is required for season assignment.",
        });
      }
      const allowed = ["upcoming", "active", "completed"];
      let season;
      if (requestedSeasonId) {
        const query = SeasonModel.findById(requestedSeasonId);
        if (session) query.session(session);
        season = await query.lean();
        if (!season) throw seasonNotFound();
        if (!allowed.includes(season.status)) {
          throw new AppError({
            statusCode: 409,
            code: "SEASON_NOT_ASSIGNABLE",
            message: "Draft or archived seasons cannot receive match results.",
          });
        }
        if (instant < new Date(season.startAt) || instant >= new Date(season.endAt)) {
          throw new AppError({
            statusCode: 422,
            code: "MATCH_OUTSIDE_SEASON_RANGE",
            message: "The match date is outside the selected season range.",
          });
        }
        return season;
      }
      const query = SeasonModel.findOne({
        status: { $in: allowed },
        startAt: { $lte: instant },
        endAt: { $gt: instant },
      }).sort({ startAt: -1 });
      if (session) query.session(session);
      season = await query.lean();
      return season ?? null;
    },

    async backfillMatchAssignments({ actor, seasonId, reason, requestMeta }) {
      const season = await SeasonModel.findById(seasonId);
      if (!season) throw seasonNotFound();
      if (!["upcoming", "active", "completed"].includes(season.status)) {
        throw new AppError({
          statusCode: 409,
          code: "SEASON_BACKFILL_NOT_ALLOWED",
          message:
            "Only upcoming, active or completed seasons can receive backfilled matches.",
        });
      }
      const filter = {
        matchDate: { $gte: season.startAt, $lt: season.endAt },
        $or: [{ seasonId: null }, { seasonId: { $exists: false } }],
      };
      const matches = await MatchModel.find(filter)
        .select({ _id: 1, status: 1 })
        .lean();
      const matchIds = matches.map((match) => match._id);
      if (matchIds.length) {
        await MatchModel.updateMany(
          { _id: { $in: matchIds } },
          { $set: { seasonId: season._id } },
        );
        await MatchResultModel.updateMany(
          { matchId: { $in: matchIds }, status: "verified" },
          { $set: { officialSeasonId: season._id } },
        );
      }
      let recalculation = null;
      if (matchIds.length && season.status === "active") {
        recalculation = await analytics.recalculatePeriod(
          {
            periodType: "season",
            seasonId: String(season._id),
            reason,
          },
          actor,
          requestMeta,
        );
        await mvp.recalculateAward(
          {
            periodType: "season",
            seasonId: String(season._id),
            reason,
          },
          actor,
          requestMeta,
        );
      }
      if (matchIds.length && season.status === "completed") {
        recalculation = await finalizeSeason(season._id, {
          actor,
          reason,
          requestMeta,
        });
      }
      const result = {
        seasonId: String(season._id),
        updatedMatches: matchIds.length,
        recalculation,
      };
      await AuditLogModel.create({
        actorUserId: actor.id,
        action: "season.updated",
        entityType: "season",
        entityId: String(season._id),
        previousValue: null,
        newValue: result,
        reason,
        ...requestAuditFields(requestMeta),
      });
      return result;
    },
  });
}

export const seasonService = createSeasonService();
