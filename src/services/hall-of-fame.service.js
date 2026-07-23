import crypto from "node:crypto";
import mongoose from "mongoose";
import { createPaginationMeta } from "@mini-militia/shared";
import { HALL_OF_FAME_CATEGORIES } from "../constants/domain.constants.js";
import { AuditLog } from "../models/audit-log.model.js";
import { HallOfFameRecord } from "../models/hall-of-fame-record.model.js";
import { MVPAward } from "../models/mvp-award.model.js";
import { PlayerStatistics } from "../models/player-statistics.model.js";
import { Player } from "../models/player.model.js";
import { Season } from "../models/season.model.js";
import { AppError } from "../utils/app-error.js";
import { ANALYTICS_CALCULATION_VERSION } from "./analytics-math.service.js";
import { analyticsService } from "./analytics.service.js";
import {
  selectAllTimeLegend,
  selectBestKdr,
  selectLongestWinningStreak,
  selectMostKills,
  selectMostMvpAwards,
  selectSeasonChampion,
} from "./hall-of-fame-ranking.service.js";
import { CORE_STATISTICS_VERSION } from "./statistics.service.js";

export const HALL_OF_FAME_CALCULATION_VERSION = "hall-of-fame-v1";

export const HALL_OF_FAME_DEFINITIONS = Object.freeze({
  season_champion: Object.freeze({
    label: "Season Champion",
    icon: "🏆",
    unit: "performance points",
    definition:
      "The eligible player ranked first by the versioned season performance score after the season is completed or archived.",
    tieBreakers: [
      "Lower official season rank",
      "Higher season performance score",
      "More first-place finishes",
      "More kills",
      "Stable player ID order",
    ],
  }),
  all_time_legend: Object.freeze({
    label: "All-Time Legend",
    icon: "👑",
    unit: "performance points",
    definition:
      "The eligible player ranked first by the versioned all-time performance score.",
    tieBreakers: [
      "Lower all-time rank",
      "Higher all-time performance score",
      "More first-place finishes",
      "More kills",
      "Stable player ID order",
    ],
  }),
  most_kills: Object.freeze({
    label: "Most Kills Record",
    icon: "🎯",
    unit: "kills",
    definition: "The player with the highest verified all-time kill total.",
    tieBreakers: [
      "More first-place finishes",
      "Fewer deaths",
      "Stable player ID order",
    ],
  }),
  most_mvp_awards: Object.freeze({
    label: "Most MVP Awards",
    icon: "⭐",
    unit: "awards",
    definition:
      "The player with the greatest number of current weekly, monthly, season and all-time MVP awards.",
    tieBreakers: [
      "Higher combined MVP score",
      "More recent final award",
      "Stable player ID order",
    ],
  }),
  best_kdr: Object.freeze({
    label: "Best KDR Record",
    icon: "⚔️",
    unit: "KDR",
    definition:
      "The eligible player with the highest verified all-time KDR after satisfying the active minimum-match requirement.",
    tieBreakers: ["More kills", "Fewer deaths", "Stable player ID order"],
  }),
  longest_winning_streak: Object.freeze({
    label: "Longest Winning Streak",
    icon: "🔥",
    unit: "wins",
    definition:
      "The player with the longest consecutive first-place streak across verified matches in chronological order.",
    tieBreakers: [
      "More total first-place finishes",
      "More kills",
      "Stable player ID order",
    ],
  }),
});

const GLOBAL_CATEGORIES = Object.freeze(
  HALL_OF_FAME_CATEGORIES.filter((category) => category !== "season_champion"),
);

function hash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function snapshotPlayer(player) {
  return {
    playerId: player.playerId,
    name: player.name,
    photoUrl: player.profileImage?.secureUrl ?? null,
    status: player.status,
  };
}

function snapshotSeason(season) {
  return {
    name: season.name,
    slug: season.slug,
    startAt: season.startAt,
    endAt: season.endAt,
    timezone: season.timezone,
    status: season.status,
  };
}

