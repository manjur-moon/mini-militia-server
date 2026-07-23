import mongoose from "mongoose";
import { AuditLog } from "../models/audit-log.model.js";
import { MVPAward } from "../models/mvp-award.model.js";
import { PlayerStatistics } from "../models/player-statistics.model.js";
import { Player } from "../models/player.model.js";
import { AppError } from "../utils/app-error.js";
import { analyticsService } from "./analytics.service.js";
import { calculateMvpScoreBreakdown } from "./analytics-math.service.js";
import { mvpConfigService } from "./mvp-config.service.js";
import { notificationService } from "./notification.service.js";

function serializeAward(document, player = null, stale = false) {
  const value =
    typeof document?.toObject === "function" ? document.toObject() : document;
  if (!value) return null;
  return {
    id: String(value._id),
    awardType: value.awardType,
    periodKey: value.periodKey,
    startAt: value.startAt,
    endAt: value.endAt,
    timezone: value.timezone,
    playerId: String(value.playerId),
    player: player
      ? {
          id: String(player._id),
          playerId: player.playerId,
          name: player.name,
          photoUrl: player.profileImage?.secureUrl ?? null,
        }
      : undefined,
    seasonId: value.seasonId ? String(value.seasonId) : null,
    score: value.score,
    scoreBreakdown: value.scoreBreakdown,
    formulaVersion: value.formulaVersion,
    minimumMatchesMet: value.minimumMatchesMet,
    status: value.status,
    awardedAt: value.awardedAt,
    sourceDataHash: value.sourceDataHash,
    stale,
  };
}

function pickWinner(entries, config) {
  return (
    entries
      .filter((entry) => entry.metrics.matchesPlayed >= config.minimumMatches)
      .map((entry) => ({
        ...entry,
        breakdown: calculateMvpScoreBreakdown(entry.metrics, config),
      }))
      .sort((left, right) => {
        if (right.breakdown.totalScore !== left.breakdown.totalScore) {
          return right.breakdown.totalScore - left.breakdown.totalScore;
        }
        if (right.metrics.totalKills !== left.metrics.totalKills) {
          return right.metrics.totalKills - left.metrics.totalKills;
        }
        if (right.metrics.firstPlaceCount !== left.metrics.firstPlaceCount) {
          return right.metrics.firstPlaceCount - left.metrics.firstPlaceCount;
        }
        if (left.metrics.totalDeaths !== right.metrics.totalDeaths) {
          return left.metrics.totalDeaths - right.metrics.totalDeaths;
        }
        return left.player.playerId.localeCompare(right.player.playerId);
      })[0] ?? null
  );
}

