import crypto from "node:crypto";
import mongoose from "mongoose";
import { DateTime } from "luxon";
import { env } from "../config/env.js";
import { AuditLog } from "../models/audit-log.model.js";
import { LeaderboardSnapshot } from "../models/leaderboard-snapshot.model.js";
import { LeagueConfig } from "../models/league-config.model.js";
import { MatchResult } from "../models/match-result.model.js";
import { Match } from "../models/match.model.js";
import { PeriodicStatistics } from "../models/periodic-statistics.model.js";
import { PlayerStatistics } from "../models/player-statistics.model.js";
import { Player } from "../models/player.model.js";
import { Season } from "../models/season.model.js";
import { AppError } from "../utils/app-error.js";
import {
  ANALYTICS_CALCULATION_VERSION,
  buildDailyTrend,
  calculateConsistency,
  calculateImprovementRate,
  calculateKillEfficiency,
  calculateMatchPerformanceScore,
  calculateMvpScoreBreakdown,
  enrichPeriodMetrics,
  rankPeriodicEntries,
  roundAnalytics,
  sortLeaderboardEntries,
} from "./analytics-math.service.js";
import { mvpConfigService } from "./mvp-config.service.js";
import {
  formatLeagueDateKey,
  resolveAllTimePeriod,
  resolveMonthlyPeriod,
  resolveSeasonPeriod,
  resolveWeeklyPeriod,
} from "./period.service.js";

const LEADERBOARD_METRICS = new Set([
  "overall",
  "kills",
  "deaths",
  "kdr",
  "activity",
  "first_places",
  "last_places",
  "win_rate",
  "average_rank",
]);
const CACHEABLE_PERIOD_TYPES = new Set(["weekly", "monthly", "season", "all_time"]);
const BASE_METRIC_KEYS = [
  "matchesPlayed",
  "totalKills",
  "totalDeaths",
  "kdr",
  "averageKills",
  "averageDeaths",
  "averageRank",
  "winRate",
  "firstPlaceCount",
  "lastPlaceCount",
  "mvpCount",
];

function hash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function toObjectId(value) {
  if (!mongoose.isValidObjectId(value)) {
    throw new AppError({
      statusCode: 422,
      code: "INVALID_OBJECT_ID",
      message: "A valid MongoDB identifier is required.",
    });
  }
  return new mongoose.Types.ObjectId(value);
}

function serializePeriod(period) {
  return {
    type: period.type,
    key: period.key,
    label: period.label,
    startAt: period.startAt,
    endAt: period.endAt,
    timezone: period.timezone,
    seasonId: period.seasonId ? String(period.seasonId) : null,
  };
}

function serializePlayer(player) {
  return {
    id: String(player._id),
    playerId: player.playerId,
    name: player.name,
    photoUrl: player.profileImage?.secureUrl ?? null,
    status: player.status,
  };
}

function baseMetrics(metrics) {
  return Object.fromEntries(BASE_METRIC_KEYS.map((key) => [key, metrics[key] ?? 0]));
}

function minimumMatchesForMetric(metric, defaultMinimum) {
  return new Set(["overall", "kdr", "win_rate", "average_rank"]).has(metric)
    ? defaultMinimum
    : 1;
}

function compareMatchScore(left, right, direction = "desc") {
  const difference = right.performanceScore - left.performanceScore;
  if (difference !== 0) return direction === "desc" ? difference : -difference;
  if (right.kills !== left.kills) {
    return direction === "desc" ? right.kills - left.kills : left.kills - right.kills;
  }
  if (left.deaths !== right.deaths) {
    return direction === "desc"
      ? left.deaths - right.deaths
      : right.deaths - left.deaths;
  }
  return new Date(left.matchDate) - new Date(right.matchDate);
}

