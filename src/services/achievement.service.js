import crypto from "node:crypto";
import mongoose from "mongoose";
import { Achievement } from "../models/achievement.model.js";
import { AuditLog } from "../models/audit-log.model.js";
import { Notification } from "../models/notification.model.js";
import { PlayerAchievement } from "../models/player-achievement.model.js";
import { PlayerStatistics } from "../models/player-statistics.model.js";
import { Player } from "../models/player.model.js";
import { AppError } from "../utils/app-error.js";
import { analyticsService } from "./analytics.service.js";
import { evaluateAchievementDefinition } from "./achievement-rule.service.js";

export const DEFAULT_ACHIEVEMENTS = Object.freeze([
  {
    code: "FIRST_BLOOD",
    version: "v1",
    name: "First Blood",
    description: "Record the first official kill in a verified league match.",
    icon: "🩸",
    category: "milestone",
    periodType: "all_time",
    minimumMatches: 1,
    progressMetric: "totalKills",
    targetValue: 1,
    criteria: {
      combinator: "all",
      conditions: [{ metric: "totalKills", operator: "gte", value: 1 }],
    },
  },
  {
    code: "KILLS_CLUB_100",
    version: "v1",
    name: "100 Kills Club",
    description: "Reach 100 official career kills.",
    icon: "💯",
    category: "kills",
    periodType: "all_time",
    minimumMatches: 1,
    progressMetric: "totalKills",
    targetValue: 100,
    criteria: {
      combinator: "all",
      conditions: [{ metric: "totalKills", operator: "gte", value: 100 }],
    },
  },
  {
    code: "KILLS_CLUB_500",
    version: "v1",
    name: "500 Kills Club",
    description: "Reach 500 official career kills.",
    icon: "⚔️",
    category: "kills",
    periodType: "all_time",
    minimumMatches: 1,
    progressMetric: "totalKills",
    targetValue: 500,
    criteria: {
      combinator: "all",
      conditions: [{ metric: "totalKills", operator: "gte", value: 500 }],
    },
  },
  {
    code: "KILLS_CLUB_1000",
    version: "v1",
    name: "1000 Kills Club",
    description: "Reach 1,000 official career kills.",
    icon: "🔥",
    category: "kills",
    periodType: "all_time",
    minimumMatches: 1,
    progressMetric: "totalKills",
    targetValue: 1000,
    criteria: {
      combinator: "all",
      conditions: [{ metric: "totalKills", operator: "gte", value: 1000 }],
    },
  },
  {
    code: "MVP_MASTER",
    version: "v1",
    name: "MVP Master",
    description: "Earn five official MVP awards.",
    icon: "🏆",
    category: "mvp",
    periodType: "all_time",
    minimumMatches: 5,
    progressMetric: "mvpCount",
    targetValue: 5,
    criteria: {
      combinator: "all",
      conditions: [{ metric: "mvpCount", operator: "gte", value: 5 }],
    },
  },
  {
    code: "KING_OF_ARENA",
    version: "v1",
    name: "King of Arena",
    description: "Secure 25 official first-place finishes.",
    icon: "👑",
    category: "placement",
    periodType: "all_time",
    minimumMatches: 25,
    progressMetric: "firstPlaceCount",
    targetValue: 25,
    criteria: {
      combinator: "all",
      conditions: [{ metric: "firstPlaceCount", operator: "gte", value: 25 }],
    },
  },
  {
    code: "LEGEND",
    version: "v1",
    name: "Legend",
    description:
      "Build a legendary career with 1,000 kills, 50 wins and 10 MVP awards.",
    icon: "🌟",
    category: "career",
    periodType: "all_time",
    minimumMatches: 100,
    progressMetric: "totalKills",
    targetValue: 1000,
    criteria: {
      combinator: "all",
      conditions: [
        { metric: "totalKills", operator: "gte", value: 1000 },
        { metric: "firstPlaceCount", operator: "gte", value: 50 },
        { metric: "mvpCount", operator: "gte", value: 10 },
      ],
    },
  },
  {
    code: "FIRST_PLACE_STREAK",
    version: "v1",
    name: "First Place Streak",
    description: "Finish first in three consecutive verified matches.",
    icon: "🥇",
    category: "streak",
    periodType: "all_time",
    minimumMatches: 3,
    progressMetric: "longestFirstPlaceStreak",
    targetValue: 3,
    criteria: {
      combinator: "all",
      conditions: [{ metric: "longestFirstPlaceStreak", operator: "gte", value: 3 }],
    },
  },
  {
    code: "KILL_STREAK_20",
    version: "v1",
    name: "20 Kill Strike",
    description: "Record at least 20 kills in one verified match.",
    icon: "🎯",
    category: "streak",
    periodType: "all_time",
    minimumMatches: 1,
    progressMetric: "highestKillsInMatch",
    targetValue: 20,
    criteria: {
      combinator: "all",
      conditions: [{ metric: "highestKillsInMatch", operator: "gte", value: 20 }],
    },
  },
  {
    code: "KILL_STREAK_30",
    version: "v1",
    name: "30 Kill Rampage",
    description: "Record at least 30 kills in one verified match.",
    icon: "💥",
    category: "streak",
    periodType: "all_time",
    minimumMatches: 1,
    progressMetric: "highestKillsInMatch",
    targetValue: 30,
    criteria: {
      combinator: "all",
      conditions: [{ metric: "highestKillsInMatch", operator: "gte", value: 30 }],
    },
  },
]);

