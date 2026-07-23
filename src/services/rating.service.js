import crypto from "node:crypto";
import mongoose from "mongoose";
import { AuditLog } from "../models/audit-log.model.js";
import { MatchResult } from "../models/match-result.model.js";
import { Match } from "../models/match.model.js";
import { PlayerRating } from "../models/player-rating.model.js";
import { Player } from "../models/player.model.js";
import { AppError } from "../utils/app-error.js";
import { analyticsService } from "./analytics.service.js";
import { ratingConfigService } from "./rating-config.service.js";
import {
  RATING_CALCULATION_VERSION,
  RATING_METRICS,
  calculatePlayerRating,
  deriveRatingInputs,
} from "./rating-math.service.js";

function hash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
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
    profileImage: player.profileImage ?? null,
    status: player.status,
  };
}

function serializeRating(rating, player = null) {
  const value = typeof rating?.toObject === "function" ? rating.toObject() : rating;
  if (!value) return null;
  return {
    id: String(value._id),
    playerId: String(value.playerId),
    player: player ? serializePlayer(player) : undefined,
    period: {
      type: value.periodType,
      key: value.periodKey,
      startAt: value.startAt,
      endAt: value.endAt,
      timezone: value.timezone,
      seasonId: value.seasonId ? String(value.seasonId) : null,
    },
    ratings: {
      attack: value.attack,
      survival: value.survival,
      consistency: value.consistency,
      activity: value.activity,
      overall: value.overall,
    },
    rank: value.rank,
    sampleSize: value.sampleSize,
    minimumMatchesMet: value.minimumMatchesMet,
    confidenceFactor: value.confidenceFactor,
    formulaVersion: value.formulaVersion,
    sourceDataHash: value.sourceDataHash,
    inputSnapshot: value.inputSnapshot,
    calculatedAt: value.calculatedAt,
  };
}

function buildPopulationMetricValues(groupedRows, timezone) {
  const values = Object.fromEntries(RATING_METRICS.map((metric) => [metric, []]));
  for (const rows of groupedRows.values()) {
    const inputs = deriveRatingInputs(rows, timezone);
    for (const metric of RATING_METRICS) {
      if (Number.isFinite(inputs[metric])) values[metric].push(inputs[metric]);
    }
  }
  return values;
}

function compareRatings(left, right) {
  if (right.overall !== left.overall) return right.overall - left.overall;
  if (right.attack !== left.attack) return right.attack - left.attack;
  if (right.survival !== left.survival) return right.survival - left.survival;
  if (right.consistency !== left.consistency) {
    return right.consistency - left.consistency;
  }
  if (right.activity !== left.activity) return right.activity - left.activity;
  return left.playerCode.localeCompare(right.playerCode);
}

