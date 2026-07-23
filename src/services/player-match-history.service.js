import { createPaginationMeta } from "@mini-militia/shared";
import { MatchResult } from "../models/match-result.model.js";
import { Match } from "../models/match.model.js";
import { Player } from "../models/player.model.js";
import { AppError } from "../utils/app-error.js";
import { calculateKdr } from "./statistics.service.js";

function playerNotFound() {
  return new AppError({
    statusCode: 404,
    code: "PLAYER_NOT_FOUND",
    message: "Player profile was not found.",
  });
}

export function createPlayerMatchHistoryService({
  PlayerModel = Player,
  MatchModel = Match,
  MatchResultModel = MatchResult,
} = {}) {
  return Object.freeze({
    async listLinked(user, query) {
      if (!user.linkedPlayerId) {
        throw new AppError({
          statusCode: 404,
          code: "PLAYER_PROFILE_NOT_LINKED",
          message: "This account is not linked to a player profile.",
        });
      }
      const player = await PlayerModel.findById(user.linkedPlayerId)
        .select({ playerId: 1 })
        .lean();
      if (!player) throw playerNotFound();
      return this.list(player.playerId, query);
    },

    async list(playerCode, query) {
      const player = await PlayerModel.findOne({ playerId: playerCode })
        .select({ _id: 1, playerId: 1, name: 1 })
        .lean();
      if (!player) throw playerNotFound();

      const filter = {
        status: "verified",
        "official.playerId": player._id,
      };
      if (query.from || query.to) {
        filter.officialMatchDate = {};
        if (query.from) filter.officialMatchDate.$gte = new Date(query.from);
        if (query.to) filter.officialMatchDate.$lte = new Date(query.to);
      }
      if (query.seasonId) filter.officialSeasonId = query.seasonId;
      const skip = (query.page - 1) * query.limit;
      const direction = query.sortOrder === "asc" ? 1 : -1;
      const [results, totalItems] = await Promise.all([
        MatchResultModel.find(filter)
          .select({
            matchId: 1,
            official: 1,
            officialMatchDate: 1,
            officialSeasonId: 1,
          })
          .sort({ officialMatchDate: direction, _id: direction })
          .skip(skip)
          .limit(query.limit)
          .lean(),
        MatchResultModel.countDocuments(filter),
      ]);
      const matchIds = results.map((row) => row.matchId);
      const matches = await MatchModel.find({
        _id: { $in: matchIds },
        status: "verified",
      })
        .select({ matchCode: 1, screenshot: 1, participantCount: 1, matchDate: 1 })
        .lean();
      const matchMap = new Map(matches.map((match) => [String(match._id), match]));
      return {
        player: {
          id: String(player._id),
          playerId: player.playerId,
          name: player.name,
        },
        items: results
          .map((result) => {
            const match = matchMap.get(String(result.matchId));
            if (!match) return null;
            return {
              match: {
                id: String(match._id),
                matchCode: match.matchCode,
                matchDate: match.matchDate,
                participantCount: match.participantCount,
                screenshot: {
                  secureUrl: match.screenshot.secureUrl,
                  width: match.screenshot.width,
                  height: match.screenshot.height,
                },
              },
              kills: result.official.kills,
              deaths: result.official.deaths,
              kdr: calculateKdr(result.official.kills, result.official.deaths),
              placement: result.official.placement,
            };
          })
          .filter(Boolean),
        pagination: createPaginationMeta({
          page: query.page,
          limit: query.limit,
          totalItems,
        }),
      };
    },
  });
}

export const playerMatchHistoryService = createPlayerMatchHistoryService();