export function createAnalyticsService({
  PlayerModel = Player,
  MatchModel = Match,
  MatchResultModel = MatchResult,
  PlayerStatisticsModel = PlayerStatistics,
  PeriodicStatisticsModel = PeriodicStatistics,
  LeaderboardSnapshotModel = LeaderboardSnapshot,
  LeagueConfigModel = LeagueConfig,
  SeasonModel = Season,
  configService = mvpConfigService,
  AuditLogModel = AuditLog,
} = {}) {
  async function getLeagueSettings() {
    const config = await LeagueConfigModel.findOne({ key: "primary" })
      .select({ timezone: 1, weekStartsOn: 1 })
      .lean();
    return {
      timezone: config?.timezone ?? env.LEAGUE_TIMEZONE,
      weekStartsOn: config?.weekStartsOn ?? 1,
    };
  }

  async function resolvePeriod({ periodType, date, seasonId }) {
    if (!CACHEABLE_PERIOD_TYPES.has(periodType)) {
      throw new AppError({
        statusCode: 422,
        code: "INVALID_PERIOD_TYPE",
        message: "Unsupported analytics period type.",
      });
    }
    const settings = await getLeagueSettings();
    if (periodType === "weekly") {
      return resolveWeeklyPeriod({
        date,
        timezone: settings.timezone,
        weekStartsOn: settings.weekStartsOn,
      });
    }
    if (periodType === "monthly") {
      return resolveMonthlyPeriod({ date, timezone: settings.timezone });
    }
    if (periodType === "season") {
      const season = seasonId
        ? await SeasonModel.findById(toObjectId(seasonId)).lean()
        : await SeasonModel.findOne({ status: "active" }).lean();
      return resolveSeasonPeriod(season);
    }
    const earliest = await MatchResultModel.findOne({ status: "verified" })
      .sort({ officialMatchDate: 1 })
      .select({ officialMatchDate: 1 })
      .lean();
    return resolveAllTimePeriod({
      startAt: earliest?.officialMatchDate ?? new Date(0),
      endAt: new Date(),
      timezone: settings.timezone,
    });
  }

  function previousPeriod(period, weekStartsOn) {
    if (period.type === "weekly") {
      return resolveWeeklyPeriod({
        date: DateTime.fromJSDate(period.startAt).minus({ days: 1 }).toJSDate(),
        timezone: period.timezone,
        weekStartsOn,
      });
    }
    if (period.type === "monthly") {
      return resolveMonthlyPeriod({
        date: DateTime.fromJSDate(period.startAt)
          .setZone(period.timezone)
          .minus({ months: 1 })
          .toJSDate(),
        timezone: period.timezone,
      });
    }
    return null;
  }

  async function getSourceFingerprint(period, formulaVersion) {
    const match = {
      status: "verified",
      officialMatchDate: { $gte: period.startAt, $lt: period.endAt },
    };
    if (period.seasonId) match.officialSeasonId = period.seasonId;
    const aggregate = await MatchResultModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          latestUpdatedAt: { $max: "$updatedAt" },
          killChecksum: { $sum: "$official.kills" },
          deathChecksum: { $sum: "$official.deaths" },
          placementChecksum: { $sum: "$official.placement" },
        },
      },
    ]);
    const source = aggregate[0] ?? {
      count: 0,
      latestUpdatedAt: null,
      killChecksum: 0,
      deathChecksum: 0,
      placementChecksum: 0,
    };
    return hash({
      periodType: period.type,
      periodKey: period.key,
      seasonId: period.seasonId ? String(period.seasonId) : null,
      formulaVersion,
      calculationVersion: ANALYTICS_CALCULATION_VERSION,
      source,
    });
  }

  async function fetchVerifiedRows(period, playerIds = null) {
    const filter = {
      status: "verified",
      officialMatchDate: { $gte: period.startAt, $lt: period.endAt },
    };
    if (period.seasonId) filter.officialSeasonId = period.seasonId;
    if (playerIds?.length) filter["official.playerId"] = { $in: playerIds };

    const results = await MatchResultModel.find(filter)
      .select({
        matchId: 1,
        official: 1,
        officialMatchDate: 1,
        officialSeasonId: 1,
        updatedAt: 1,
      })
      .sort({ officialMatchDate: 1, matchId: 1, rowIndex: 1 })
      .lean();
    if (!results.length) return [];

    const matchIds = [...new Set(results.map((row) => String(row.matchId)))].map(
      (id) => new mongoose.Types.ObjectId(id),
    );
    const matches = await MatchModel.find({
      _id: { $in: matchIds },
      status: "verified",
    })
      .select({ _id: 1, matchCode: 1, participantCount: 1, matchDate: 1 })
      .lean();
    const matchMap = new Map(matches.map((match) => [String(match._id), match]));

    return results
      .filter((result) => matchMap.has(String(result.matchId)))
      .map((result) => {
        const match = matchMap.get(String(result.matchId));
        return {
          resultId: result._id,
          matchId: result.matchId,
          matchCode: match.matchCode,
          playerId: result.official.playerId,
          playerName: result.official.playerName,
          matchDate: result.officialMatchDate,
          kills: result.official.kills,
          deaths: result.official.deaths,
          placement: result.official.placement,
          participantCount: match.participantCount,
          seasonId: result.officialSeasonId,
          updatedAt: result.updatedAt,
        };
      });
  }

  async function loadPlayers(playerIds) {
    if (!playerIds.length) return new Map();
    const players = await PlayerModel.find({ _id: { $in: playerIds } })
      .select({ playerId: 1, name: 1, profileImage: 1, status: 1 })
      .lean();
    return new Map(players.map((player) => [String(player._id), player]));
  }

  function calculateEntries(rows, config, previousEntries = new Map()) {
    const grouped = new Map();
    for (const row of rows) {
      const playerId = String(row.playerId);
      if (!grouped.has(playerId)) grouped.set(playerId, []);
      grouped.get(playerId).push(row);
    }

    const entries = [...grouped.entries()].map(([playerId, playerRows]) => {
      const metrics = enrichPeriodMetrics(playerRows);
      const breakdown = calculateMvpScoreBreakdown(metrics, config);
      const previous = previousEntries.get(playerId) ?? null;
      const minimumMatchesMet = metrics.matchesPlayed >= config.minimumMatches;
      const previousMinimumMet =
        previous?.metrics?.matchesPlayed >= config.minimumMatches;
      return {
        playerId,
        metrics,
        performanceScore: breakdown.totalScore,
        scoreBreakdown: breakdown,
        previousPerformanceScore: previous?.performanceScore ?? null,
        previousPeriodRank: previous?.rank ?? null,
        improvementRate:
          minimumMatchesMet && previousMinimumMet
            ? calculateImprovementRate(
                breakdown.totalScore / metrics.matchesPlayed,
                previous.performanceScore / previous.metrics.matchesPlayed,
              )
            : null,
        minimumMatchesMet,
      };
    });

    const eligible = rankPeriodicEntries(
      entries.filter((entry) => entry.minimumMatchesMet),
    );
    const rankMap = new Map(eligible.map((entry) => [entry.playerId, entry.rank]));
    return entries.map((entry) => ({
      ...entry,
      rank: rankMap.get(entry.playerId) ?? null,
    }));
  }

  async function persistPeriodEntries(period, entries, sourceDataHash) {
    const playerIds = entries.map(
      (entry) => new mongoose.Types.ObjectId(entry.playerId),
    );
    if (entries.length) {
      await PeriodicStatisticsModel.bulkWrite(
        entries.map((entry) => ({
          updateOne: {
            filter: {
              playerId: new mongoose.Types.ObjectId(entry.playerId),
              periodType: period.type,
              periodKey: period.key,
            },
            update: {
              $set: {
                startAt: period.startAt,
                endAt: period.endAt,
                timezone: period.timezone,
                seasonId: period.seasonId ?? null,
                metrics: baseMetrics(entry.metrics),
                placementCounts: {
                  secondPlaceCount: entry.metrics.secondPlaceCount,
                  thirdPlaceCount: entry.metrics.thirdPlaceCount,
                },
                performanceScore: entry.performanceScore,
                previousPerformanceScore: entry.previousPerformanceScore,
                rank: entry.rank,
                previousPeriodRank: entry.previousPeriodRank,
                improvementRate: entry.improvementRate,
                minimumMatchesMet: entry.minimumMatchesMet,
                calculationVersion: ANALYTICS_CALCULATION_VERSION,
                sourceDataHash,
                sourceVerifiedMatchCount: entry.metrics.matchesPlayed,
                recalculatedAt: new Date(),
              },
              $setOnInsert: {
                playerId: new mongoose.Types.ObjectId(entry.playerId),
                periodType: period.type,
                periodKey: period.key,
              },
            },
            upsert: true,
          },
        })),
      );
    }
    await PeriodicStatisticsModel.deleteMany({
      periodType: period.type,
      periodKey: period.key,
      ...(playerIds.length ? { playerId: { $nin: playerIds } } : {}),
    });
  }

  function hydratePeriodDocument(document, players) {
    const player = players.get(String(document.playerId));
    if (!player) return null;
    return {
      playerId: String(document.playerId),
      player: serializePlayer(player),
      metrics: {
        ...document.metrics,
        secondPlaceCount: document.placementCounts?.secondPlaceCount ?? 0,
        thirdPlaceCount: document.placementCounts?.thirdPlaceCount ?? 0,
      },
      performanceScore: document.performanceScore,
      previousPerformanceScore: document.previousPerformanceScore,
      rank: document.rank,
      previousPeriodRank: document.previousPeriodRank,
      improvementRate: document.improvementRate,
      minimumMatchesMet: document.minimumMatchesMet,
      sourceDataHash: document.sourceDataHash,
      recalculatedAt: document.recalculatedAt,
    };
  }

  async function ensurePeriodStatistics(
    period,
    { force = false, includeImprovement = true } = {},
  ) {
    const config = await configService.getActiveConfig();
    const sourceDataHash = await getSourceFingerprint(period, config.version);
    if (!force) {
      const cached = await PeriodicStatisticsModel.findOne({
        periodType: period.type,
        periodKey: period.key,
        calculationVersion: ANALYTICS_CALCULATION_VERSION,
        sourceDataHash,
      })
        .select({ _id: 1 })
        .lean();
      if (cached) {
        const documents = await PeriodicStatisticsModel.find({
          periodType: period.type,
          periodKey: period.key,
          calculationVersion: ANALYTICS_CALCULATION_VERSION,
          sourceDataHash,
        }).lean();
        const players = await loadPlayers(documents.map((item) => item.playerId));
        return {
          period,
          sourceDataHash,
          config,
          entries: documents
            .map((document) => hydratePeriodDocument(document, players))
            .filter(Boolean),
          cacheHit: true,
        };
      }
    }

    let previousMap = new Map();
    if (includeImprovement && ["weekly", "monthly"].includes(period.type)) {
      const settings = await getLeagueSettings();
      const previous = previousPeriod(period, settings.weekStartsOn);
      const previousResult = await ensurePeriodStatistics(previous, {
        force,
        includeImprovement: false,
      });
      previousMap = new Map(
        previousResult.entries.map((entry) => [entry.playerId, entry]),
      );
    }

    const rows = await fetchVerifiedRows(period);
    const calculated = calculateEntries(rows, config, previousMap);
    await persistPeriodEntries(period, calculated, sourceDataHash);
    const players = await loadPlayers(
      calculated.map((entry) => new mongoose.Types.ObjectId(entry.playerId)),
    );
    return {
      period,
      sourceDataHash,
      config,
      entries: calculated
        .map((entry) => ({
          ...entry,
          player: players.has(entry.playerId)
            ? serializePlayer(players.get(entry.playerId))
            : null,
        }))
        .filter((entry) => entry.player),
      rows,
      cacheHit: false,
    };
  }

  async function getLeaderboard({
    metric,
    periodType,
    date,
    seasonId,
    page = 1,
    limit = 10,
    force = false,
  }) {
    if (!LEADERBOARD_METRICS.has(metric)) {
      throw new AppError({
        statusCode: 422,
        code: "INVALID_LEADERBOARD_METRIC",
        message: "Unsupported leaderboard metric.",
      });
    }
    const period = await resolvePeriod({ periodType, date, seasonId });
    const result = await ensurePeriodStatistics(period, { force });
    const minimumMatches = minimumMatchesForMetric(
      metric,
      result.config.minimumMatches,
    );
    const eligible = result.entries.filter(
      (entry) => entry.metrics.matchesPlayed >= minimumMatches,
    );
    const ranked = sortLeaderboardEntries(eligible, metric);
    const snapshotEntries = ranked.map((entry) => ({
      rank: entry.leaderboardRank,
      playerId: new mongoose.Types.ObjectId(entry.playerId),
      playerName: entry.player.name,
      playerCode: entry.player.playerId,
      photoUrl: entry.player.photoUrl,
      value: entry.leaderboardValue,
      matchesPlayed: entry.metrics.matchesPlayed,
      tieBreak: {
        firstPlaceCount: entry.metrics.firstPlaceCount,
        totalKills: entry.metrics.totalKills,
        totalDeaths: entry.metrics.totalDeaths,
        performanceScore: entry.performanceScore,
      },
    }));
    await LeaderboardSnapshotModel.findOneAndUpdate(
      {
        metric,
        periodType: period.type,
        periodKey: period.key,
        calculationVersion: ANALYTICS_CALCULATION_VERSION,
      },
      {
        $set: {
          startAt: period.startAt,
          endAt: period.endAt,
          timezone: period.timezone,
          seasonId: period.seasonId ?? null,
          minimumMatches,
          entries: snapshotEntries,
          sourceDataHash: result.sourceDataHash,
          generatedAt: new Date(),
        },
        $setOnInsert: {
          metric,
          periodType: period.type,
          periodKey: period.key,
          calculationVersion: ANALYTICS_CALCULATION_VERSION,
        },
      },
      { upsert: true },
    );
    const totalItems = ranked.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * limit;
    return {
      period: serializePeriod(period),
      metric,
      minimumMatches,
      entries: ranked.slice(offset, offset + limit).map((entry) => ({
        rank: entry.leaderboardRank,
        player: entry.player,
        value: entry.leaderboardValue,
        metrics: entry.metrics,
        performanceScore: entry.performanceScore,
      })),
      pagination: {
        page: safePage,
        limit,
        totalItems,
        totalPages,
        hasNextPage: safePage < totalPages,
        hasPreviousPage: safePage > 1,
      },
      cacheHit: result.cacheHit,
      generatedAt: new Date(),
      calculationVersion: ANALYTICS_CALCULATION_VERSION,
    };
  }

  async function getMostImproved({ periodType, date, limit = 10 }) {
    if (!["weekly", "monthly"].includes(periodType)) {
      throw new AppError({
        statusCode: 422,
        code: "INVALID_IMPROVEMENT_PERIOD",
        message: "Most-improved analytics supports weekly or monthly periods.",
      });
    }
    const period = await resolvePeriod({ periodType, date });
    const result = await ensurePeriodStatistics(period);
    const entries = result.entries
      .filter(
        (entry) => entry.minimumMatchesMet && Number.isFinite(entry.improvementRate),
      )
      .sort(
        (left, right) =>
          right.improvementRate - left.improvementRate ||
          right.performanceScore - left.performanceScore,
      )
      .slice(0, limit)
      .map((entry, index) => ({
        rank: index + 1,
        player: entry.player,
        improvementRate: entry.improvementRate,
        currentPerformanceScore: entry.performanceScore,
        previousPerformanceScore: entry.previousPerformanceScore,
        currentRank: entry.rank,
        previousRank: entry.previousPeriodRank,
        matchesPlayed: entry.metrics.matchesPlayed,
      }));
    return { period: serializePeriod(period), entries };
  }

  async function getPeriodAnalytics({ periodType, date, seasonId }) {
    const period = await resolvePeriod({ periodType, date, seasonId });
    const result = await ensurePeriodStatistics(period);
    const rows = result.rows ?? (await fetchVerifiedRows(period));
    const uniqueMatches = new Set(rows.map((row) => String(row.matchId))).size;
    const totals = result.entries.reduce(
      (summary, entry) => {
        summary.totalKills += entry.metrics.totalKills;
        summary.totalDeaths += entry.metrics.totalDeaths;
        summary.firstPlaces += entry.metrics.firstPlaceCount;
        summary.lastPlaces += entry.metrics.lastPlaceCount;
        return summary;
      },
      { totalKills: 0, totalDeaths: 0, firstPlaces: 0, lastPlaces: 0 },
    );
    const topPlayers = sortLeaderboardEntries(
      result.entries.filter((entry) => entry.minimumMatchesMet),
      "overall",
    )
      .slice(0, 3)
      .map((entry) => ({
        rank: entry.leaderboardRank,
        player: entry.player,
        performanceScore: entry.performanceScore,
        metrics: entry.metrics,
      }));
    const mostImproved = ["weekly", "monthly"].includes(period.type)
      ? ((await getMostImproved({ periodType: period.type, date, limit: 1 }))
          .entries[0] ?? null)
      : null;
    return {
      period: serializePeriod(period),
      totals: {
        verifiedMatches: uniqueMatches,
        participatingPlayers: result.entries.length,
        ...totals,
        leagueKdr:
          totals.totalDeaths > 0
            ? roundAnalytics(totals.totalKills / totals.totalDeaths)
            : totals.totalKills,
      },
      topPlayers,
      mostImproved,
      cacheHit: result.cacheHit,
      calculationVersion: ANALYTICS_CALCULATION_VERSION,
    };
  }

  async function getPlayerPerformance(playerCode, { range = "30d", date } = {}) {
    const player = await PlayerModel.findOne({ playerId: playerCode })
      .select({ playerId: 1, name: 1, profileImage: 1, status: 1 })
      .lean();
    if (!player) {
      throw new AppError({
        statusCode: 404,
        code: "PLAYER_NOT_FOUND",
        message: "Player profile was not found.",
      });
    }
    const settings = await getLeagueSettings();
    const dayCount = range === "7d" ? 7 : 30;
    const end = DateTime.fromJSDate(date ? new Date(date) : new Date(), {
      zone: settings.timezone,
    })
      .startOf("day")
      .plus({ days: 1 });
    const start = end.minus({ days: dayCount });
    const period = {
      type: "custom",
      key: `${range}:${start.toFormat("yyyy-LL-dd")}`,
      label: `Last ${dayCount} days`,
      startAt: start.toUTC().toJSDate(),
      endAt: end.toUTC().toJSDate(),
      timezone: settings.timezone,
      seasonId: null,
    };
    const rows = await fetchVerifiedRows(period, [player._id]);
    const metrics = enrichPeriodMetrics(rows);
    const currentWeek = await ensurePeriodStatistics(
      resolveWeeklyPeriod({
        date,
        timezone: settings.timezone,
        weekStartsOn: settings.weekStartsOn,
      }),
    );
    const currentMonth = await ensurePeriodStatistics(
      resolveMonthlyPeriod({ date, timezone: settings.timezone }),
    );
    const allTime = await ensurePeriodStatistics(
      await resolvePeriod({ periodType: "all_time" }),
    );
    const activeSeason = await SeasonModel.findOne({ status: "active" }).lean();
    const seasonResult = activeSeason
      ? await ensurePeriodStatistics(resolveSeasonPeriod(activeSeason))
      : null;
    const findRank = (collection) =>
      collection?.entries.find((entry) => entry.playerId === String(player._id))
        ?.rank ?? null;
    return {
      player: serializePlayer(player),
      period: serializePeriod(period),
      metrics,
      trend: buildDailyTrend(rows, period),
      rankings: {
        global: findRank(allTime),
        weekly: findRank(currentWeek),
        monthly: findRank(currentMonth),
        season: findRank(seasonResult),
      },
    };
  }

  async function getAdvancedPlayerAnalytics(playerCode) {
    const player = await PlayerModel.findOne({ playerId: playerCode })
      .select({ playerId: 1, name: 1, profileImage: 1, status: 1 })
      .lean();
    if (!player) {
      throw new AppError({
        statusCode: 404,
        code: "PLAYER_NOT_FOUND",
        message: "Player profile was not found.",
      });
    }
    const period = await resolvePeriod({ periodType: "all_time" });
    const rows = await fetchVerifiedRows(period, [player._id]);
    const config = await configService.getActiveConfig();
    const scored = rows.map((row) => ({
      ...row,
      performanceScore: calculateMatchPerformanceScore(row, config),
    }));
    const best = [...scored].sort((a, b) => compareMatchScore(a, b, "desc"))[0] ?? null;
    const worst = [...scored].sort((a, b) => compareMatchScore(a, b, "asc"))[0] ?? null;
    const settings = await getLeagueSettings();
    const daily = new Map();
    const weekly = new Map();
    const monthly = new Map();
    for (const row of scored) {
      const dayKey = formatLeagueDateKey(row.matchDate, settings.timezone);
      daily.set(dayKey, (daily.get(dayKey) ?? 0) + 1);
      const week = resolveWeeklyPeriod({
        date: row.matchDate,
        timezone: settings.timezone,
        weekStartsOn: settings.weekStartsOn,
      });
      const month = resolveMonthlyPeriod({
        date: row.matchDate,
        timezone: settings.timezone,
      });
      for (const [collection, key] of [
        [weekly, week.key],
        [monthly, month.key],
      ]) {
        const value = collection.get(key) ?? { matches: 0, totalScore: 0 };
        value.matches += 1;
        value.totalScore += row.performanceScore;
        collection.set(key, value);
      }
    }
    const selectBestPeriod = (collection, minimumMatches) =>
      [...collection.entries()]
        .filter(([, value]) => value.matches >= minimumMatches)
        .map(([key, value]) => ({
          periodKey: key,
          matchesPlayed: value.matches,
          averagePerformanceScore: roundAnalytics(value.totalScore / value.matches),
          totalPerformanceScore: roundAnalytics(value.totalScore),
        }))
        .sort(
          (left, right) =>
            right.averagePerformanceScore - left.averagePerformanceScore ||
            right.totalPerformanceScore - left.totalPerformanceScore,
        )[0] ?? null;
    const now = DateTime.now().setZone(settings.timezone).endOf("day");
    const currentStart = now.minus({ days: 30 });
    const previousStart = currentStart.minus({ days: 30 });
    const averageScore = (items) =>
      items.length
        ? items.reduce((sum, item) => sum + item.performanceScore, 0) / items.length
        : 0;
    const currentRows = scored.filter(
      (row) => DateTime.fromJSDate(row.matchDate) >= currentStart,
    );
    const previousRows = scored.filter((row) => {
      const value = DateTime.fromJSDate(row.matchDate);
      return value >= previousStart && value < currentStart;
    });
    const improvementRate =
      currentRows.length >= config.minimumMatches &&
      previousRows.length >= config.minimumMatches
        ? calculateImprovementRate(
            averageScore(currentRows),
            averageScore(previousRows),
          )
        : null;
    const mostActiveDay =
      [...daily.entries()]
        .sort(
          ([leftDate, leftCount], [rightDate, rightCount]) =>
            rightCount - leftCount || leftDate.localeCompare(rightDate),
        )
        .map(([dateKey, matchesPlayed]) => ({ dateKey, matchesPlayed }))[0] ?? null;
    return {
      player: serializePlayer(player),
      formulaVersion: config.version,
      definitions: {
        bestWorstMatch: "Configured MVP match score without the period activity bonus.",
        killEfficiency: "Kills divided by kills plus deaths, multiplied by 100.",
        consistency:
          "100 divided by 1 plus the coefficient of variation of match performance scores; one-match samples return 50.",
        improvement:
          "Average match performance score over the latest 30 days compared with the preceding 30 days; both windows require the configured minimum matches.",
      },
      bestMatch: best
        ? {
            matchId: String(best.matchId),
            matchCode: best.matchCode,
            matchDate: best.matchDate,
            kills: best.kills,
            deaths: best.deaths,
            placement: best.placement,
            performanceScore: best.performanceScore,
          }
        : null,
      worstMatch: worst
        ? {
            matchId: String(worst.matchId),
            matchCode: worst.matchCode,
            matchDate: worst.matchDate,
            kills: worst.kills,
            deaths: worst.deaths,
            placement: worst.placement,
            performanceScore: worst.performanceScore,
          }
        : null,
      mostActiveDay,
      bestWeek: selectBestPeriod(weekly, config.minimumMatches),
      bestMonth: selectBestPeriod(monthly, config.minimumMatches),
      killEfficiency: calculateKillEfficiency(
        rows.reduce((sum, row) => sum + row.kills, 0),
        rows.reduce((sum, row) => sum + row.deaths, 0),
      ),
      consistencyScore: calculateConsistency(scored.map((row) => row.performanceScore)),
      improvement: {
        currentMatches: currentRows.length,
        previousMatches: previousRows.length,
        currentAverageScore: roundAnalytics(averageScore(currentRows)),
        previousAverageScore: roundAnalytics(averageScore(previousRows)),
        improvementRate,
      },
    };
  }

  return Object.freeze({
    resolvePeriod,
    ensurePeriodStatistics,
    getLeaderboard,
    getMostImproved,
    getPeriodAnalytics,
    getPlayerPerformance,
    getAdvancedPlayerAnalytics,

    async recalculatePeriod(input, actor = null, requestMeta = {}) {
      const { reason = null, ...periodInput } = input;
      const period = await resolvePeriod(periodInput);
      const result = await ensurePeriodStatistics(period, { force: true });
      const deletedSnapshots = await LeaderboardSnapshotModel.deleteMany({
        periodType: period.type,
        periodKey: period.key,
      });
      const recalculation = {
        period: serializePeriod(period),
        updatedPlayers: result.entries.length,
        invalidatedLeaderboardSnapshots: deletedSnapshots.deletedCount ?? 0,
        sourceDataHash: result.sourceDataHash,
        calculationVersion: ANALYTICS_CALCULATION_VERSION,
      };
      if (actor) {
        await AuditLogModel.create({
          actorUserId: actor.id,
          action: "statistics.recalculated",
          entityType: "analytics_period",
          entityId: `${period.type}:${period.key}`,
          previousValue: null,
          newValue: recalculation,
          reason,
          ipAddress: requestMeta.ipAddress ?? null,
          userAgent: requestMeta.userAgent ?? null,
          requestId: requestMeta.requestId ?? null,
        });
      }
      return recalculation;
    },

    async getGlobalOverview() {
      const [leaderboard, overview] = await Promise.all([
        getLeaderboard({
          metric: "overall",
          periodType: "all_time",
          page: 1,
          limit: 10,
        }),
        PlayerStatisticsModel.aggregate([
          {
            $group: {
              _id: null,
              players: { $sum: 1 },
              totalKills: { $sum: "$metrics.totalKills" },
              totalDeaths: { $sum: "$metrics.totalDeaths" },
              totalFirstPlaces: { $sum: "$metrics.firstPlaceCount" },
            },
          },
        ]),
      ]);
      return {
        leaderboard,
        totals: overview[0] ?? {
          players: 0,
          totalKills: 0,
          totalDeaths: 0,
          totalFirstPlaces: 0,
        },
      };
    },
  });
}

export const analyticsService = createAnalyticsService();
