import mongoose from "mongoose";
import { DateTime } from "luxon";
import { AuditLog } from "../models/audit-log.model.js";
import { MatchResult } from "../models/match-result.model.js";
import { Match } from "../models/match.model.js";
import { MVPAward } from "../models/mvp-award.model.js";
import { PlayerStatistics } from "../models/player-statistics.model.js";
import { Player } from "../models/player.model.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/app-error.js";

export const CORE_STATISTICS_VERSION = "core-v1";
const DECIMAL_PRECISION = 6;
const RECALCULATION_BATCH_SIZE = 100;

function round(value, precision = DECIMAL_PRECISION) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function calculateKdr(totalKills, totalDeaths) {
  if (totalDeaths > 0) return round(totalKills / totalDeaths);
  return totalKills > 0 ? totalKills : 0;
}

function matchKdr(kills, deaths) {
  return calculateKdr(kills, deaths);
}

export function calculateCoreMetrics(rows, mvpCount = 0) {
  const matchesPlayed = rows.length;
  const totalKills = rows.reduce((total, row) => total + row.kills, 0);
  const totalDeaths = rows.reduce((total, row) => total + row.deaths, 0);
  const placementTotal = rows.reduce((total, row) => total + row.placement, 0);
  const firstPlaceCount = rows.filter((row) => row.placement === 1).length;
  const lastPlaceCount = rows.filter(
    (row) => row.participantCount > 0 && row.placement === row.participantCount,
  ).length;

  return {
    matchesPlayed,
    totalKills,
    totalDeaths,
    kdr: calculateKdr(totalKills, totalDeaths),
    averageKills: matchesPlayed ? round(totalKills / matchesPlayed) : 0,
    averageDeaths: matchesPlayed ? round(totalDeaths / matchesPlayed) : 0,
    averageRank: matchesPlayed ? round(placementTotal / matchesPlayed) : 0,
    winRate: matchesPlayed ? round((firstPlaceCount / matchesPlayed) * 100) : 0,
    firstPlaceCount,
    lastPlaceCount,
    mvpCount,
  };
}

function record(value = 0, row = null) {
  return {
    value: round(value),
    matchId: row?.matchId ?? null,
    occurredAt: row?.matchDate ?? null,
  };
}

function compareRecordRows(left, right, valueSelector) {
  const valueDifference = valueSelector(right) - valueSelector(left);
  if (valueDifference !== 0) return valueDifference;
  const dateDifference = new Date(left.matchDate) - new Date(right.matchDate);
  if (dateDifference !== 0) return dateDifference;
  return String(left.matchId).localeCompare(String(right.matchId));
}

function leagueDateKey(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(date));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function calculatePersonalRecords(
  rows,
  timezone = env.LEAGUE_TIMEZONE,
  longestMvpStreak = 0,
) {
  if (!rows.length) {
    return {
      highestKills: record(),
      highestDeaths: record(),
      bestKdr: record(),
      longestMvpStreak,
      longestFirstPlaceStreak: 0,
      mostMatchesInOneDay: { value: 0, date: null },
    };
  }

  const highestKillsRow = [...rows].sort((a, b) =>
    compareRecordRows(a, b, (row) => row.kills),
  )[0];
  const highestDeathsRow = [...rows].sort((a, b) =>
    compareRecordRows(a, b, (row) => row.deaths),
  )[0];
  const bestKdrRow = [...rows].sort((a, b) => {
    const ratioDifference = matchKdr(b.kills, b.deaths) - matchKdr(a.kills, a.deaths);
    if (ratioDifference !== 0) return ratioDifference;
    if (b.kills !== a.kills) return b.kills - a.kills;
    if (a.deaths !== b.deaths) return a.deaths - b.deaths;
    return new Date(a.matchDate) - new Date(b.matchDate);
  })[0];

  const orderedRows = [...rows].sort((a, b) => {
    const dateDifference = new Date(a.matchDate) - new Date(b.matchDate);
    if (dateDifference !== 0) return dateDifference;
    return String(a.matchId).localeCompare(String(b.matchId));
  });
  let currentFirstPlaceStreak = 0;
  let longestFirstPlaceStreak = 0;
  for (const row of orderedRows) {
    currentFirstPlaceStreak = row.placement === 1 ? currentFirstPlaceStreak + 1 : 0;
    longestFirstPlaceStreak = Math.max(
      longestFirstPlaceStreak,
      currentFirstPlaceStreak,
    );
  }

  const dailyCounts = new Map();
  for (const row of rows) {
    const key = leagueDateKey(row.matchDate, timezone);
    dailyCounts.set(key, (dailyCounts.get(key) ?? 0) + 1);
  }
  const [mostActiveDate, mostMatches] = [...dailyCounts.entries()].sort(
    ([leftDate, leftCount], [rightDate, rightCount]) =>
      rightCount - leftCount || leftDate.localeCompare(rightDate),
  )[0];

  return {
    highestKills: record(highestKillsRow.kills, highestKillsRow),
    highestDeaths: record(highestDeathsRow.deaths, highestDeathsRow),
    bestKdr: record(matchKdr(bestKdrRow.kills, bestKdrRow.deaths), bestKdrRow),
    longestMvpStreak,
    longestFirstPlaceStreak,
    mostMatchesInOneDay: {
      value: mostMatches,
      date: new Date(`${mostActiveDate}T00:00:00.000Z`),
    },
  };
}