function requestAuditFields(requestMeta = {}) {
  return {
    ipAddress: requestMeta.ipAddress ?? null,
    userAgent: requestMeta.userAgent ?? null,
    requestId: requestMeta.requestId ?? null,
  };
}

function serializePlayer(player) {
  if (!player) return null;
  return {
    id: String(player._id),
    playerId: player.playerId,
    name: player.name,
    photoUrl: player.profileImage?.secureUrl ?? null,
    status: player.status,
  };
}

function snapshot(definition) {
  return {
    code: definition.code,
    version: definition.version,
    name: definition.name,
    description: definition.description,
    icon: definition.icon,
    category: definition.category,
    periodType: definition.periodType,
    progressMetric: definition.progressMetric,
    targetValue: definition.targetValue,
  };
}

function serializeDefinition(document, includeGovernance = false) {
  const value =
    typeof document?.toObject === "function" ? document.toObject() : document;
  if (!value) return null;
  const result = {
    id: String(value._id),
    code: value.code,
    version: value.version,
    name: value.name,
    description: value.description,
    icon: value.icon,
    category: value.category,
    periodType: value.periodType,
    minimumMatches: value.minimumMatches,
    criteria: value.criteria,
    progressMetric: value.progressMetric,
    targetValue: value.targetValue,
    isActive: value.isActive,
    activatedAt: value.activatedAt,
    supersedesAchievementId: value.supersedesAchievementId
      ? String(value.supersedesAchievementId)
      : null,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
  if (includeGovernance) {
    result.createdBy = value.createdBy;
    result.updatedBy = value.updatedBy;
    result.createdReason = value.createdReason;
  }
  return result;
}

function serializeProgress(document, player = null) {
  const value =
    typeof document?.toObject === "function" ? document.toObject() : document;
  if (!value) return null;
  return {
    id: value._id ? String(value._id) : null,
    playerId: String(value.playerId),
    player: serializePlayer(player),
    achievement: value.achievementSnapshot,
    progress: value.progress,
    isUnlocked: value.isUnlocked,
    unlockedAt: value.unlockedAt,
    firstEvaluatedAt: value.firstEvaluatedAt,
    lastEvaluatedAt: value.lastEvaluatedAt,
    evidence: value.evidence,
  };
}

function definitionInput(input, actor, supersedesAchievementId = null) {
  return {
    code: input.code,
    version: input.version,
    name: input.name,
    description: input.description,
    icon: input.icon,
    category: input.category,
    periodType: input.periodType,
    minimumMatches: input.minimumMatches,
    criteria: input.criteria,
    progressMetric: input.progressMetric,
    targetValue: input.targetValue,
    isActive: false,
    activatedAt: null,
    supersedesAchievementId,
    createdBy: actor.id,
    updatedBy: actor.id,
    createdReason: input.reason,
  };
}

function notFound() {
  return new AppError({
    statusCode: 404,
    code: "ACHIEVEMENT_NOT_FOUND",
    message: "Achievement definition was not found.",
  });
}

function recordsFromStatistics(statistics) {
  return {
    highestKillsInMatch: Number(statistics.records?.highestKills?.value ?? 0),
    highestDeathsInMatch: Number(statistics.records?.highestDeaths?.value ?? 0),
    bestMatchKdr: Number(statistics.records?.bestKdr?.value ?? 0),
    longestMvpStreak: Number(statistics.records?.longestMvpStreak ?? 0),
    longestFirstPlaceStreak: Number(statistics.records?.longestFirstPlaceStreak ?? 0),
    mostMatchesInOneDay: Number(statistics.records?.mostMatchesInOneDay?.value ?? 0),
    killStreak: Number(statistics.records?.highestKills?.value ?? 0),
    currentMvpStreak: 0,
    currentFirstPlaceStreak: 0,
    improvementRate: 0,
  };
}

export function createAchievementService({
  AchievementModel = Achievement,
  PlayerAchievementModel = PlayerAchievement,
  PlayerStatisticsModel = PlayerStatistics,
  PlayerModel = Player,
  NotificationModel = Notification,
  AuditLogModel = AuditLog,
  analytics = analyticsService,
} = {}) {
  async function ensureDefaultAchievements() {
    const existing = await AchievementModel.find({
      code: { $in: DEFAULT_ACHIEVEMENTS.map((item) => item.code) },
    })
      .select({ code: 1 })
      .lean();
    const existingCodes = new Set(existing.map((item) => item.code));
    const missing = DEFAULT_ACHIEVEMENTS.filter(
      (item) => !existingCodes.has(item.code),
    );
    if (!missing.length) return;
    try {
      await AchievementModel.insertMany(
        missing.map((item) => ({
          ...item,
          isActive: true,
          activatedAt: new Date(),
          supersedesAchievementId: null,
          createdBy: "system:bootstrap",
          updatedBy: "system:bootstrap",
          createdReason: "Create the required initial achievement definitions.",
        })),
        { ordered: false },
      );
    } catch (error) {
      if (
        error?.code !== 11000 &&
        !error?.writeErrors?.every((item) => item.code === 11000)
      ) {
        throw error;
      }
    }
  }

  async function findDefinition(identifier, session = null) {
    const filter = mongoose.isValidObjectId(identifier)
      ? { _id: identifier }
      : { code: String(identifier).toUpperCase(), isActive: true };
    let query = AchievementModel.findOne(filter);
    if (session) query = query.session(session);
    return query;
  }

  async function resolveEvaluationEntries(definitions, input = {}) {
    const playerFilter = input.playerIds?.length
      ? { playerId: { $in: input.playerIds } }
      : {};
    const result = new Map();
    const allTimeDefinitions = definitions.filter(
      (definition) => definition.periodType === "all_time",
    );
    if (allTimeDefinitions.length) {
      const statistics = await PlayerStatisticsModel.find(playerFilter).lean();
      result.set(
        "all_time",
        statistics.map((item) => ({
          playerId: String(item.playerId),
          metrics: item.metrics,
          records: recordsFromStatistics(item),
          period: { type: "all_time", key: "all_time" },
        })),
      );
    }

    for (const periodType of ["weekly", "monthly", "season"]) {
      if (!definitions.some((definition) => definition.periodType === periodType)) {
        continue;
      }
      const period = await analytics.resolvePeriod({
        periodType,
        date: input.date,
        seasonId: input.seasonId,
      });
      const periodResult = await analytics.ensurePeriodStatistics(period);
      result.set(
        periodType,
        periodResult.entries
          .filter(
            (entry) =>
              !input.playerIds?.length ||
              input.playerIds.includes(String(entry.playerId)),
          )
          .map((entry) => ({
            playerId: String(entry.playerId),
            metrics: entry.metrics,
            records: {
              improvementRate: Number(entry.improvementRate ?? 0),
            },
            period: periodResult.period,
          })),
      );
    }
    return result;
  }

  async function evaluate(input, actor, requestMeta = {}) {
    await ensureDefaultAchievements();
    const filter = { isActive: true };
    if (input.codes?.length) filter.code = { $in: input.codes };
    const definitions = await AchievementModel.find(filter).lean();
    if (!definitions.length) {
      throw new AppError({
        statusCode: 422,
        code: "NO_ACTIVE_ACHIEVEMENTS",
        message: "No active achievement definitions matched the request.",
      });
    }

    let playerIds = input.playerIds?.map(String) ?? null;
    if (input.playerCode) {
      const player = await PlayerModel.findOne({ playerId: input.playerCode })
        .select({ _id: 1 })
        .lean();
      if (!player) {
        throw new AppError({
          statusCode: 404,
          code: "PLAYER_NOT_FOUND",
          message: "Player profile was not found.",
        });
      }
      playerIds = [String(player._id)];
    }

    const entriesByPeriod = await resolveEvaluationEntries(definitions, {
      ...input,
      playerIds,
    });
    const evaluations = [];
    for (const definition of definitions) {
      for (const entry of entriesByPeriod.get(definition.periodType) ?? []) {
        evaluations.push({
          definition,
          entry,
          evaluation: evaluateAchievementDefinition(definition, entry),
        });
      }
    }

    const runId = crypto.randomUUID();
    const now = new Date();
    const session = await mongoose.startSession();
    const unlocked = [];
    let updatedCount = 0;
    try {
      await session.withTransaction(async () => {
        for (const item of evaluations) {
          let progress = await PlayerAchievementModel.findOne({
            playerId: item.entry.playerId,
            achievementCode: item.definition.code,
          }).session(session);
          if (progress?.isUnlocked) continue;

          const wasUnlocked = Boolean(progress?.isUnlocked);
          if (!progress) {
            progress = new PlayerAchievementModel({
              playerId: item.entry.playerId,
              achievementId: item.definition._id,
              achievementCode: item.definition.code,
              achievementVersion: item.definition.version,
              achievementSnapshot: snapshot(item.definition),
              progress: item.evaluation.progress,
              isUnlocked: false,
              unlockedAt: null,
              evidence: item.evaluation,
              evaluationRunId: runId,
              firstEvaluatedAt: now,
              lastEvaluatedAt: now,
            });
          } else {
            progress.achievementId = item.definition._id;
            progress.achievementVersion = item.definition.version;
            progress.achievementSnapshot = snapshot(item.definition);
            progress.progress = {
              ...item.evaluation.progress,
              conditions: item.evaluation.conditions,
            };
            progress.evidence = item.evaluation;
            progress.evaluationRunId = runId;
            progress.lastEvaluatedAt = now;
          }
          progress.progress.conditions = item.evaluation.conditions;
          if (item.evaluation.unlocked && !wasUnlocked) {
            progress.isUnlocked = true;
            progress.unlockedAt = now;
            progress.progress.percentage = 100;
          }
          await progress.save({ session });
          updatedCount += 1;
          if (item.evaluation.unlocked && !wasUnlocked) {
            unlocked.push({
              id: String(progress._id),
              playerId: String(progress.playerId),
              achievement:
                progress.achievementSnapshot.toObject?.() ??
                progress.achievementSnapshot,
            });
          }
        }

        await AuditLogModel.create(
          [
            {
              actorUserId: actor.id,
              action: "achievement.recalculated",
              entityType: "achievement_evaluation",
              entityId: runId,
              previousValue: null,
              newValue: {
                runId,
                definitions: definitions.map((item) => ({
                  code: item.code,
                  version: item.version,
                })),
                evaluatedRecords: evaluations.length,
                updatedProgress: updatedCount,
                newlyUnlocked: unlocked.length,
              },
              reason: input.reason,
              ...requestAuditFields(requestMeta),
            },
          ],
          { session },
        );
      });
    } finally {
      await session.endSession();
    }

    if (unlocked.length) {
      const players = await PlayerModel.find({
        _id: { $in: unlocked.map((item) => item.playerId) },
      })
        .select({ linkedUserId: 1, playerId: 1, name: 1 })
        .lean();
      const playerMap = new Map(players.map((item) => [String(item._id), item]));
      const notifications = unlocked
        .map((item) => {
          const player = playerMap.get(item.playerId);
          if (!player?.linkedUserId) return null;
          return {
            userId: player.linkedUserId,
            type: "achievement_unlocked",
            title: `Achievement unlocked: ${item.achievement.name}`,
            message: `${player.name} unlocked ${item.achievement.name}.`,
            relatedEntity: {
              entityType: "player_achievement",
              entityId: item.id,
            },
            data: {
              playerId: player.playerId,
              achievementCode: item.achievement.code,
            },
          };
        })
        .filter(Boolean);
      if (notifications.length) await NotificationModel.insertMany(notifications);
    }

    return {
      runId,
      evaluatedDefinitions: definitions.length,
      evaluatedRecords: evaluations.length,
      updatedProgress: updatedCount,
      newlyUnlocked: unlocked.length,
    };
  }

  return Object.freeze({
    ensureDefaultAchievements,

    async listPublicDefinitions({ category } = {}) {
      await ensureDefaultAchievements();
      const filter = { isActive: true };
      if (category) filter.category = category;
      const definitions = await AchievementModel.find(filter)
        .sort({ category: 1, targetValue: 1, name: 1 })
        .lean();
      const counts = await PlayerAchievementModel.aggregate([
        { $match: { isUnlocked: true } },
        { $group: { _id: "$achievementCode", count: { $sum: 1 } } },
      ]);
      const countMap = new Map(counts.map((item) => [item._id, item.count]));
      return definitions.map((item) => ({
        ...serializeDefinition(item),
        unlockedPlayerCount: countMap.get(item.code) ?? 0,
      }));
    },

    async getPublicDefinition(code) {
      await ensureDefaultAchievements();
      const definition = await AchievementModel.findOne({
        code: String(code).toUpperCase(),
        isActive: true,
      }).lean();
      if (!definition) throw notFound();
      const recent = await PlayerAchievementModel.find({
        achievementCode: definition.code,
        isUnlocked: true,
      })
        .sort({ unlockedAt: -1 })
        .limit(20)
        .lean();
      const players = await PlayerModel.find({
        _id: { $in: recent.map((item) => item.playerId) },
      })
        .select({ playerId: 1, name: 1, profileImage: 1, status: 1 })
        .lean();
      const playerMap = new Map(players.map((item) => [String(item._id), item]));
      return {
        definition: serializeDefinition(definition),
        recentUnlocks: recent.map((item) =>
          serializeProgress(item, playerMap.get(String(item.playerId))),
        ),
      };
    },

    async getPlayerAchievements(playerCode, { unlocked, category } = {}) {
      await ensureDefaultAchievements();
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
      const definitions = await AchievementModel.find({ isActive: true })
        .sort({ category: 1, targetValue: 1 })
        .lean();
      const progressItems = await PlayerAchievementModel.find({
        playerId: player._id,
      }).lean();
      const progressMap = new Map(
        progressItems.map((item) => [item.achievementCode, item]),
      );
      let items = definitions.map((definition) => {
        const progress = progressMap.get(definition.code);
        if (progress) return serializeProgress(progress, player);
        return {
          id: null,
          playerId: String(player._id),
          player: serializePlayer(player),
          achievement: snapshot(definition),
          progress: {
            current: 0,
            target: definition.targetValue,
            percentage: 0,
            conditions: [],
          },
          isUnlocked: false,
          unlockedAt: null,
          firstEvaluatedAt: null,
          lastEvaluatedAt: null,
          evidence: null,
        };
      });
      if (typeof unlocked === "boolean") {
        items = items.filter((item) => item.isUnlocked === unlocked);
      }
      if (category) {
        items = items.filter((item) => item.achievement.category === category);
      }
      return {
        player: serializePlayer(player),
        summary: {
          total: items.length,
          unlocked: items.filter((item) => item.isUnlocked).length,
          locked: items.filter((item) => !item.isUnlocked).length,
        },
        items,
      };
    },

    async listDefinitions({ page = 1, limit = 20, code, active } = {}) {
      await ensureDefaultAchievements();
      const filter = {};
      if (code) filter.code = code;
      if (typeof active === "boolean") filter.isActive = active;
      const totalItems = await AchievementModel.countDocuments(filter);
      const totalPages = Math.max(1, Math.ceil(totalItems / limit));
      const safePage = Math.min(page, totalPages);
      const items = await AchievementModel.find(filter)
        .sort({ code: 1, isActive: -1, createdAt: -1 })
        .skip((safePage - 1) * limit)
        .limit(limit)
        .lean();
      return {
        items: items.map((item) => serializeDefinition(item, true)),
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

    async createDefinition(input, actor, requestMeta = {}) {
      const exists = await AchievementModel.exists({
        code: input.code,
        version: input.version,
      });
      if (exists) {
        throw new AppError({
          statusCode: 409,
          code: "ACHIEVEMENT_VERSION_EXISTS",
          message: "This achievement code and version already exist.",
        });
      }
      const created = await AchievementModel.create(definitionInput(input, actor));
      await AuditLogModel.create({
        actorUserId: actor.id,
        action: "achievement.created",
        entityType: "achievement",
        entityId: String(created._id),
        previousValue: null,
        newValue: serializeDefinition(created, true),
        reason: input.reason,
        ...requestAuditFields(requestMeta),
      });
      return serializeDefinition(created, true);
    },

    async createRevision(identifier, input, actor, requestMeta = {}) {
      const previous = await findDefinition(identifier);
      if (!previous) throw notFound();
      const exists = await AchievementModel.exists({
        code: previous.code,
        version: input.version,
      });
      if (exists) {
        throw new AppError({
          statusCode: 409,
          code: "ACHIEVEMENT_VERSION_EXISTS",
          message: "This version already exists for the achievement.",
        });
      }
      const merged = {
        code: previous.code,
        version: input.version,
        name: input.name ?? previous.name,
        description: input.description ?? previous.description,
        icon: input.icon ?? previous.icon,
        category: input.category ?? previous.category,
        periodType: input.periodType ?? previous.periodType,
        minimumMatches: input.minimumMatches ?? previous.minimumMatches,
        criteria: input.criteria ?? previous.criteria.toObject?.() ?? previous.criteria,
        progressMetric: input.progressMetric ?? previous.progressMetric,
        targetValue: input.targetValue ?? previous.targetValue,
        reason: input.reason,
      };
      const created = await AchievementModel.create(
        definitionInput(merged, actor, previous._id),
      );
      await AuditLogModel.create({
        actorUserId: actor.id,
        action: "achievement.updated",
        entityType: "achievement",
        entityId: String(created._id),
        previousValue: serializeDefinition(previous, true),
        newValue: serializeDefinition(created, true),
        reason: input.reason,
        ...requestAuditFields(requestMeta),
      });
      return serializeDefinition(created, true);
    },

    async activateDefinition(identifier, input, actor, requestMeta = {}) {
      const session = await mongoose.startSession();
      let activated;
      try {
        await session.withTransaction(async () => {
          const target = await findDefinition(identifier, session);
          if (!target) throw notFound();
          await AchievementModel.updateMany(
            { code: target.code, isActive: true, _id: { $ne: target._id } },
            { $set: { isActive: false, updatedBy: actor.id } },
            { session },
          );
          target.isActive = true;
          target.activatedAt = new Date();
          target.updatedBy = actor.id;
          activated = await target.save({ session });
          await AuditLogModel.create(
            [
              {
                actorUserId: actor.id,
                action: "achievement.activated",
                entityType: "achievement",
                entityId: String(target._id),
                previousValue: null,
                newValue: serializeDefinition(activated, true),
                reason: input.reason,
                ...requestAuditFields(requestMeta),
              },
            ],
            { session },
          );
        });
      } finally {
        await session.endSession();
      }
      return serializeDefinition(activated, true);
    },

    async deactivateDefinition(identifier, input, actor, requestMeta = {}) {
      const target = await findDefinition(identifier);
      if (!target) throw notFound();
      const previous = serializeDefinition(target, true);
      target.isActive = false;
      target.updatedBy = actor.id;
      const updated = await target.save();
      await AuditLogModel.create({
        actorUserId: actor.id,
        action: "achievement.deactivated",
        entityType: "achievement",
        entityId: String(target._id),
        previousValue: previous,
        newValue: serializeDefinition(updated, true),
        reason: input.reason,
        ...requestAuditFields(requestMeta),
      });
      return serializeDefinition(updated, true);
    },

    evaluate,

    async evaluatePlayerIds(playerIds, { actor, reason, requestMeta = {} }) {
      if (!playerIds?.length) {
        return {
          runId: null,
          evaluatedDefinitions: 0,
          evaluatedRecords: 0,
          updatedProgress: 0,
          newlyUnlocked: 0,
        };
      }
      return evaluate(
        {
          playerIds: [...new Set(playerIds.map(String))],
          reason,
        },
        actor,
        requestMeta,
      );
    },
  });
}

export const achievementService = createAchievementService();
