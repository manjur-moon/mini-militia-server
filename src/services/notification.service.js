import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import { createPaginationMeta } from "@mini-militia/shared";
import { authDatabase } from "../config/auth-database.js";
import { AuditLog } from "../models/audit-log.model.js";
import { Notification } from "../models/notification.model.js";
import { Player } from "../models/player.model.js";
import {
  createUserIdFilter,
  escapeRegex,
} from "../repositories/auth-user.repository.js";
import { AppError } from "../utils/app-error.js";

function notFound() {
  return new AppError({
    statusCode: 404,
    code: "NOTIFICATION_NOT_FOUND",
    message: "Notification was not found.",
  });
}

function userNotFound() {
  return new AppError({
    statusCode: 404,
    code: "USER_NOT_FOUND",
    message: "The target user account was not found.",
  });
}

function internalValue(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : null;
}

export function resolveNotificationActionUrl(notification) {
  const explicit = internalValue(notification.actionUrl);
  if (explicit) return explicit;

  const data = notification.data ?? {};
  const relatedId = notification.relatedEntity?.entityId ?? null;

  switch (notification.type) {
    case "achievement_unlocked":
      return "/player/achievements";
    case "challenge_completed":
      return "/player/challenges";
    case "title_earned":
      return data.playerId
        ? `/players/${encodeURIComponent(data.playerId)}`
        : "/player";
    case "match_verified":
    case "match_rejected": {
      const matchId = data.matchId ?? relatedId;
      return matchId ? `/matches/${encodeURIComponent(matchId)}` : "/matches";
    }
    case "player_account_linked":
      return "/player";
    case "season_started":
    case "season_completed":
      return data.slug ? `/seasons/${encodeURIComponent(data.slug)}` : "/seasons";
    case "mvp_award":
      return "/mvp";
    default:
      return null;
  }
}

function serializeUser(document) {
  if (!document) return null;
  return {
    id: String(document._id ?? document.id),
    name: document.name,
    email: document.email,
    role: document.role,
    status: document.status,
  };
}

