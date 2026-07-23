import crypto from "node:crypto";
import { createPaginationMeta } from "@mini-militia/shared";
import { AuditLog } from "../models/audit-log.model.js";
import { MatchResult } from "../models/match-result.model.js";
import { Match } from "../models/match.model.js";
import { Player } from "../models/player.model.js";
import { RivalryStatistics } from "../models/rivalry-statistics.model.js";
import { Season } from "../models/season.model.js";
import { AppError } from "../utils/app-error.js";
import {
  buildRivalriesFromMatches,
  compareHeadToHead,
  normalizedPairKey,
  RIVALRY_CALCULATION_VERSION,
  selectRivalOfPeriod,
} from "./rivalry-math.service.js";
import {
  resolveAllTimePeriod,
  resolveMonthlyPeriod,
  resolveSeasonPeriod,
  resolveWeeklyPeriod,
} from "./period.service.js";

function publicPlayer(player) {
  if (!player) return null;
  return {
    id: String(player._id),
    playerId: player.playerId,
    name: player.name,
    photoUrl: player.profileImage?.secureUrl ?? null,
    status: player.status,
  };
}

function notFound(code = "PLAYER_NOT_FOUND", message = "Player was not found.") {
  return new AppError({ statusCode: 404, code, message });
}

function periodFilter(period) {
  const filter = {
    status: "verified",
    officialMatchDate: { $gte: period.startAt, $lt: period.endAt },
    "official.playerId": { $type: "objectId" },
  };
  if (period.type === "season" && period.seasonId) {
    filter.officialSeasonId = period.seasonId;
  }
  return filter;
}

function groupRows(rows) {
  const matches = new Map();
  for (const row of rows) {
    const key = String(row.matchId);
    const entry = matches.get(key) ?? {
      matchId: key,
      matchDate: row.officialMatchDate,
      results: [],
    };
    entry.results.push({
      playerId: String(row.official.playerId),
      playerName: row.official.playerName,
      kills: row.official.kills,
      deaths: row.official.deaths,
      placement: row.official.placement,
    });
    matches.set(key, entry);
  }
  return [...matches.values()].filter((match) => match.results.length >= 2);
}

function hashSource(summary) {
  return crypto.createHash("sha256").update(JSON.stringify(summary)).digest("hex");
}

function toCacheDocument(rivalry, period, sourceDataHash) {
  return {
    pairKey: rivalry.pairKey,
    periodType: period.type,
    periodKey: period.key,
    periodStartAt: period.startAt,
    periodEndAt: period.endAt,
    timezone: period.timezone,
    seasonId: period.seasonId ?? null,
    playerA: rivalry.playerA,
    playerB: rivalry.playerB,
    sharedMatches: rivalry.sharedMatches,
    draws: rivalry.draws,
    combinedKills: rivalry.combinedKills,
    winDifference: rivalry.winDifference,
    competitivenessScore: rivalry.competitivenessScore,
    lastSharedMatchAt: rivalry.lastSharedMatchAt,
    calculationVersion: RIVALRY_CALCULATION_VERSION,
    sourceDataHash,
    recalculatedAt: new Date(),
  };
}

function orientRivalry(document, playerId, playersById) {
  const value =
    typeof document?.toObject === "function" ? document.toObject() : document;
  const requestedId = String(playerId);
  const playerIsA = String(value.playerA.playerId) === requestedId;
  const selfSide = playerIsA ? value.playerA : value.playerB;
  const opponentSide = playerIsA ? value.playerB : value.playerA;
  const opponent = playersById.get(String(opponentSide.playerId));
  return {
    id: value._id ? String(value._id) : undefined,
    pairKey: value.pairKey,
    period: {
      type: value.periodType,
      key: value.periodKey,
      startAt: value.periodStartAt,
      endAt: value.periodEndAt,
      timezone: value.timezone,
    },
    player: {
      ...publicPlayer(playersById.get(requestedId)),
      headToHeadWins: selfSide.headToHeadWins,
      totalKills: selfSide.totalKills,
      totalDeaths: selfSide.totalDeaths,
      kdr: selfSide.kdr,
    },
    opponent: {
      ...publicPlayer(opponent),
      headToHeadWins: opponentSide.headToHeadWins,
      totalKills: opponentSide.totalKills,
      totalDeaths: opponentSide.totalDeaths,
      kdr: opponentSide.kdr,
    },
    sharedMatches: value.sharedMatches,
    wins: selfSide.headToHeadWins,
    losses: opponentSide.headToHeadWins,
    draws: value.draws,
    winRate: value.sharedMatches
      ? Number(((selfSide.headToHeadWins / value.sharedMatches) * 100).toFixed(2))
      : 0,
    combinedKills: value.combinedKills,
    winDifference: value.winDifference,
    competitivenessScore: value.competitivenessScore,
    leader:
      selfSide.headToHeadWins === opponentSide.headToHeadWins
        ? "tied"
        : selfSide.headToHeadWins > opponentSide.headToHeadWins
          ? "player"
          : "opponent",
    lastSharedMatchAt: value.lastSharedMatchAt,
    calculationVersion: value.calculationVersion,
    recalculatedAt: value.recalculatedAt,
  };
}

