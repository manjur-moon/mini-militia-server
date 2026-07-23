import { createHash } from "node:crypto";
import { createPaginationMeta } from "@mini-militia/shared";
import { AuditLog } from "../models/audit-log.model.js";
import { Player } from "../models/player.model.js";
import { PlayerCounter } from "../models/player-counter.model.js";
import { PlayerStatistics } from "../models/player-statistics.model.js";
import { MatchResult } from "../models/match-result.model.js";
import { Match } from "../models/match.model.js";
import { calculateKdr } from "./statistics.service.js";
import { normalizeText } from "../models/model.helpers.js";
import { AppError } from "../utils/app-error.js";
import { cloudinaryImageService } from "./cloudinary-image.service.js";

const PLAYER_COUNTER_KEY = "player";
const MAX_PLAYER_ID_RETRIES = 4;
const PUBLIC_PLAYER_FIELDS = Object.freeze({
  playerId: 1,
  name: 1,
  aliases: 1,
  profileImage: 1,
  joinDate: 1,
  status: 1,
  createdAt: 1,
  updatedAt: 1,
});

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function notFound() {
  return new AppError({
    statusCode: 404,
    code: "PLAYER_NOT_FOUND",
    message: "Player profile was not found.",
  });
}

function serializePlayer(player) {
  if (!player) return null;
  const value = typeof player.toObject === "function" ? player.toObject() : player;
  return {
    id: String(value._id ?? value.id),
    playerId: value.playerId,
    name: value.name,
    aliases: value.aliases ?? [],
    profileImage: value.profileImage ?? null,
    joinDate: value.joinDate,
    status: value.status,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function sanitizeAliases(aliases, name) {
  const normalizedName = normalizeText(name);
  return [...new Set((aliases ?? []).map(normalizeText))].filter(
    (alias) => alias && alias !== normalizedName,
  );
}

function auditPayload({
  actor,
  action,
  player,
  previousValue,
  newValue,
  reason,
  requestMeta,
}) {
  return {
    actorUserId: actor.id,
    action,
    entityType: "player",
    entityId: String(player._id),
    previousValue,
    newValue,
    reason,
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
    requestId: requestMeta.requestId,
  };
}

function isPlayerIdDuplicate(error) {
  return error?.code === 11000 && Boolean(error?.keyPattern?.playerId);
}

export function createPlayerService({
  PlayerModel = Player,
  PlayerCounterModel = PlayerCounter,
  PlayerStatisticsModel = PlayerStatistics,
  MatchResultModel = MatchResult,
  MatchModel = Match,
  AuditLogModel = AuditLog,
  imageService = cloudinaryImageService,
} = {}) {
  const getNextPlayerId = async () => {
    const counter = await PlayerCounterModel.findOneAndUpdate(
      { key: PLAYER_COUNTER_KEY },
      { $inc: { sequence: 1 }, $setOnInsert: { key: PLAYER_COUNTER_KEY } },
      { upsert: true, returnDocument: "after", runValidators: true },
    );
    return `MM${String(counter.sequence).padStart(3, "0")}`;
  };

  return Object.freeze({
    async listPlayers(query) {
      const filter = { status: query.status };
      if (query.search) {
        const pattern = new RegExp(escapeRegex(query.search), "i");
        filter.$or = [
          { playerId: pattern },
          { normalizedName: pattern },
          { aliases: pattern },
        ];
      }
      if (query.joinedFrom || query.joinedTo) {
        filter.joinDate = {};
        if (query.joinedFrom) filter.joinDate.$gte = new Date(query.joinedFrom);
        if (query.joinedTo) filter.joinDate.$lte = new Date(query.joinedTo);
      }

      const direction = query.sortOrder === "asc" ? 1 : -1;
      const sortField = query.sortBy === "name" ? "normalizedName" : query.sortBy;
      const sort = { [sortField]: direction, _id: 1 };
      const skip = (query.page - 1) * query.limit;

      const [players, totalItems] = await Promise.all([
        PlayerModel.find(filter)
          .select(PUBLIC_PLAYER_FIELDS)
          .sort(sort)
          .skip(skip)
          .limit(query.limit)
          .lean(),
        PlayerModel.countDocuments(filter),
      ]);

      return {
        players: players.map(serializePlayer),
        pagination: createPaginationMeta({
          page: query.page,
          limit: query.limit,
          totalItems,
        }),
      };
    },

    async createPlayer({ actor, input, requestMeta }) {
      const aliases = sanitizeAliases(input.aliases, input.name);
      let lastError;

      for (let attempt = 1; attempt <= MAX_PLAYER_ID_RETRIES; attempt += 1) {
        const generatedPlayerId = await getNextPlayerId();
        try {
          const player = await PlayerModel.create({
            playerId: generatedPlayerId,
            name: input.name,
            normalizedName: normalizeText(input.name),
            aliases,
            joinDate: new Date(input.joinDate),
            status: input.status,
            deactivatedAt: input.status === "inactive" ? new Date() : null,
            deactivationReason:
              input.status === "inactive" ? "Created as inactive" : null,
            createdBy: actor.id,
            updatedBy: actor.id,
          });

          await AuditLogModel.create(
            auditPayload({
              actor,
              action: "player.created",
              player,
              previousValue: null,
              newValue: serializePlayer(player),
              reason: "Player profile created",
              requestMeta,
            }),
          );
          return serializePlayer(player);
        } catch (error) {
          lastError = error;
          if (!isPlayerIdDuplicate(error)) throw error;
        }
      }

      throw new AppError({
        statusCode: 409,
        code: "DUPLICATE_PLAYER_ID_RETRY_FAILED",
        message: "Unable to generate a unique player ID. Please retry.",
        cause: lastError,
      });
    },

    async getPlayer(playerId) {
      const player = await PlayerModel.findOne({ playerId })
        .select(PUBLIC_PLAYER_FIELDS)
        .lean();
      if (!player) throw notFound();
      return serializePlayer(player);
    },

    async getLinkedProfile(user) {
      if (!user.linkedPlayerId) {
        throw new AppError({
          statusCode: 404,
          code: "PLAYER_PROFILE_NOT_LINKED",
          message: "This account is not linked to a player profile.",
        });
      }
      const linkedPlayer = await PlayerModel.findById(user.linkedPlayerId)
        .select({ playerId: 1 })
        .lean();
      if (!linkedPlayer) throw notFound();
      return this.getPublicProfile(linkedPlayer.playerId);
    },

    async getPublicProfile(playerId) {
      const player = await PlayerModel.findOne({ playerId })
        .select(PUBLIC_PLAYER_FIELDS)
        .lean();
      if (!player) throw notFound();

      const [statistics, recentResults] = await Promise.all([
        PlayerStatisticsModel.findOne({ playerId: player._id })
          .select({
            metrics: 1,
            records: 1,
            globalRank: 1,
            calculationVersion: 1,
            recalculatedAt: 1,
          })
          .lean(),
        MatchResultModel.find({
          status: "verified",
          "official.playerId": player._id,
        })
          .select({ matchId: 1, official: 1, officialMatchDate: 1 })
          .sort({ officialMatchDate: -1 })
          .limit(5)
          .lean(),
      ]);
      const matches = await MatchModel.find({
        _id: { $in: recentResults.map((result) => result.matchId) },
        status: "verified",
      })
        .select({ matchCode: 1, matchDate: 1, participantCount: 1, screenshot: 1 })
        .lean();
      const matchMap = new Map(matches.map((match) => [String(match._id), match]));

      return {
        player: serializePlayer(player),
        statistics: statistics
          ? {
              metrics: statistics.metrics,
              records: statistics.records,
              globalRank: statistics.globalRank,
              calculationVersion: statistics.calculationVersion,
              recalculatedAt: statistics.recalculatedAt,
            }
          : null,
        recentMatches: recentResults
          .map((result) => {
            const match = matchMap.get(String(result.matchId));
            if (!match) return null;
            return {
              match: {
                id: String(match._id),
                matchCode: match.matchCode,
                matchDate: match.matchDate,
                participantCount: match.participantCount,
                screenshot: { secureUrl: match.screenshot.secureUrl },
              },
              kills: result.official.kills,
              deaths: result.official.deaths,
              kdr: calculateKdr(result.official.kills, result.official.deaths),
              placement: result.official.placement,
            };
          })
          .filter(Boolean),
      };
    },

    async updatePlayer({ actor, playerId, input, requestMeta }) {
      const current = await PlayerModel.findOne({ playerId });
      if (!current) throw notFound();

      const updates = { updatedBy: actor.id };
      if (input.name !== undefined) {
        updates.name = input.name;
        updates.normalizedName = normalizeText(input.name);
      }
      if (input.aliases !== undefined) {
        updates.aliases = sanitizeAliases(input.aliases, input.name ?? current.name);
      } else if (input.name !== undefined) {
        updates.aliases = sanitizeAliases(current.aliases, input.name);
      }
      if (input.joinDate !== undefined) updates.joinDate = new Date(input.joinDate);

      const filter = { _id: current._id };
      if (input.expectedUpdatedAt) {
        filter.updatedAt = new Date(input.expectedUpdatedAt);
      }

      const updated = await PlayerModel.findOneAndUpdate(
        filter,
        { $set: updates },
        { returnDocument: "after", runValidators: true },
      );
      if (!updated) {
        throw new AppError({
          statusCode: 409,
          code: "STALE_WRITE",
          message: "The player was modified by another request. Refresh and retry.",
        });
      }

      await AuditLogModel.create(
        auditPayload({
          actor,
          action: "player.updated",
          player: updated,
          previousValue: serializePlayer(current),
          newValue: serializePlayer(updated),
          reason: input.reason,
          requestMeta,
        }),
      );
      return serializePlayer(updated);
    },

    async updateStatus({ actor, playerId, status, reason, requestMeta }) {
      const current = await PlayerModel.findOne({ playerId });
      if (!current) throw notFound();
      if (current.status === status) return serializePlayer(current);

      const updated = await PlayerModel.findOneAndUpdate(
        { _id: current._id },
        {
          $set: {
            status,
            deactivatedAt: status === "inactive" ? new Date() : null,
            deactivationReason: status === "inactive" ? reason : null,
            updatedBy: actor.id,
          },
        },
        { returnDocument: "after", runValidators: true },
      );

      await AuditLogModel.create(
        auditPayload({
          actor,
          action: "player.status_changed",
          player: updated,
          previousValue: { status: current.status },
          newValue: { status: updated.status },
          reason,
          requestMeta,
        }),
      );
      return serializePlayer(updated);
    },

    async uploadPhoto({ actor, playerId, file, requestMeta }) {
      const current = await PlayerModel.findOne({ playerId });
      if (!current) throw notFound();

      const uploadedAsset = await imageService.uploadPlayerPhoto({
        buffer: file.buffer,
        playerId,
      });
      uploadedAsset.sha256 = createHash("sha256").update(file.buffer).digest("hex");

      let updated;
      try {
        updated = await PlayerModel.findOneAndUpdate(
          { _id: current._id },
          { $set: { profileImage: uploadedAsset, updatedBy: actor.id } },
          { returnDocument: "after", runValidators: true },
        );
      } catch (error) {
        await imageService.deleteImage(uploadedAsset.publicId).catch(() => undefined);
        throw error;
      }

      await AuditLogModel.create(
        auditPayload({
          actor,
          action: "player.photo_updated",
          player: updated,
          previousValue: { profileImage: current.profileImage ?? null },
          newValue: { profileImage: uploadedAsset },
          reason: "Player photo uploaded",
          requestMeta,
        }),
      );

      if (current.profileImage?.publicId) {
        await imageService
          .deleteImage(current.profileImage.publicId)
          .catch(() => undefined);
      }
      return serializePlayer(updated);
    },

    async deletePhoto({ actor, playerId, reason, requestMeta }) {
      const current = await PlayerModel.findOne({ playerId });
      if (!current || !current.profileImage) {
        throw new AppError({
          statusCode: 404,
          code: "PLAYER_OR_PHOTO_NOT_FOUND",
          message: "Player profile or current photo was not found.",
        });
      }
      const previousImage = current.profileImage.toObject
        ? current.profileImage.toObject()
        : current.profileImage;

      const updated = await PlayerModel.findOneAndUpdate(
        { _id: current._id, "profileImage.publicId": previousImage.publicId },
        { $set: { profileImage: null, updatedBy: actor.id } },
        { returnDocument: "after", runValidators: true },
      );
      if (!updated) {
        throw new AppError({
          statusCode: 409,
          code: "STALE_WRITE",
          message: "The player photo changed before it could be removed.",
        });
      }

      try {
        await imageService.deleteImage(previousImage.publicId);
      } catch (error) {
        await PlayerModel.updateOne(
          { _id: current._id, profileImage: null },
          { $set: { profileImage: previousImage, updatedBy: actor.id } },
        );
        throw error;
      }

      await AuditLogModel.create(
        auditPayload({
          actor,
          action: "player.photo_removed",
          player: updated,
          previousValue: { profileImage: previousImage },
          newValue: { profileImage: null },
          reason,
          requestMeta,
        }),
      );
      return serializePlayer(updated);
    },
  });
}

export const playerService = createPlayerService();