function serializeDefinition(category) {
  return { category, ...HALL_OF_FAME_DEFINITIONS[category] };
}

function serializeRecord(document) {
  const value = document?.toObject?.() ?? document;
  if (!value) return null;
  return {
    id: String(value._id),
    category: value.category,
    definition: serializeDefinition(value.category),
    playerId: String(value.playerId),
    player: value.playerSnapshot,
    seasonId: value.seasonId ? String(value.seasonId) : null,
    season: value.seasonSnapshot ?? null,
    periodKey: value.periodKey,
    recordValue: value.recordValue,
    unit: value.unit,
    awardDate: value.awardDate,
    calculatedAt: value.calculatedAt,
    criteria: value.criteriaSnapshot,
    evidence: value.evidence,
    sourceVersion: value.sourceVersion,
    sourceDataHash: value.sourceDataHash,
    status: value.status,
    supersededAt: value.supersededAt ?? null,
    supersededByRecordId: value.supersededByRecordId
      ? String(value.supersededByRecordId)
      : null,
    supersededReason: value.supersededReason ?? null,
    createdAt: value.createdAt,
  };
}

function requestAuditFields(requestMeta = {}) {
  return {
    ipAddress: requestMeta.ipAddress ?? null,
    userAgent: requestMeta.userAgent ?? null,
    requestId: requestMeta.requestId ?? null,
  };
}

function categoryDefinition(category, minimumMatches = null) {
  const definition = HALL_OF_FAME_DEFINITIONS[category];
  return {
    definition: definition.definition,
    minimumMatches,
    tieBreakers: definition.tieBreakers,
  };
}

function ensureCategory(category) {
  if (!HALL_OF_FAME_CATEGORIES.includes(category)) {
    throw new AppError({
      statusCode: 422,
      code: "INVALID_HALL_OF_FAME_CATEGORY",
      message: "Unsupported Hall of Fame category.",
    });
  }
}

function playerNotFound() {
  return new AppError({
    statusCode: 404,
    code: "PLAYER_NOT_FOUND",
    message: "Player profile was not found.",
  });
}

function seasonNotFound() {
  return new AppError({
    statusCode: 404,
    code: "SEASON_NOT_FOUND",
    message: "Season was not found.",
  });
}

function sameRecord(current, candidate) {
  return (
    String(current.playerId) === String(candidate.player._id) &&
    current.periodKey === candidate.periodKey &&
    current.sourceVersion === candidate.sourceVersion &&
    Math.abs(Number(current.recordValue) - Number(candidate.recordValue)) < 0.000001
  );
}