export function calculateLongestMvpStreak(awards, timezone = env.LEAGUE_TIMEZONE) {
  const weeklyAwards = awards
    .filter((award) => award.awardType === "weekly")
    .sort((left, right) => new Date(left.startAt) - new Date(right.startAt));
  let longest = 0;
  let current = 0;
  let previousStart = null;
  for (const award of weeklyAwards) {
    const start = DateTime.fromJSDate(new Date(award.startAt), { zone: timezone });
    const isConsecutive =
      previousStart && Math.round(start.diff(previousStart, "days").days) === 7;
    current = isConsecutive ? current + 1 : 1;
    longest = Math.max(longest, current);
    previousStart = start;
  }
  return longest;
}

function serializeStatistics(document) {
  if (!document) return null;
  const value =
    typeof document.toObject === "function" ? document.toObject() : document;
  return {
    id: String(value._id),
    playerId: String(value.playerId),
    metrics: value.metrics,
    records: value.records,
    globalRank: value.globalRank,
    calculationVersion: value.calculationVersion,
    sourceVerifiedMatchCount: value.sourceVerifiedMatchCount,
    lastVerifiedMatchAt: value.lastVerifiedMatchAt,
    recalculatedAt: value.recalculatedAt,
  };
}

function queryWithSession(query, session) {
  return session ? query.session(session) : query;
}

async function writeRecalculationAudit({
  AuditLogModel,
  actor,
  scope,
  entityId,
  reason,
  result,
  requestMeta,
}) {
  if (!actor) return;
  await AuditLogModel.create({
    actorUserId: actor.id,
    action: "statistics.recalculated",
    entityType: "statistics",
    entityId: `${scope}:${entityId}`,
    previousValue: null,
    newValue: {
      scope,
      calculationVersion: CORE_STATISTICS_VERSION,
      updatedPlayers: result.updatedPlayers,
      playerIds: result.playerIds ?? [],
    },
    reason,
    ipAddress: requestMeta?.ipAddress ?? null,
    userAgent: requestMeta?.userAgent ?? null,
    requestId: requestMeta?.requestId ?? null,
  });
}