export function createRivalryService({
  RivalryStatisticsModel = RivalryStatistics,
  MatchResultModel = MatchResult,
  MatchModel = Match,
  PlayerModel = Player,
  SeasonModel = Season,
  AuditLogModel = AuditLog,
} = {}) {
  async function resolvePlayer(playerCode) {
    const player = await PlayerModel.findOne({
      playerId: String(playerCode).toUpperCase(),
    })
      .select({ playerId: 1, name: 1, profileImage: 1, status: 1 })
      .lean();
    if (!player) throw notFound();
    return player;
  }

  async function resolvePeriod({ periodType = "all_time", date, seasonId } = {}) {
    if (periodType === "weekly") return resolveWeeklyPeriod({ date });
    if (periodType === "monthly") return resolveMonthlyPeriod({ date });
    if (periodType === "season") {
      const season = await SeasonModel.findById(seasonId).lean();
      return resolveSeasonPeriod(season);
    }
    return resolveAllTimePeriod({ endAt: new Date(Date.now() + 1) });
  }

  async function getSourceHash(period) {
    const [summary] = await MatchResultModel.aggregate([
      { $match: periodFilter(period) },
      {
        $group: {
          _id: null,
          resultCount: { $sum: 1 },
          matchIds: { $addToSet: "$matchId" },
          latestUpdatedAt: { $max: "$updatedAt" },
          latestMatchDate: { $max: "$officialMatchDate" },
        },
      },
      {
        $project: {
          _id: 0,
          resultCount: 1,
          matchCount: { $size: "$matchIds" },
          latestUpdatedAt: 1,
          latestMatchDate: 1,
        },
      },
    ]);
    return hashSource({
      calculationVersion: RIVALRY_CALCULATION_VERSION,
      periodType: period.type,
      periodKey: period.key,
      summary: summary ?? { resultCount: 0, matchCount: 0 },
    });
  }

  async function recalculatePeriod(period, { force = false } = {}) {
    const sourceDataHash = await getSourceHash(period);
    if (!force) {
      const cached = await RivalryStatisticsModel.findOne({
        periodType: period.type,
        periodKey: period.key,
        sourceDataHash,
        calculationVersion: RIVALRY_CALCULATION_VERSION,
      })
        .select({ _id: 1 })
        .lean();
      if (cached) {
        return { sourceDataHash, recalculated: false };
      }
    }

    const rows = await MatchResultModel.find(periodFilter(period))
      .select({ matchId: 1, official: 1, officialMatchDate: 1, updatedAt: 1 })
      .sort({ officialMatchDate: 1, rowIndex: 1 })
      .lean();
    const rivalries = buildRivalriesFromMatches(groupRows(rows));
    const pairKeys = rivalries.map((item) => item.pairKey);
    const operations = rivalries.map((rivalry) => ({
      updateOne: {
        filter: {
          pairKey: rivalry.pairKey,
          periodType: period.type,
          periodKey: period.key,
        },
        update: { $set: toCacheDocument(rivalry, period, sourceDataHash) },
        upsert: true,
      },
    }));
    if (operations.length) {
      await RivalryStatisticsModel.bulkWrite(operations, { ordered: false });
    }
    await RivalryStatisticsModel.deleteMany({
      periodType: period.type,
      periodKey: period.key,
      ...(pairKeys.length ? { pairKey: { $nin: pairKeys } } : {}),
    });
    return {
      sourceDataHash,
      recalculated: true,
      pairCount: rivalries.length,
      matchCount: groupRows(rows).length,
    };
  }

  async function loadPlayerMap(ids) {
    const players = await PlayerModel.find({ _id: { $in: ids } })
      .select({ playerId: 1, name: 1, profileImage: 1, status: 1 })
      .lean();
    return new Map(players.map((player) => [String(player._id), player]));
  }

  async function listForPlayer(playerCode, query = {}) {
    const player = await resolvePlayer(playerCode);
    const period = await resolvePeriod(query);
    await recalculatePeriod(period);
    const filter = {
      periodType: period.type,
      periodKey: period.key,
      $or: [{ "playerA.playerId": player._id }, { "playerB.playerId": player._id }],
    };
    const skip = (query.page - 1) * query.limit;
    const [documents, totalItems] = await Promise.all([
      RivalryStatisticsModel.find(filter)
        .sort({ sharedMatches: -1, competitivenessScore: -1, combinedKills: -1 })
        .skip(skip)
        .limit(query.limit)
        .lean(),
      RivalryStatisticsModel.countDocuments(filter),
    ]);
    const opponentIds = documents.map((item) =>
      String(item.playerA.playerId) === String(player._id)
        ? item.playerB.playerId
        : item.playerA.playerId,
    );
    const playersById = await loadPlayerMap([player._id, ...opponentIds]);
    return {
      player: publicPlayer(player),
      period,
      items: documents.map((item) => orientRivalry(item, player._id, playersById)),
      pagination: createPaginationMeta({
        page: query.page,
        limit: query.limit,
        totalItems,
      }),
    };
  }

  async function getComparison(playerCode, opponentCode, query = {}) {
    const [player, opponent] = await Promise.all([
      resolvePlayer(playerCode),
      resolvePlayer(opponentCode),
    ]);
    if (String(player._id) === String(opponent._id)) {
      throw new AppError({
        statusCode: 422,
        code: "RIVALRY_SELF_COMPARISON",
        message: "A player cannot be compared with the same player.",
      });
    }
    const period = await resolvePeriod(query);
    await recalculatePeriod(period);
    const document = await RivalryStatisticsModel.findOne({
      pairKey: normalizedPairKey(player._id, opponent._id),
      periodType: period.type,
      periodKey: period.key,
    }).lean();
    if (!document) {
      throw notFound(
        "RIVALRY_NOT_FOUND",
        "These players do not share a verified match in the selected period.",
      );
    }
    const playersById = new Map([
      [String(player._id), player],
      [String(opponent._id), opponent],
    ]);
    return orientRivalry(document, player._id, playersById);
  }

  async function getHeadToHeadMatches(playerCode, opponentCode, query = {}) {
    const [player, opponent] = await Promise.all([
      resolvePlayer(playerCode),
      resolvePlayer(opponentCode),
    ]);
    const period = await resolvePeriod(query);
    const baseFilter = periodFilter(period);
    const playerRows = await MatchResultModel.find({
      ...baseFilter,
      "official.playerId": player._id,
    })
      .select({ matchId: 1, official: 1, officialMatchDate: 1 })
      .sort({ officialMatchDate: -1 })
      .lean();
    const matchIds = playerRows.map((item) => item.matchId);
    const opponentRows = await MatchResultModel.find({
      ...baseFilter,
      matchId: { $in: matchIds },
      "official.playerId": opponent._id,
    })
      .select({ matchId: 1, official: 1, officialMatchDate: 1 })
      .lean();
    const opponentByMatch = new Map(
      opponentRows.map((item) => [String(item.matchId), item]),
    );
    const shared = playerRows
      .filter((item) => opponentByMatch.has(String(item.matchId)))
      .map((item) => {
        const other = opponentByMatch.get(String(item.matchId));
        const playerResult = {
          playerId: String(player._id),
          kills: item.official.kills,
          deaths: item.official.deaths,
          placement: item.official.placement,
        };
        const opponentResult = {
          playerId: String(opponent._id),
          kills: other.official.kills,
          deaths: other.official.deaths,
          placement: other.official.placement,
        };
        const outcome = compareHeadToHead(playerResult, opponentResult);
        return {
          matchId: String(item.matchId),
          matchDate: item.officialMatchDate,
          outcome: outcome === "left" ? "win" : outcome === "right" ? "loss" : "draw",
          playerResult,
          opponentResult,
        };
      });
    const totalItems = shared.length;
    const start = (query.page - 1) * query.limit;
    const pageItems = shared.slice(start, start + query.limit);
    const matches = await MatchModel.find({
      _id: { $in: pageItems.map((item) => item.matchId) },
      status: "verified",
    })
      .select({ matchCode: 1, screenshot: 1, matchDate: 1, participantCount: 1 })
      .lean();
    const matchById = new Map(matches.map((match) => [String(match._id), match]));
    return {
      player: publicPlayer(player),
      opponent: publicPlayer(opponent),
      period,
      items: pageItems.map((item) => ({
        ...item,
        match: matchById.has(item.matchId)
          ? {
              id: item.matchId,
              matchCode: matchById.get(item.matchId).matchCode,
              screenshotUrl: matchById.get(item.matchId).screenshot?.secureUrl ?? null,
              participantCount: matchById.get(item.matchId).participantCount,
            }
          : { id: item.matchId },
      })),
      pagination: createPaginationMeta({
        page: query.page,
        limit: query.limit,
        totalItems,
      }),
    };
  }

  async function getRivalOfWeek({ date } = {}) {
    const period = await resolvePeriod({ periodType: "weekly", date });
    await recalculatePeriod(period);
    const documents = await RivalryStatisticsModel.find({
      periodType: "weekly",
      periodKey: period.key,
    })
      .sort({ sharedMatches: -1, competitivenessScore: -1, combinedKills: -1 })
      .lean();
    const selected = selectRivalOfPeriod(documents, 2);
    if (!selected) return { period, rivalry: null, minimumSharedMatches: 2 };
    const playersById = await loadPlayerMap([
      selected.playerA.playerId,
      selected.playerB.playerId,
    ]);
    return {
      period,
      minimumSharedMatches: 2,
      selectionRule:
        "Most shared verified matches, then closest win margin, combined kills and latest shared match.",
      rivalry: {
        playerA: {
          ...publicPlayer(playersById.get(String(selected.playerA.playerId))),
          ...selected.playerA,
          playerId: publicPlayer(playersById.get(String(selected.playerA.playerId)))
            ?.playerId,
        },
        playerB: {
          ...publicPlayer(playersById.get(String(selected.playerB.playerId))),
          ...selected.playerB,
          playerId: publicPlayer(playersById.get(String(selected.playerB.playerId)))
            ?.playerId,
        },
        sharedMatches: selected.sharedMatches,
        draws: selected.draws,
        combinedKills: selected.combinedKills,
        winDifference: selected.winDifference,
        competitivenessScore: selected.competitivenessScore,
        lastSharedMatchAt: selected.lastSharedMatchAt,
      },
    };
  }

  async function recalculate(input, actor, requestMeta = {}) {
    const periodTypes = input.periodTypes ?? ["all_time", "weekly"];
    const results = [];
    for (const periodType of periodTypes) {
      const period = await resolvePeriod({
        periodType,
        date: input.date,
        seasonId: input.seasonId,
      });
      results.push({
        period,
        ...(await recalculatePeriod(period, { force: true })),
      });
    }
    if (actor) {
      await AuditLogModel.create({
        actorUserId: actor.id,
        action: "rivalries.recalculated",
        entityType: "rivalryStatistics",
        entityId: input.playerId ?? "league",
        previousValue: null,
        newValue: {
          periodTypes,
          date: input.date ?? null,
          results: results.map((item) => ({
            periodType: item.period.type,
            periodKey: item.period.key,
            pairCount: item.pairCount ?? null,
          })),
        },
        reason: input.reason,
        ipAddress: requestMeta.ipAddress ?? null,
        userAgent: requestMeta.userAgent ?? null,
        requestId: requestMeta.requestId ?? null,
      });
    }
    return { calculationVersion: RIVALRY_CALCULATION_VERSION, results };
  }

  async function refreshAfterMatch({ matchDate, previousMatchDate = null }) {
    const periods = [
      await resolvePeriod({ periodType: "all_time" }),
      await resolvePeriod({ periodType: "weekly", date: matchDate }),
      await resolvePeriod({ periodType: "monthly", date: matchDate }),
    ];
    if (previousMatchDate) {
      periods.push(
        await resolvePeriod({ periodType: "weekly", date: previousMatchDate }),
        await resolvePeriod({ periodType: "monthly", date: previousMatchDate }),
      );
    }
    const uniquePeriods = [
      ...new Map(
        periods.map((period) => [`${period.type}:${period.key}`, period]),
      ).values(),
    ];
    const results = [];
    for (const period of uniquePeriods) {
      results.push({
        period,
        ...(await recalculatePeriod(period, { force: true })),
      });
    }
    return { calculationVersion: RIVALRY_CALCULATION_VERSION, results };
  }

  return Object.freeze({
    listForPlayer,
    getComparison,
    getHeadToHeadMatches,
    getRivalOfWeek,
    recalculate,
    refreshAfterMatch,
    recalculatePeriod,
    resolvePeriod,
  });
}

export const rivalryService = createRivalryService();
