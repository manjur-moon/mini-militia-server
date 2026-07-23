import { createPaginationMeta, USER_ROLES } from "@mini-militia/shared";
import { MatchResult } from "../models/match-result.model.js";
import { Match } from "../models/match.model.js";
import { OCRJob } from "../models/ocr-job.model.js";
import { Player } from "../models/player.model.js";
import { AppError } from "../utils/app-error.js";
import { calculateKdr } from "./statistics.service.js";

const ELEVATED_ROLES = new Set([USER_ROLES.MODERATOR, USER_ROLES.ADMIN]);

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isElevated(actor) {
  return ELEVATED_ROLES.has(actor?.role);
}

function publicScreenshot(asset) {
  if (!asset) return null;
  return {
    secureUrl: asset.secureUrl,
    format: asset.format,
    width: asset.width,
    height: asset.height,
  };
}

function publicMatch(value) {
  const match = typeof value?.toObject === "function" ? value.toObject() : value;
  return {
    id: String(match._id),
    matchCode: match.matchCode,
    status: match.status,
    screenshot: publicScreenshot(match.screenshot),
    matchDate: match.matchDate,
    timezone: match.timezone,
    seasonId: match.seasonId ? String(match.seasonId) : null,
    participantCount: match.participantCount,
    verifiedResultCount: match.verifiedResultCount,
    currentRevision: match.currentRevision,
    statisticsRecalculation: match.statisticsRecalculation,
    verifiedAt: match.verification?.verifiedAt ?? null,
    createdAt: match.createdAt,
  };
}

function protectedMatch(value) {
  const match = typeof value?.toObject === "function" ? value.toObject() : value;
  return { ...match, id: String(match._id), _id: undefined };
}

function protectedResult(value) {
  const result = typeof value?.toObject === "function" ? value.toObject() : value;
  return {
    ...result,
    id: String(result._id),
    _id: undefined,
    matchId: String(result.matchId),
  };
}

function notFound() {
  return new AppError({
    statusCode: 404,
    code: "MATCH_NOT_FOUND",
    message: "Match was not found.",
  });
}

export function createMatchReadService({
  MatchModel = Match,
  MatchResultModel = MatchResult,
  OCRJobModel = OCRJob,
  PlayerModel = Player,
} = {}) {
  return Object.freeze({
    async list({ query, actor }) {
      const elevated = isElevated(actor);
      const filter = { status: elevated && query.status ? query.status : "verified" };
      if (query.search) {
        filter.matchCode = new RegExp(escapeRegex(query.search), "i");
      }
      if (query.dateFrom || query.dateTo) {
        filter.matchDate = {};
        if (query.dateFrom) filter.matchDate.$gte = new Date(query.dateFrom);
        if (query.dateTo) filter.matchDate.$lte = new Date(query.dateTo);
      }
      if (query.seasonId) filter.seasonId = query.seasonId;
      const skip = (query.page - 1) * query.limit;
      const sort = {
        [query.sortBy ?? "matchDate"]: query.sortOrder === "asc" ? 1 : -1,
      };
      sort._id = -1;
      const [items, totalItems] = await Promise.all([
        MatchModel.find(filter).sort(sort).skip(skip).limit(query.limit).lean(),
        MatchModel.countDocuments(filter),
      ]);
      return {
        items: items.map(elevated ? protectedMatch : publicMatch),
        pagination: createPaginationMeta({
          page: query.page,
          limit: query.limit,
          totalItems,
        }),
      };
    },

    async get({ matchId, actor }) {
      const match = await MatchModel.findById(matchId).lean();
      if (!match) throw notFound();
      const elevated = isElevated(actor);
      if (match.status !== "verified" && !elevated) throw notFound();

      if (elevated) {
        const [results, job] = await Promise.all([
          MatchResultModel.find({ matchId }).sort({ rowIndex: 1 }).lean(),
          OCRJobModel.findOne({ matchId }).lean(),
        ]);
        return {
          match: protectedMatch(match),
          results: results.map(protectedResult),
          ocrJob: job
            ? {
                ...job,
                id: String(job._id),
                _id: undefined,
                matchId: String(job.matchId),
              }
            : null,
        };
      }

      const results = await MatchResultModel.find({
        matchId,
        status: "verified",
      })
        .select({ official: 1, officialMatchDate: 1 })
        .sort({ "official.placement": 1 })
        .lean();
      const playerIds = results.map((row) => row.official.playerId);
      const players = await PlayerModel.find({ _id: { $in: playerIds } })
        .select({ playerId: 1, name: 1, profileImage: 1, status: 1 })
        .lean();
      const playerMap = new Map(players.map((player) => [String(player._id), player]));
      return {
        match: publicMatch(match),
        results: results.map((row) => {
          const player = playerMap.get(String(row.official.playerId));
          return {
            player: player
              ? {
                  id: String(player._id),
                  playerId: player.playerId,
                  name: player.name,
                  profileImage: player.profileImage ?? null,
                  status: player.status,
                }
              : {
                  id: String(row.official.playerId),
                  playerId: null,
                  name: row.official.playerName,
                  profileImage: null,
                  status: "inactive",
                },
            kills: row.official.kills,
            deaths: row.official.deaths,
            kdr: calculateKdr(row.official.kills, row.official.deaths),
            placement: row.official.placement,
          };
        }),
      };
    },
  });
}

export const matchReadService = createMatchReadService();