export function createStatisticsService({
  PlayerModel = Player,
  MatchModel = Match,
  MatchResultModel = MatchResult,
  PlayerStatisticsModel = PlayerStatistics,
  MVPAwardModel = MVPAward,
  AuditLogModel = AuditLog,
} = {}) {
  async function recalculateGlobalRanks({ session } = {}) {
    const query = PlayerStatisticsModel.find({})
      .select({ _id: 1 })
      .sort({
        "metrics.totalKills": -1,
        "metrics.kdr": -1,
        "metrics.firstPlaceCount": -1,
        "metrics.matchesPlayed": -1,
        playerId: 1,
      })
      .lean();
    const statistics = await queryWithSession(query, session);
    if (!statistics.length) return 0;
    await PlayerStatisticsModel.bulkWrite(
      statistics.map((item, index) => ({
        updateOne: {
          filter: { _id: item._id },
          update: { $set: { globalRank: index + 1 } },
        },
      })),
      session ? { session } : {},
    );
    return statistics.length;
  }

  async function recalculateForPlayerIds(
    playerIds,
    { session, refreshRanks = true } = {},
  ) {
    const uniqueIds = [
      ...new Set(playerIds.filter(Boolean).map((value) => String(value))),
    ].map((value) => new mongoose.Types.ObjectId(value));
    if (!uniqueIds.length) return { updatedPlayers: 0, playerIds: [] };

    const playerQuery = PlayerModel.find({ _id: { $in: uniqueIds } })
      .select({ _id: 1 })
      .lean();
    const players = await queryWithSession(playerQuery, session);
    if (!players.length) return { updatedPlayers: 0, playerIds: [] };
    const existingIds = players.map((player) => String(player._id));

    const resultQuery = MatchResultModel.find({
      status: "verified",
      "official.playerId": { $in: players.map((player) => player._id) },
    })
      .select({ matchId: 1, official: 1, officialMatchDate: 1 })
      .sort({ officialMatchDate: 1, matchId: 1 })
      .lean();
    const results = await queryWithSession(resultQuery, session);
    const matchIds = [...new Set(results.map((row) => String(row.matchId)))].map(
      (value) => new mongoose.Types.ObjectId(value),
    );
    const matchQuery = MatchModel.find({ _id: { $in: matchIds }, status: "verified" })
      .select({ _id: 1, participantCount: 1 })
      .lean();
    const matches = await queryWithSession(matchQuery, session);
    const participantCounts = new Map(
      matches.map((match) => [String(match._id), match.participantCount]),
    );

    const awardQuery = MVPAwardModel.find({
      playerId: { $in: players.map((player) => player._id) },
      status: "current",
    })
      .select({ playerId: 1, awardType: 1, startAt: 1 })
      .sort({ startAt: 1 })
      .lean();
    const awards = await queryWithSession(awardQuery, session);
    const awardsByPlayer = new Map(existingIds.map((id) => [id, []]));
    for (const award of awards) {
      const id = String(award.playerId);
      if (awardsByPlayer.has(id)) awardsByPlayer.get(id).push(award);
    }
    const mvpCounts = new Map(
      [...awardsByPlayer.entries()].map(([id, playerAwards]) => [
        id,
        playerAwards.length,
      ]),
    );
    const mvpStreaks = new Map(
      [...awardsByPlayer.entries()].map(([id, playerAwards]) => [
        id,
        calculateLongestMvpStreak(playerAwards),
      ]),
    );

    const groupedRows = new Map(existingIds.map((id) => [id, []]));
    for (const result of results) {
      const id = String(result.official.playerId);
      if (!groupedRows.has(id)) continue;
      groupedRows.get(id).push({
        matchId: result.matchId,
        matchDate: result.officialMatchDate,
        kills: result.official.kills,
        deaths: result.official.deaths,
        placement: result.official.placement,
        participantCount: participantCounts.get(String(result.matchId)) ?? 0,
      });
    }

    const recalculatedAt = new Date();
    await PlayerStatisticsModel.bulkWrite(
      existingIds.map((playerId) => {
        const rows = groupedRows.get(playerId) ?? [];
        return {
          updateOne: {
            filter: { playerId: new mongoose.Types.ObjectId(playerId) },
            update: {
              $set: {
                metrics: calculateCoreMetrics(rows, mvpCounts.get(playerId) ?? 0),
                records: calculatePersonalRecords(
                  rows,
                  env.LEAGUE_TIMEZONE,
                  mvpStreaks.get(playerId) ?? 0,
                ),
                calculationVersion: CORE_STATISTICS_VERSION,
                sourceVerifiedMatchCount: rows.length,
                lastVerifiedMatchAt: rows.at(-1)?.matchDate ?? null,
                recalculatedAt,
              },
              $setOnInsert: { playerId: new mongoose.Types.ObjectId(playerId) },
            },
            upsert: true,
          },
        };
      }),
      session ? { session } : {},
    );

    if (refreshRanks) await recalculateGlobalRanks({ session });
    return { updatedPlayers: existingIds.length, playerIds: existingIds };
  }

  return Object.freeze({
    recalculateForPlayerIds,
    recalculateGlobalRanks,

    async recalculateForMatch(matchId, { actor, reason, requestMeta } = {}) {
      const rows = await MatchResultModel.find({
        matchId,
        status: "verified",
      })
        .select({ "official.playerId": 1 })
        .lean();
      const result = await recalculateForPlayerIds(
        rows.map((row) => row.official.playerId),
      );
      await writeRecalculationAudit({
        AuditLogModel,
        actor,
        scope: "match",
        entityId: matchId,
        reason,
        result,
        requestMeta,
      });
      return result;
    },

    async recalculateForPlayer(playerId, { actor, reason, requestMeta } = {}) {
      const result = await recalculateForPlayerIds([playerId]);
      await writeRecalculationAudit({
        AuditLogModel,
        actor,
        scope: "player",
        entityId: playerId,
        reason,
        result,
        requestMeta,
      });
      return result;
    },

    async recalculateAll({ actor, reason, requestMeta } = {}) {
      const players = await PlayerModel.find({}).select({ _id: 1 }).lean();
      let updatedPlayers = 0;
      for (let index = 0; index < players.length; index += RECALCULATION_BATCH_SIZE) {
        const batch = players.slice(index, index + RECALCULATION_BATCH_SIZE);
        const result = await recalculateForPlayerIds(
          batch.map((player) => player._id),
          { refreshRanks: false },
        );
        updatedPlayers += result.updatedPlayers;
      }
      await recalculateGlobalRanks();
      const result = {
        calculationVersion: CORE_STATISTICS_VERSION,
        updatedPlayers,
        playerIds: [],
        completedAt: new Date(),
      };
      await writeRecalculationAudit({
        AuditLogModel,
        actor,
        scope: "all",
        entityId: "all",
        reason,
        result,
        requestMeta,
      });
      return result;
    },

    async getPlayerStatisticsByCode(playerCode) {
      const player = await PlayerModel.findOne({ playerId: playerCode })
        .select({ _id: 1, playerId: 1, name: 1 })
        .lean();
      if (!player) {
        throw new AppError({
          statusCode: 404,
          code: "PLAYER_NOT_FOUND",
          message: "Player profile was not found.",
        });
      }
      const statistics = await PlayerStatisticsModel.findOne({
        playerId: player._id,
      }).lean();
      return {
        player: {
          id: String(player._id),
          playerId: player.playerId,
          name: player.name,
        },
        statistics: serializeStatistics(statistics),
      };
    },

    async getOverview() {
      const [summary, totalVerifiedMatches, staleVerifiedMatches] = await Promise.all([
        PlayerStatisticsModel.aggregate([
          {
            $group: {
              _id: null,
              playersWithStatistics: { $sum: 1 },
              totalKills: { $sum: "$metrics.totalKills" },
              totalDeaths: { $sum: "$metrics.totalDeaths" },
              totalPlayerMatchEntries: { $sum: "$metrics.matchesPlayed" },
              totalFirstPlaces: { $sum: "$metrics.firstPlaceCount" },
              latestRecalculatedAt: { $max: "$recalculatedAt" },
            },
          },
        ]),
        MatchModel.countDocuments({ status: "verified" }),
        MatchModel.countDocuments({
          status: "verified",
          "statisticsRecalculation.status": { $ne: "completed" },
        }),
      ]);
      const value = summary[0] ?? {
        playersWithStatistics: 0,
        totalKills: 0,
        totalDeaths: 0,
        totalPlayerMatchEntries: 0,
        totalFirstPlaces: 0,
        latestRecalculatedAt: null,
      };
      return {
        ...value,
        totalVerifiedMatches,
        leagueKdr: calculateKdr(value.totalKills, value.totalDeaths),
        staleVerifiedMatches,
        calculationVersion: CORE_STATISTICS_VERSION,
        timezone: env.LEAGUE_TIMEZONE,
      };
    },
  });
}

export const statisticsService = createStatisticsService();
