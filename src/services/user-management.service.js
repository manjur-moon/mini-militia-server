import { createPaginationMeta } from "@mini-militia/shared";
import { ObjectId } from "mongodb";
import { authMongoClient, authDatabase } from "../config/auth-database.js";
import {
  authUserRepository,
  createUserIdFilter,
  escapeRegex,
  serializeAuthUser,
} from "../repositories/auth-user.repository.js";
import { AppError } from "../utils/app-error.js";

function notFound() {
  return new AppError({
    statusCode: 404,
    code: "USER_NOT_FOUND",
    message: "User account was not found.",
  });
}

function conflict(code, message) {
  return new AppError({ statusCode: 409, code, message });
}

function isTransactionUnsupported(error) {
  return (
    error?.code === 20 ||
    error?.codeName === "IllegalOperation" ||
    /transaction numbers are only allowed|replica set|mongos/i.test(
      error?.message ?? "",
    )
  );
}

function auditDocument({
  actorUserId,
  action,
  entityId,
  previousValue,
  newValue,
  reason,
  requestMeta,
}) {
  return {
    actorUserId,
    action,
    entityType: "user",
    entityId,
    previousValue,
    newValue,
    reason,
    ipAddress: requestMeta.ipAddress ?? null,
    userAgent: requestMeta.userAgent ?? null,
    requestId: requestMeta.requestId ?? null,
    createdAt: new Date(),
  };
}

async function ensureAnotherActiveAdmin(repository, userId, options) {
  const remaining = await repository.countActiveAdminsExcluding(userId, options);
  if (remaining < 1) {
    throw conflict(
      "LAST_ACTIVE_ADMIN_PROTECTED",
      "The last active admin cannot be demoted or deactivated.",
    );
  }
}