export function createMvpService({
  MVPAwardModel = MVPAward,
  PlayerModel = Player,
  PlayerStatisticsModel = PlayerStatistics,
  AuditLogModel = AuditLog,
  analytics = analyticsService,
  configService = mvpConfigService,
  notificationDelivery = notificationService,
} = {}) {
  async function hydrateAward(award, stale = false) {
    if (!award) return null;
    const player = await PlayerModel.findById(award.playerId)
      .select({ playerId: 1, name: 1, profileImage: 1 })
      .lean();
    return serializeAward(award, player, stale);
  }

  async function syncMvpCounts(playerIds, session) {
    const uniqueIds = [...new Set(playerIds.filter(Boolean).map(String))].map(
      (id) => new mongoose.Types.ObjectId(id),
    );
    for (const playerId of uniqueIds) {
      const count = await MVPAwardModel.countDocuments({
        playerId,
        status: "current",
      }).session(session);
      await PlayerStatisticsModel.updateOne(
        { playerId },
        { $set: { "metrics.mvpCount": count } },
        { session },
      );
    }
  }

  async function generateAward({
    periodType,
    date,
    seasonId,
    force = false,
    actor = null,
    reason = null,
    requestMeta = {},
  }) {
    const period = await analytics.resolvePeriod({ periodType, date, seasonId });
    const periodResult = await analytics.ensurePeriodStatistics(period, { force });
    const config = periodResult.config ?? (await configService.getActiveConfig());
    const winner = pickWinner(periodResult.entries, config);
    const current = await MVPAwardModel.findOne({
      awardType: period.type,
      periodKey: period.key,
      status: "current",
    }).lean();

    if (!winner) {
      return {
        period: {
          type: period.type,
          key: period.key,
          label: period.label,
          startAt: period.startAt,
          endAt: period.endAt,
          timezone: period.timezone,
        },
        award: current ? await hydrateAward(current, false) : null,
        eligiblePlayers: 0,
      };
    }

    const sameSource =
      current?.sourceDataHash === periodResult.sourceDataHash &&
      current?.formulaVersion === config.version;
    if (current && sameSource) {
      return {
        period,
        award: await hydrateAward(current, false),
        eligiblePlayers: periodResult.entries.filter(
          (entry) => entry.metrics.matchesPlayed >= config.minimumMatches,
        ).length,
      };
    }

    const isOpenPeriod =
      period.type === "all_time" || period.endAt.getTime() > Date.now();
    const formulaChanged = current && current.formulaVersion !== config.version;
    if (current && !force && (!isOpenPeriod || formulaChanged)) {
      return {
        period,
        award: await hydrateAward(current, true),
        eligiblePlayers: periodResult.entries.filter(
          (entry) => entry.metrics.matchesPlayed >= config.minimumMatches,
        ).length,
      };
    }

    const newAwardId = new mongoose.Types.ObjectId();
    const session = await mongoose.startSession();
    let created;
    let previousWinnerId = null;
    try {
      await session.withTransaction(async () => {
        const previous = await MVPAwardModel.findOne({
          awardType: period.type,
          periodKey: period.key,
          status: "current",
        }).session(session);
        if (previous) {
          previousWinnerId = String(previous.playerId);
          previous.status = "superseded";
          previous.supersededByAwardId = newAwardId;
          await previous.save({ session });
        }
        [created] = await MVPAwardModel.create(
          [
            {
              _id: newAwardId,
              awardType: period.type,
              periodKey: period.key,
              startAt: period.startAt,
              endAt: period.endAt,
              timezone: period.timezone,
              playerId: new mongoose.Types.ObjectId(winner.playerId),
              seasonId: period.seasonId ?? null,
              score: winner.breakdown.totalScore,
              scoreBreakdown: winner.breakdown,
              formulaVersion: config.version,
              minimumMatchesMet: true,
              status: "current",
              awardedAt: new Date(),
              sourceDataHash: periodResult.sourceDataHash,
            },
          ],
          { session },
        );
        await syncMvpCounts([previous?.playerId, winner.playerId], session);
        if (actor) {
          await AuditLogModel.create(
            [
              {
                actorUserId: actor.id,
                action: "mvp_award.recalculated",
                entityType: "mvp_award",
                entityId: String(newAwardId),
                previousValue: previous ? serializeAward(previous) : null,
                newValue: serializeAward(created),
                reason,
                ipAddress: requestMeta.ipAddress ?? null,
                userAgent: requestMeta.userAgent ?? null,
                requestId: requestMeta.requestId ?? null,
              },
            ],
            { session },
          );
        }
      });
    } finally {
      await session.endSession();
    }

    if (previousWinnerId !== String(winner.playerId)) {
      await notificationDelivery
        .createForLinkedPlayers([winner.playerId], (player) => ({
          type: "mvp_award",
          title: `${period.label} MVP awarded`,
          message: `${player.name} earned the ${period.label} MVP award.`,
          relatedEntity: { entityType: "mvp_award", entityId: String(newAwardId) },
          actionUrl: "/mvp",
          data: {
            awardId: String(newAwardId),
            awardType: period.type,
            periodKey: period.key,
            playerId: player.playerId,
          },
          deduplicationKey: `mvp-award:${String(newAwardId)}:${player.linkedUserId}`,
        }))
        .catch(() => undefined);
    }

    return {
      period,
      award: await hydrateAward(created, false),
      eligiblePlayers: periodResult.entries.filter(
        (entry) => entry.metrics.matchesPlayed >= config.minimumMatches,
      ).length,
    };
  }

  return Object.freeze({
    generateAward,

    async getCurrentAward(input) {
      return generateAward({ ...input, force: false });
    },

    async recalculateAward(input, actor, requestMeta) {
      if (!input.reason) {
        throw new AppError({
          statusCode: 422,
          code: "RECALCULATION_REASON_REQUIRED",
          message: "A reason is required to recalculate an MVP award.",
        });
      }
      return generateAward({
        ...input,
        force: true,
        actor,
        reason: input.reason,
        requestMeta,
      });
    },

    async listAwards({ awardType, playerId, status, page = 1, limit = 10 }) {
      const filter = {};
      if (awardType) filter.awardType = awardType;
      if (status) filter.status = status;
      if (playerId) {
        const player = await PlayerModel.findOne({ playerId })
          .select({ _id: 1 })
          .lean();
        if (!player) {
          return {
            items: [],
            pagination: {
              page: 1,
              limit,
              totalItems: 0,
              totalPages: 1,
              hasNextPage: false,
              hasPreviousPage: false,
            },
          };
        }
        filter.playerId = player._id;
      }
      const totalItems = await MVPAwardModel.countDocuments(filter);
      const totalPages = Math.max(1, Math.ceil(totalItems / limit));
      const safePage = Math.min(page, totalPages);
      const awards = await MVPAwardModel.find(filter)
        .sort({ startAt: -1, awardedAt: -1 })
        .skip((safePage - 1) * limit)
        .limit(limit)
        .lean();
      const players = await PlayerModel.find({
        _id: { $in: awards.map((award) => award.playerId) },
      })
        .select({ playerId: 1, name: 1, profileImage: 1 })
        .lean();
      const playerMap = new Map(players.map((player) => [String(player._id), player]));
      return {
        items: awards.map((award) =>
          serializeAward(award, playerMap.get(String(award.playerId))),
        ),
        pagination: {
          page: safePage,
          limit,
          totalItems,
          totalPages,
          hasNextPage: safePage < totalPages,
          hasPreviousPage: safePage > 1,
        },
      };
    },
  });
}

export const mvpService = createMvpService();