export function createRatingService({
  PlayerModel = Player,
  MatchModel = Match,
  MatchResultModel = MatchResult,
  PlayerRatingModel = PlayerRating,
  AuditLogModel = AuditLog,
  analytics = analyticsService,
  configService = ratingConfigService,
} = {}) {
  async function fetchVerifiedRows(period) {
    const filter = {
      status: "verified",
      officialMatchDate: { $gte: period.startAt, $lt: period.endAt },
    };
    if (period.seasonId) filter.officialSeasonId = period.seasonId;

    const results = await MatchResultModel.find(filter)
      .select({ matchId: 1, official: 1, officialMatchDate: 1, updatedAt: 1 })
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
      .select({ _id: 1, participantCount: 1 })
      .lean();
    const matchMap = new Map(matches.map((match) => [String(match._id), match]));

    return results
      .filter((result) => matchMap.has(String(result.matchId)))
      .map((result) => ({
        resultId: String(result._id),
        matchId: String(result.matchId),
        playerId: String(result.official.playerId),
        playerName: result.official.playerName,
        matchDate: result.officialMatchDate,
        kills: result.official.kills,
        deaths: result.official.deaths,
        placement: result.official.placement,
        participantCount: matchMap.get(String(result.matchId)).participantCount,
        updatedAt: result.updatedAt,
      }));
  }

  async function calculatePeriodRatings({
    periodType,
    date,
    seasonId,
    force = false,
    actor = null,
    reason = null,
    requestMeta = {},
  }) {
    const period = await analytics.resolvePeriod({ periodType, date, seasonId });
    const config = await configService.getActiveConfig();
    const rows = await fetchVerifiedRows(period);
    const groupedRows = new Map();
    for (const row of rows) {
      if (!groupedRows.has(row.playerId)) groupedRows.set(row.playerId, []);
      groupedRows.get(row.playerId).push(row);
    }

    const sourceDataHash = hash({
      calculationVersion: RATING_CALCULATION_VERSION,
      formulaVersion: config.version,
      period: {
        type: period.type,
        key: period.key,
        timezone: period.timezone,
        seasonId: period.seasonId ? String(period.seasonId) : null,
      },
      rows: rows.map((row) => ({
        resultId: row.resultId,
        matchId: row.matchId,
        playerId: row.playerId,
        matchDate: row.matchDate,
        kills: row.kills,
        deaths: row.deaths,
        placement: row.placement,
        participantCount: row.participantCount,
        updatedAt: row.updatedAt,
      })),
    });

    const existingCount = await PlayerRatingModel.countDocuments({
      periodType: period.type,
      periodKey: period.key,
      formulaVersion: config.version,
      sourceDataHash,
    });
    if (!force && existingCount === groupedRows.size) {
      return {
        period: serializePeriod(period),
        formulaVersion: config.version,
        sourceDataHash,
        calculatedPlayers: existingCount,
        cached: true,
      };
    }

    const playerObjectIds = [...groupedRows.keys()].map(
      (id) => new mongoose.Types.ObjectId(id),
    );
    const players = playerObjectIds.length
      ? await PlayerModel.find({ _id: { $in: playerObjectIds } })
          .select({ playerId: 1, name: 1, profileImage: 1, status: 1 })
          .lean()
      : [];
    const playerMap = new Map(players.map((player) => [String(player._id), player]));
    const populationMetricValues = buildPopulationMetricValues(
      groupedRows,
      period.timezone,
    );

    const calculated = [];
    for (const [playerId, playerRows] of groupedRows.entries()) {
      const player = playerMap.get(playerId);
      if (!player) continue;
      calculated.push({
        playerId,
        playerCode: player.playerId,
        ...calculatePlayerRating({
          rows: playerRows,
          timezone: period.timezone,
          config,
          populationMetricValues,
        }),
      });
    }

    const eligible = calculated.filter((rating) => rating.minimumMatchesMet);
    eligible.sort(compareRatings);
    const rankMap = new Map(
      eligible.map((rating, index) => [rating.playerId, index + 1]),
    );
    const calculatedAt = new Date();

    if (calculated.length) {
      await PlayerRatingModel.bulkWrite(
        calculated.map((rating) => ({
          updateOne: {
            filter: {
              playerId: new mongoose.Types.ObjectId(rating.playerId),
              periodType: period.type,
              periodKey: period.key,
              formulaVersion: config.version,
            },
            update: {
              $set: {
                startAt: period.startAt,
                endAt: period.endAt,
                timezone: period.timezone,
                seasonId: period.seasonId ?? null,
                attack: rating.attack,
                survival: rating.survival,
                consistency: rating.consistency,
                activity: rating.activity,
                overall: rating.overall,
                rank: rankMap.get(rating.playerId) ?? null,
                sampleSize: rating.sampleSize,
                minimumMatchesMet: rating.minimumMatchesMet,
                confidenceFactor: rating.confidenceFactor,
                sourceDataHash,
                inputSnapshot: rating.inputSnapshot,
                calculatedAt,
              },
              $setOnInsert: {
                playerId: new mongoose.Types.ObjectId(rating.playerId),
                periodType: period.type,
                periodKey: period.key,
                formulaVersion: config.version,
              },
            },
            upsert: true,
          },
        })),
      );
    }

    const retainedPlayerIds = calculated.map(
      (rating) => new mongoose.Types.ObjectId(rating.playerId),
    );
    const staleFilter = {
      periodType: period.type,
      periodKey: period.key,
      formulaVersion: config.version,
    };
    if (retainedPlayerIds.length) staleFilter.playerId = { $nin: retainedPlayerIds };
    await PlayerRatingModel.deleteMany(staleFilter);

    if (actor) {
      await AuditLogModel.create({
        actorUserId: actor.id,
        action: "rating.recalculated",
        entityType: "player_rating_period",
        entityId: `${period.type}:${period.key}:${config.version}`,
        previousValue: null,
        newValue: {
          period: serializePeriod(period),
          formulaVersion: config.version,
          sourceDataHash,
          calculatedPlayers: calculated.length,
        },
        reason,
        ipAddress: requestMeta.ipAddress ?? null,
        userAgent: requestMeta.userAgent ?? null,
        requestId: requestMeta.requestId ?? null,
      });
    }

    return {
      period: serializePeriod(period),
      formulaVersion: config.version,
      sourceDataHash,
      calculatedPlayers: calculated.length,
      eligiblePlayers: eligible.length,
      cached: false,
    };
  }

  async function ensurePeriodRatings(input) {
    return calculatePeriodRatings({ ...input, force: false });
  }

  return Object.freeze({
    ensurePeriodRatings,

    async getLeaderboard({
      periodType,
      date,
      seasonId,
      includeProvisional = false,
      page = 1,
      limit = 20,
    }) {
      const result = await ensurePeriodRatings({ periodType, date, seasonId });
      const filter = {
        periodType: result.period.type,
        periodKey: result.period.key,
        formulaVersion: result.formulaVersion,
      };
      if (!includeProvisional) filter.minimumMatchesMet = true;
      const totalItems = await PlayerRatingModel.countDocuments(filter);
      const totalPages = Math.max(1, Math.ceil(totalItems / limit));
      const safePage = Math.min(page, totalPages);
      const ratings = await PlayerRatingModel.find(filter)
        .sort({ minimumMatchesMet: -1, rank: 1, overall: -1, attack: -1, playerId: 1 })
        .skip((safePage - 1) * limit)
        .limit(limit)
        .lean();
      const players = await PlayerModel.find({
        _id: { $in: ratings.map((rating) => rating.playerId) },
      })
        .select({ playerId: 1, name: 1, profileImage: 1, status: 1 })
        .lean();
      const playerMap = new Map(players.map((player) => [String(player._id), player]));

      return {
        period: result.period,
        formulaVersion: result.formulaVersion,
        items: ratings.map((rating) =>
          serializeRating(rating, playerMap.get(String(rating.playerId))),
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

    async getPlayerRating({ playerCode, periodType, date, seasonId }) {
      const player = await PlayerModel.findOne({ playerId: playerCode })
        .select({ playerId: 1, name: 1, profileImage: 1, status: 1 })
        .lean();
      if (!player) {
        throw new AppError({
          statusCode: 404,
          code: "PLAYER_NOT_FOUND",
          message: "Player was not found.",
        });
      }
      const result = await ensurePeriodRatings({ periodType, date, seasonId });
      const rating = await PlayerRatingModel.findOne({
        playerId: player._id,
        periodType: result.period.type,
        periodKey: result.period.key,
        formulaVersion: result.formulaVersion,
      }).lean();
      return {
        period: result.period,
        formulaVersion: result.formulaVersion,
        rating: serializeRating(rating, player),
      };
    },

    async getPlayerHistory({ playerCode, periodType, page = 1, limit = 20 }) {
      const player = await PlayerModel.findOne({ playerId: playerCode })
        .select({ playerId: 1, name: 1, profileImage: 1, status: 1 })
        .lean();
      if (!player) {
        throw new AppError({
          statusCode: 404,
          code: "PLAYER_NOT_FOUND",
          message: "Player was not found.",
        });
      }
      const config = await configService.getActiveConfig();
      const filter = { playerId: player._id, formulaVersion: config.version };
      if (periodType) filter.periodType = periodType;
      const totalItems = await PlayerRatingModel.countDocuments(filter);
      const totalPages = Math.max(1, Math.ceil(totalItems / limit));
      const safePage = Math.min(page, totalPages);
      const ratings = await PlayerRatingModel.find(filter)
        .sort({ startAt: -1, calculatedAt: -1 })
        .skip((safePage - 1) * limit)
        .limit(limit)
        .lean();
      return {
        items: ratings.map((rating) => serializeRating(rating, player)),
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

    async recalculate(input, actor, requestMeta) {
      if (!input.reason) {
        throw new AppError({
          statusCode: 422,
          code: "RECALCULATION_REASON_REQUIRED",
          message: "A reason is required to recalculate player ratings.",
        });
      }
      return calculatePeriodRatings({
        ...input,
        force: true,
        actor,
        reason: input.reason,
        requestMeta,
      });
    },
  });
}

export const ratingService = createRatingService();