export function createUserManagementService({ repository = authUserRepository } = {}) {
  return Object.freeze({
    async listUsers(query) {
      const filter = {};
      if (query.search) {
        const pattern = new RegExp(escapeRegex(query.search), "i");
        filter.$or = [{ name: pattern }, { email: pattern }];
      }
      if (query.role) filter.role = query.role;
      if (query.status) filter.status = query.status;
      if (query.linked === "true") filter.linkedPlayerId = { $type: "string" };
      if (query.linked === "false") {
        const unlinkedFilter = {
          $or: [{ linkedPlayerId: null }, { linkedPlayerId: { $exists: false } }],
        };
        if (filter.$or) {
          const searchFilter = { $or: filter.$or };
          delete filter.$or;
          filter.$and = [searchFilter, unlinkedFilter];
        } else {
          Object.assign(filter, unlinkedFilter);
        }
      }

      const sort = { [query.sortBy]: query.sortOrder === "asc" ? 1 : -1, _id: 1 };
      const skip = (query.page - 1) * query.limit;
      const { documents, totalItems } = await repository.list({
        filter,
        sort,
        skip,
        limit: query.limit,
      });

      return {
        users: documents.map(serializeAuthUser),
        pagination: createPaginationMeta({
          page: query.page,
          limit: query.limit,
          totalItems,
        }),
      };
    },

    async getUser(userId) {
      const user = await repository.findById(userId);
      if (!user) throw notFound();
      return serializeAuthUser(user);
    },

    async changeRole({ actor, userId, role, reason, requestMeta }) {
      const current = await repository.findById(userId);
      if (!current) throw notFound();
      const targetId = String(current._id ?? current.id);

      if (current.role === role) return serializeAuthUser(current);
      if (current.role === "admin" && role !== "admin") {
        await ensureAnotherActiveAdmin(repository, targetId);
      }

      const updated = await repository.updateById(targetId, {
        $set: { role, updatedAt: new Date() },
      });
      await repository.revokeSessions(targetId);
      await repository.audits().insertOne(
        auditDocument({
          actorUserId: actor.id,
          action: "user.role_changed",
          entityId: targetId,
          previousValue: { role: current.role },
          newValue: { role },
          reason,
          requestMeta,
        }),
      );

      return serializeAuthUser(updated);
    },

    async changeStatus({ actor, userId, status, reason, requestMeta }) {
      const current = await repository.findById(userId);
      if (!current) throw notFound();
      const targetId = String(current._id ?? current.id);

      if (current.status === status) return serializeAuthUser(current);
      if (
        current.role === "admin" &&
        current.status === "active" &&
        status === "inactive"
      ) {
        await ensureAnotherActiveAdmin(repository, targetId);
      }

      const updated = await repository.updateById(targetId, {
        $set: { status, updatedAt: new Date() },
      });
      await repository.revokeSessions(targetId);
      await repository.audits().insertOne(
        auditDocument({
          actorUserId: actor.id,
          action: "user.account_status_changed",
          entityId: targetId,
          previousValue: { status: current.status },
          newValue: { status },
          reason,
          requestMeta,
        }),
      );

      return serializeAuthUser(updated);
    },

    async linkPlayer({ actor, userId, playerIdentifier, reason, requestMeta }) {
      const user = await repository.findById(userId);
      if (!user) throw notFound();
      const targetId = String(user._id ?? user.id);

      const playerFilter = ObjectId.isValid(playerIdentifier)
        ? {
            $or: [
              { _id: new ObjectId(playerIdentifier) },
              { playerId: playerIdentifier.toUpperCase() },
            ],
          }
        : { playerId: playerIdentifier.toUpperCase() };
      const player = await repository.players().findOne(playerFilter);
      if (!player) {
        throw new AppError({
          statusCode: 404,
          code: "PLAYER_NOT_FOUND",
          message: "Player profile was not found.",
        });
      }
      if (player.status !== "active") {
        throw conflict(
          "PLAYER_INACTIVE",
          "An inactive player profile cannot be linked.",
        );
      }

      const playerMongoId = String(player._id);
      if (user.linkedPlayerId && user.linkedPlayerId !== playerMongoId) {
        throw conflict(
          "USER_ALREADY_LINKED",
          "This user is already linked to another player.",
        );
      }
      if (player.linkedUserId && player.linkedUserId !== targetId) {
        throw conflict(
          "PLAYER_ALREADY_LINKED",
          "This player is already linked to another user.",
        );
      }
      if (user.linkedPlayerId === playerMongoId && player.linkedUserId === targetId) {
        return { user: serializeAuthUser(user), playerId: player.playerId };
      }

      const now = new Date();
      const playerCondition = {
        _id: player._id,
        $or: [
          { linkedUserId: null },
          { linkedUserId: { $exists: false } },
          { linkedUserId: targetId },
        ],
      };
      const userCondition = {
        ...createUserIdFilter(targetId),
        $and: [
          {
            $or: [
              { linkedPlayerId: null },
              { linkedPlayerId: { $exists: false } },
              { linkedPlayerId: playerMongoId },
            ],
          },
        ],
      };
      const audit = auditDocument({
        actorUserId: actor.id,
        action: "user.player_linked",
        entityId: targetId,
        previousValue: { linkedPlayerId: user.linkedPlayerId ?? null },
        newValue: { linkedPlayerId: playerMongoId, playerId: player.playerId },
        reason,
        requestMeta,
      });

      const performLink = async (sessionOptions = {}) => {
        const playerUpdate = await authDatabase
          .collection("players")
          .updateOne(
            playerCondition,
            { $set: { linkedUserId: targetId, updatedBy: actor.id, updatedAt: now } },
            sessionOptions,
          );
        if (playerUpdate.matchedCount !== 1) {
          throw conflict(
            "PLAYER_ALREADY_LINKED",
            "This player is already linked to another user.",
          );
        }

        const userUpdate = await authDatabase
          .collection("user")
          .updateOne(
            userCondition,
            { $set: { linkedPlayerId: playerMongoId, updatedAt: now } },
            sessionOptions,
          );
        if (userUpdate.matchedCount !== 1) {
          throw conflict(
            "USER_ALREADY_LINKED",
            "This user is already linked to another player.",
          );
        }

        await authDatabase.collection("auditLogs").insertOne(audit, sessionOptions);
        await authDatabase.collection("notifications").updateOne(
          { deduplicationKey: `player-account-linked:${targetId}:${playerMongoId}` },
          {
            $setOnInsert: {
              userId: targetId,
              type: "player_account_linked",
              title: "Player account linked",
              message: `Your account is now linked to ${player.name} (${player.playerId}).`,
              relatedEntity: {
                entityType: "player",
                entityId: playerMongoId,
              },
              actionUrl: "/player",
              isRead: false,
              readAt: null,
              data: { playerId: player.playerId },
              source: "system",
              createdBy: actor.id,
              deduplicationKey: `player-account-linked:${targetId}:${playerMongoId}`,
              createdAt: now,
              updatedAt: now,
            },
          },
          { ...sessionOptions, upsert: true },
        );
      };

      const session = authMongoClient.startSession();
      try {
        await session.withTransaction(() => performLink({ session }));
      } catch (error) {
        if (!isTransactionUnsupported(error)) throw error;

        const playerWasAlreadyLinked = player.linkedUserId === targetId;
        try {
          await performLink();
        } catch (fallbackError) {
          if (!playerWasAlreadyLinked) {
            await authDatabase.collection("players").updateOne(
              { _id: player._id, linkedUserId: targetId },
              {
                $set: {
                  linkedUserId: null,
                  updatedBy: actor.id,
                  updatedAt: new Date(),
                },
              },
            );
          }
          throw fallbackError;
        }
      } finally {
        await session.endSession();
      }

      await repository.revokeSessions(targetId);
      return {
        user: serializeAuthUser(await repository.findById(targetId)),
        playerId: player.playerId,
      };
    },

    async unlinkPlayer({ actor, userId, reason, requestMeta }) {
      const user = await repository.findById(userId);
      if (!user) throw notFound();
      const targetId = String(user._id ?? user.id);
      if (!user.linkedPlayerId) return serializeAuthUser(user);

      const linkedPlayerId = user.linkedPlayerId;
      const playerObjectId = ObjectId.isValid(linkedPlayerId)
        ? new ObjectId(linkedPlayerId)
        : null;
      const now = new Date();
      const audit = auditDocument({
        actorUserId: actor.id,
        action: "user.player_unlinked",
        entityId: targetId,
        previousValue: { linkedPlayerId },
        newValue: { linkedPlayerId: null },
        reason,
        requestMeta,
      });

      const performUnlink = async (sessionOptions = {}) => {
        await authDatabase
          .collection("user")
          .updateOne(
            createUserIdFilter(targetId),
            { $set: { linkedPlayerId: null, updatedAt: now } },
            sessionOptions,
          );
        if (playerObjectId) {
          await authDatabase
            .collection("players")
            .updateOne(
              { _id: playerObjectId, linkedUserId: targetId },
              { $set: { linkedUserId: null, updatedBy: actor.id, updatedAt: now } },
              sessionOptions,
            );
        }
        await authDatabase.collection("auditLogs").insertOne(audit, sessionOptions);
      };

      const session = authMongoClient.startSession();
      try {
        await session.withTransaction(() => performUnlink({ session }));
      } catch (error) {
        if (!isTransactionUnsupported(error)) throw error;
        await performUnlink();
      } finally {
        await session.endSession();
      }

      await repository.revokeSessions(targetId);
      return serializeAuthUser(await repository.findById(targetId));
    },
  });
}

export const userManagementService = createUserManagementService();