export function createHallOfFameService({
  HallOfFameRecordModel = HallOfFameRecord,
  PlayerModel = Player,
  PlayerStatisticsModel = PlayerStatistics,
  MVPAwardModel = MVPAward,
  SeasonModel = Season,
  AuditLogModel = AuditLog,
  analytics = analyticsService,
} = {}) {
  async function loadPlayerMap(ids) {
    const uniqueIds = [...new Set(ids.map(String))];
    if (!uniqueIds.length) return new Map();
    const players = await PlayerModel.find({ _id: { $in: uniqueIds } })
      .select({ playerId: 1, name: 1, profileImage: 1, status: 1 })
      .lean();
    return new Map(players.map((player) => [String(player._id), player]));
  }

  async function resolveStatisticsEntries() {
    const statistics = await PlayerStatisticsModel.find({})
      .select({
        playerId: 1,
        metrics: 1,
        records: 1,
        calculationVersion: 1,
        recalculatedAt: 1,
      })
      .lean();
    const players = await loadPlayerMap(statistics.map((item) => item.playerId));
    return statistics
      .map((item) => ({ ...item, player: players.get(String(item.playerId)) }))
      .filter((item) => item.player);
  }

  async function resolveAllTimeResult() {
    const period = await analytics.resolvePeriod({ periodType: "all_time" });
    return analytics.ensurePeriodStatistics(period);
  }

  async function resolveSeasonCandidate(seasonId) {
    if (!seasonId) {
      throw new AppError({
        statusCode: 422,
        code: "SEASON_ID_REQUIRED",
        message: "Season champion recalculation requires a seasonId.",
      });
    }
    const season = await SeasonModel.findById(seasonId).lean();
    if (!season) throw seasonNotFound();
    if (!new Set(["completed", "archived"]).has(season.status)) {
      throw new AppError({
        statusCode: 409,
        code: "SEASON_NOT_FINALIZED",
        message:
          "A season champion can be recorded only after the season is completed.",
      });
    }
    const period = await analytics.resolvePeriod({
      periodType: "season",
      seasonId: String(season._id),
    });
    const result = await analytics.ensurePeriodStatistics(period);
    const winner = selectSeasonChampion(result.entries);
    if (!winner) return { candidate: null, season };
    const definition = HALL_OF_FAME_DEFINITIONS.season_champion;
    const candidate = {
      category: "season_champion",
      player: {
        _id: winner.playerId,
        playerId: winner.player.playerId,
        name: winner.player.name,
        profileImage: { secureUrl: winner.player.photoUrl },
        status: winner.player.status,
      },
      season,
      periodKey: period.key,
      recordValue: winner.performanceScore,
      unit: definition.unit,
      awardDate: season.completedAt ?? season.endAt,
      criteriaSnapshot: categoryDefinition(
        "season_champion",
        result.config.minimumMatches,
      ),
      evidence: {
        period: {
          key: period.key,
          startAt: period.startAt,
          endAt: period.endAt,
          timezone: period.timezone,
        },
        rank: winner.rank,
        performanceScore: winner.performanceScore,
        metrics: winner.metrics,
        analyticsSourceDataHash: result.sourceDataHash,
        analyticsCalculationVersion: ANALYTICS_CALCULATION_VERSION,
        formulaVersion: result.config.version,
      },
      sourceVersion: `${HALL_OF_FAME_CALCULATION_VERSION}:${ANALYTICS_CALCULATION_VERSION}:${result.config.version}`,
    };
    candidate.sourceDataHash = hash({
      category: candidate.category,
      playerId: String(candidate.player._id),
      seasonId: String(season._id),
      recordValue: candidate.recordValue,
      evidence: candidate.evidence,
    });
    return { candidate, season };
  }

  async function resolveCandidate(category, seasonId = null) {
    ensureCategory(category);
    if (category === "season_champion") {
      return (await resolveSeasonCandidate(seasonId)).candidate;
    }

    if (category === "all_time_legend" || category === "best_kdr") {
      const result = await resolveAllTimeResult();
      const winner =
        category === "all_time_legend"
          ? selectAllTimeLegend(result.entries)
          : selectBestKdr(result.entries, result.config.minimumMatches);
      if (!winner) return null;
      const definition = HALL_OF_FAME_DEFINITIONS[category];
      const recordValue =
        category === "all_time_legend" ? winner.performanceScore : winner.metrics.kdr;
      const candidate = {
        category,
        player: {
          _id: winner.playerId,
          playerId: winner.player.playerId,
          name: winner.player.name,
          profileImage: { secureUrl: winner.player.photoUrl },
          status: winner.player.status,
        },
        season: null,
        periodKey: result.period.key,
        recordValue,
        unit: definition.unit,
        awardDate: new Date(),
        criteriaSnapshot: categoryDefinition(category, result.config.minimumMatches),
        evidence: {
          period: {
            key: result.period.key,
            startAt: result.period.startAt,
            endAt: result.period.endAt,
            timezone: result.period.timezone,
          },
          rank: winner.rank,
          performanceScore: winner.performanceScore,
          metrics: winner.metrics,
          analyticsSourceDataHash: result.sourceDataHash,
          analyticsCalculationVersion: ANALYTICS_CALCULATION_VERSION,
          formulaVersion: result.config.version,
        },
        sourceVersion: `${HALL_OF_FAME_CALCULATION_VERSION}:${ANALYTICS_CALCULATION_VERSION}:${result.config.version}`,
      };
      candidate.sourceDataHash = hash({
        category,
        playerId: String(candidate.player._id),
        recordValue,
        evidence: candidate.evidence,
      });
      return candidate;
    }

    if (category === "most_mvp_awards") {
      const grouped = await MVPAwardModel.aggregate([
        { $match: { status: "current" } },
        {
          $group: {
            _id: "$playerId",
            awardCount: { $sum: 1 },
            totalScore: { $sum: "$score" },
            latestAwardAt: { $max: "$awardedAt" },
            formulaVersions: { $addToSet: "$formulaVersion" },
            awardIds: { $push: "$_id" },
          },
        },
      ]);
      const players = await loadPlayerMap(grouped.map((item) => item._id));
      const winner = selectMostMvpAwards(
        grouped
          .map((item) => ({
            ...item,
            player: players.get(String(item._id)),
          }))
          .filter((item) => item.player),
      );
      if (!winner) return null;
      const candidate = {
        category,
        player: winner.player,
        season: null,
        periodKey: "all-time",
        recordValue: winner.awardCount,
        unit: HALL_OF_FAME_DEFINITIONS[category].unit,
        awardDate: winner.latestAwardAt ?? new Date(),
        criteriaSnapshot: categoryDefinition(category, null),
        evidence: {
          currentAwardCount: winner.awardCount,
          totalMvpScore: winner.totalScore,
          latestAwardAt: winner.latestAwardAt,
          formulaVersions: winner.formulaVersions,
          awardIds: winner.awardIds.map(String),
        },
        sourceVersion: `${HALL_OF_FAME_CALCULATION_VERSION}:mvp-awards-v1`,
      };
      candidate.sourceDataHash = hash({
        category,
        playerId: String(candidate.player._id),
        recordValue: candidate.recordValue,
        evidence: candidate.evidence,
      });
      return candidate;
    }

    const entries = await resolveStatisticsEntries();
    const winner =
      category === "most_kills"
        ? selectMostKills(entries)
        : selectLongestWinningStreak(entries);
    if (!winner) return null;
    const recordValue =
      category === "most_kills"
        ? winner.metrics.totalKills
        : winner.records.longestFirstPlaceStreak;
    const candidate = {
      category,
      player: winner.player,
      season: null,
      periodKey: "all-time",
      recordValue,
      unit: HALL_OF_FAME_DEFINITIONS[category].unit,
      awardDate: new Date(),
      criteriaSnapshot: categoryDefinition(category, null),
      evidence: {
        metrics: winner.metrics,
        records: winner.records,
        statisticsCalculationVersion: winner.calculationVersion,
        statisticsRecalculatedAt: winner.recalculatedAt,
      },
      sourceVersion: `${HALL_OF_FAME_CALCULATION_VERSION}:${CORE_STATISTICS_VERSION}`,
    };
    candidate.sourceDataHash = hash({
      category,
      playerId: String(candidate.player._id),
      recordValue,
      evidence: candidate.evidence,
    });
    return candidate;
  }

  async function persistCandidate(
    candidate,
    { category, seasonId = null, actor, reason, requestMeta },
  ) {
    const scope = {
      category: candidate?.category ?? category,
      seasonId: candidate?.season?._id ?? seasonId ?? null,
      status: "current",
    };
    const session = await mongoose.startSession();
    let result;
    try {
      await session.withTransaction(async () => {
        const current = await HallOfFameRecordModel.findOne(scope).session(session);
        const previousSnapshot = current ? serializeRecord(current) : null;
        if (!candidate) {
          if (!current) {
            result = { status: "empty", record: null, previousRecord: null };
            return;
          }
          current.status = "historical";
          current.supersededAt = new Date();
          current.supersededReason = reason;
          await current.save({ session });
          await AuditLogModel.create(
            [
              {
                actorUserId: actor?.id ?? "system",
                action: "hall_of_fame.record_superseded",
                entityType: "hall_of_fame_record",
                entityId: String(current._id),
                previousValue: previousSnapshot,
                newValue: { status: "historical", replacement: null },
                reason,
                ...requestAuditFields(requestMeta),
              },
            ],
            { session },
          );
          result = {
            status: "cleared",
            record: null,
            previousRecord: previousSnapshot,
          };
          return;
        }

        if (current && sameRecord(current, candidate)) {
          result = {
            status: "unchanged",
            record: serializeRecord(current),
            previousRecord: null,
          };
          return;
        }

        if (current) {
          current.status = "historical";
          current.supersededAt = new Date();
          current.supersededReason = reason;
          await current.save({ session });
        }

        const [created] = await HallOfFameRecordModel.create(
          [
            {
              category: candidate.category,
              playerId: candidate.player._id,
              playerSnapshot: snapshotPlayer(candidate.player),
              seasonId: candidate.season?._id ?? null,
              seasonSnapshot: candidate.season
                ? snapshotSeason(candidate.season)
                : null,
              periodKey: candidate.periodKey,
              recordValue: candidate.recordValue,
              unit: candidate.unit,
              awardDate: candidate.awardDate,
              calculatedAt: new Date(),
              criteriaSnapshot: candidate.criteriaSnapshot,
              evidence: candidate.evidence,
              sourceVersion: candidate.sourceVersion,
              sourceDataHash: candidate.sourceDataHash,
              status: "current",
            },
          ],
          { session },
        );

        if (current) {
          current.supersededByRecordId = created._id;
          await current.save({ session });
          await AuditLogModel.create(
            [
              {
                actorUserId: actor?.id ?? "system",
                action: "hall_of_fame.record_superseded",
                entityType: "hall_of_fame_record",
                entityId: String(current._id),
                previousValue: previousSnapshot,
                newValue: {
                  status: "historical",
                  supersededByRecordId: String(created._id),
                },
                reason,
                ...requestAuditFields(requestMeta),
              },
            ],
            { session },
          );
        }

        await AuditLogModel.create(
          [
            {
              actorUserId: actor?.id ?? "system",
              action: "hall_of_fame.record_created",
              entityType: "hall_of_fame_record",
              entityId: String(created._id),
              previousValue: previousSnapshot,
              newValue: serializeRecord(created),
              reason,
              ...requestAuditFields(requestMeta),
            },
          ],
          { session },
        );

        result = {
          status: current ? "superseded" : "created",
          record: serializeRecord(created),
          previousRecord: previousSnapshot,
        };
      });
    } finally {
      await session.endSession();
    }
    return result;
  }

  async function recalculateCategory(
    category,
    { seasonId = null, actor = null, reason, requestMeta = {} } = {},
  ) {
    const candidate = await resolveCandidate(category, seasonId);
    if (!candidate) {
      return persistCandidate(null, {
        actor,
        reason,
        requestMeta,
        category,
        seasonId,
      });
    }
    return persistCandidate(candidate, {
      category,
      seasonId,
      actor,
      reason,
      requestMeta,
    });
  }

  async function list(query) {
    const filter = {};
    if (query.category) filter.category = query.category;
    if (query.status !== "all") filter.status = query.status;
    if (query.seasonId) filter.seasonId = query.seasonId;
    const skip = (query.page - 1) * query.limit;
    const [items, totalItems] = await Promise.all([
      HallOfFameRecordModel.find(filter)
        .sort({ status: 1, awardDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(query.limit)
        .lean(),
      HallOfFameRecordModel.countDocuments(filter),
    ]);
    return {
      definitions: HALL_OF_FAME_CATEGORIES.map(serializeDefinition),
      items: items.map(serializeRecord),
      pagination: createPaginationMeta({
        page: query.page,
        limit: query.limit,
        totalItems,
      }),
    };
  }

  return Object.freeze({
    async list(query) {
      return list(query);
    },

    async getCategory(category, query) {
      ensureCategory(category);
      return list({ ...query, category });
    },

    async getPlayerHistory(playerCode, query) {
      const player = await PlayerModel.findOne({ playerId: playerCode })
        .select({ playerId: 1, name: 1, profileImage: 1, status: 1 })
        .lean();
      if (!player) throw playerNotFound();
      const filter = { playerId: player._id };
      if (query.category) filter.category = query.category;
      if (query.status !== "all") filter.status = query.status;
      const skip = (query.page - 1) * query.limit;
      const [items, totalItems] = await Promise.all([
        HallOfFameRecordModel.find(filter)
          .sort({ awardDate: -1, createdAt: -1 })
          .skip(skip)
          .limit(query.limit)
          .lean(),
        HallOfFameRecordModel.countDocuments(filter),
      ]);
      return {
        player: snapshotPlayer(player),
        items: items.map(serializeRecord),
        pagination: createPaginationMeta({
          page: query.page,
          limit: query.limit,
          totalItems,
        }),
      };
    },

    async recalculate(input, actor = null, requestMeta = {}) {
      const reason = input.reason ?? "Refresh Hall of Fame from verified data.";
      let tasks = [];
      if (input.category) {
        tasks = [{ category: input.category, seasonId: input.seasonId ?? null }];
      } else if (input.seasonId) {
        tasks = [{ category: "season_champion", seasonId: input.seasonId }];
      } else {
        tasks = GLOBAL_CATEGORIES.map((category) => ({ category, seasonId: null }));
        const seasons = await SeasonModel.find({
          status: { $in: ["completed", "archived"] },
        })
          .select({ _id: 1 })
          .lean();
        tasks.push(
          ...seasons.map((season) => ({
            category: "season_champion",
            seasonId: String(season._id),
          })),
        );
      }

      const results = [];
      for (const task of tasks) {
        results.push({
          category: task.category,
          seasonId: task.seasonId,
          ...(await recalculateCategory(task.category, {
            seasonId: task.seasonId,
            actor,
            reason,
            requestMeta,
          })),
        });
      }

      await AuditLogModel.create({
        actorUserId: actor?.id ?? "system",
        action: "hall_of_fame.recalculated",
        entityType: "hall_of_fame",
        entityId: input.category ?? input.seasonId ?? "all",
        previousValue: null,
        newValue: {
          processedCategories: results.length,
          results: results.map((item) => ({
            category: item.category,
            seasonId: item.seasonId,
            status: item.status,
            recordId: item.record?.id ?? null,
          })),
        },
        reason,
        ...requestAuditFields(requestMeta),
      });

      return {
        calculationVersion: HALL_OF_FAME_CALCULATION_VERSION,
        processedCategories: results.length,
        results,
      };
    },

    async refreshAfterVerifiedData({ actor = null, requestMeta = {}, reason } = {}) {
      const resolvedReason =
        reason ??
        "Automatically refresh global Hall of Fame records after verified data changed.";
      const results = [];
      for (const category of GLOBAL_CATEGORIES) {
        results.push({
          category,
          seasonId: null,
          ...(await recalculateCategory(category, {
            actor,
            reason: resolvedReason,
            requestMeta,
          })),
        });
      }
      await AuditLogModel.create({
        actorUserId: actor?.id ?? "system",
        action: "hall_of_fame.recalculated",
        entityType: "hall_of_fame",
        entityId: "global",
        previousValue: null,
        newValue: {
          processedCategories: results.length,
          results: results.map((item) => ({
            category: item.category,
            status: item.status,
            recordId: item.record?.id ?? null,
          })),
        },
        reason: resolvedReason,
        ...requestAuditFields(requestMeta),
      });
      return {
        calculationVersion: HALL_OF_FAME_CALCULATION_VERSION,
        processedCategories: results.length,
        results,
      };
    },

    getDefinitions() {
      return HALL_OF_FAME_CATEGORIES.map(serializeDefinition);
    },
  });
}

export const hallOfFameService = createHallOfFameService();