function serializeNotification(document, user = null) {
  const value = document?.toObject?.() ?? document;
  if (!value) return null;
  return {
    id: String(value._id),
    userId: value.userId,
    user: serializeUser(user),
    type: value.type,
    title: value.title,
    message: value.message,
    relatedEntity: value.relatedEntity ?? null,
    actionUrl: resolveNotificationActionUrl(value),
    isRead: Boolean(value.isRead),
    readAt: value.readAt ?? null,
    data: value.data ?? null,
    source: value.source ?? "system",
    createdBy: value.createdBy ?? null,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function readFilter(readStatus) {
  if (readStatus === "read") return true;
  if (readStatus === "unread") return false;
  return undefined;
}

function userLookupFilter(identifier) {
  const normalized = String(identifier).trim();
  if (normalized.includes("@")) return { email: normalized.toLowerCase() };
  return createUserIdFilter(normalized);
}

async function hydrateUsers(userIds) {
  const ids = [...new Set(userIds.filter(Boolean).map(String))];
  if (!ids.length) return new Map();
  const objectIds = ids.filter(ObjectId.isValid).map((id) => new ObjectId(id));
  const documents = await authDatabase
    .collection("user")
    .find(
      {
        $or: [
          { id: { $in: ids } },
          ...(objectIds.length ? [{ _id: { $in: objectIds } }] : []),
          { _id: { $in: ids } },
        ],
      },
      { projection: { name: 1, email: 1, role: 1, status: 1, id: 1 } },
    )
    .toArray();
  return new Map(documents.map((item) => [String(item._id ?? item.id), item]));
}

function auditFields(requestMeta = {}) {
  return {
    ipAddress: requestMeta.ipAddress ?? null,
    userAgent: requestMeta.userAgent ?? null,
    requestId: requestMeta.requestId ?? null,
  };
}

export function createNotificationService({
  NotificationModel = Notification,
  PlayerModel = Player,
  AuditLogModel = AuditLog,
} = {}) {
  async function createSystemNotification(input, { session } = {}) {
    const payload = {
      userId: String(input.userId),
      type: input.type,
      title: input.title,
      message: input.message,
      relatedEntity: input.relatedEntity ?? null,
      actionUrl: input.actionUrl ?? null,
      data: input.data ?? null,
      source: input.source ?? "system",
      createdBy: input.createdBy ?? null,
      deduplicationKey: input.deduplicationKey ?? null,
    };

    if (payload.deduplicationKey) {
      const result = await NotificationModel.findOneAndUpdate(
        { deduplicationKey: payload.deduplicationKey },
        { $setOnInsert: payload },
        { new: true, upsert: true, session, setDefaultsOnInsert: true },
      );
      return serializeNotification(result);
    }

    const [created] = await NotificationModel.create([payload], { session });
    return serializeNotification(created);
  }

  return Object.freeze({
    createSystemNotification,

    async createForLinkedPlayers(playerIds, buildNotification, options = {}) {
      const uniqueIds = [...new Set(playerIds.filter(Boolean).map(String))];
      if (!uniqueIds.length) return { created: 0 };
      const mongoIds = uniqueIds
        .filter(mongoose.isValidObjectId)
        .map((id) => new mongoose.Types.ObjectId(id));
      const players = await PlayerModel.find({ _id: { $in: mongoIds } })
        .select({ _id: 1, playerId: 1, name: 1, linkedUserId: 1 })
        .session(options.session ?? null)
        .lean();
      const documents = players
        .filter((player) => player.linkedUserId)
        .map((player) => ({
          ...buildNotification(player),
          userId: player.linkedUserId,
        }));
      if (!documents.length) return { created: 0 };

      let created = 0;
      for (const document of documents) {
        await createSystemNotification(document, options);
        created += 1;
      }
      return { created };
    },

    async listForUser(userId, query) {
      const filter = { userId: String(userId) };
      if (query.type) filter.type = query.type;
      const isRead = readFilter(query.readStatus);
      if (isRead !== undefined) filter.isRead = isRead;
      const skip = (query.page - 1) * query.limit;
      const sortDirection = query.sortOrder === "asc" ? 1 : -1;

      const [items, totalItems, unreadCount] = await Promise.all([
        NotificationModel.find(filter)
          .sort({ createdAt: sortDirection, _id: sortDirection })
          .skip(skip)
          .limit(query.limit)
          .lean(),
        NotificationModel.countDocuments(filter),
        NotificationModel.countDocuments({ userId: String(userId), isRead: false }),
      ]);

      return {
        items: items.map((item) => serializeNotification(item)),
        pagination: createPaginationMeta({
          page: query.page,
          limit: query.limit,
          totalItems,
        }),
        unreadCount,
      };
    },

    async unreadCount(userId) {
      return NotificationModel.countDocuments({
        userId: String(userId),
        isRead: false,
      });
    },

    async markRead(userId, notificationId) {
      const notification = await NotificationModel.findOneAndUpdate(
        { _id: notificationId, userId: String(userId) },
        { $set: { isRead: true, readAt: new Date() } },
        { new: true },
      );
      if (!notification) throw notFound();
      return serializeNotification(notification);
    },

    async markAllRead(userId) {
      const now = new Date();
      const result = await NotificationModel.updateMany(
        { userId: String(userId), isRead: false },
        { $set: { isRead: true, readAt: now } },
      );
      return { updatedCount: result.modifiedCount, readAt: now };
    },

    async listAdmin(query) {
      const filter = {};
      if (query.userId) filter.userId = query.userId;
      if (query.type) filter.type = query.type;
      if (query.source) filter.source = query.source;
      const isRead = readFilter(query.readStatus);
      if (isRead !== undefined) filter.isRead = isRead;
      if (query.search) {
        const pattern = new RegExp(escapeRegex(query.search), "i");
        filter.$or = [{ title: pattern }, { message: pattern }];
      }
      if (query.dateFrom || query.dateTo) {
        filter.createdAt = {};
        if (query.dateFrom) filter.createdAt.$gte = new Date(query.dateFrom);
        if (query.dateTo) filter.createdAt.$lte = new Date(query.dateTo);
      }
      const skip = (query.page - 1) * query.limit;
      const sortDirection = query.sortOrder === "asc" ? 1 : -1;
      const [items, totalItems] = await Promise.all([
        NotificationModel.find(filter)
          .sort({ createdAt: sortDirection, _id: sortDirection })
          .skip(skip)
          .limit(query.limit)
          .lean(),
        NotificationModel.countDocuments(filter),
      ]);
      const users = await hydrateUsers(items.map((item) => item.userId));
      return {
        items: items.map((item) =>
          serializeNotification(item, users.get(String(item.userId)) ?? null),
        ),
        pagination: createPaginationMeta({
          page: query.page,
          limit: query.limit,
          totalItems,
        }),
      };
    },

    async createAdmin(input, actor, requestMeta = {}) {
      const target = await authDatabase
        .collection("user")
        .findOne(userLookupFilter(input.userIdentifier), {
          projection: { name: 1, email: 1, role: 1, status: 1, id: 1 },
        });
      if (!target) throw userNotFound();
      if (target.status !== "active") {
        throw new AppError({
          statusCode: 409,
          code: "TARGET_USER_INACTIVE",
          message: "Notifications can only be sent to active user accounts.",
        });
      }

      const userId = String(target._id ?? target.id);
      const created = await createSystemNotification({
        userId,
        type: "system_announcement",
        title: input.title,
        message: input.message,
        actionUrl: input.actionUrl ?? null,
        relatedEntity: input.relatedEntity ?? null,
        source: "admin",
        createdBy: actor.id,
      });

      await AuditLogModel.create({
        actorUserId: actor.id,
        action: "notification.created",
        entityType: "notification",
        entityId: created.id,
        previousValue: null,
        newValue: {
          userId,
          type: created.type,
          title: created.title,
          actionUrl: created.actionUrl,
        },
        reason: input.reason,
        ...auditFields(requestMeta),
      });

      return {
        ...created,
        user: serializeUser(target),
      };
    },
  });
}

export const notificationService = createNotificationService();
