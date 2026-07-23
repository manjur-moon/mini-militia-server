import crypto from "node:crypto";
import mongoose from "mongoose";
import { createPaginationMeta } from "@mini-militia/shared";
import { AuditLog } from "../models/audit-log.model.js";
import { Challenge } from "../models/challenge.model.js";
import { MVPAward } from "../models/mvp-award.model.js";
import { Notification } from "../models/notification.model.js";
import { PlayerChallenge } from "../models/player-challenge.model.js";
import { Player } from "../models/player.model.js";
import { AppError } from "../utils/app-error.js";
import { analyticsService } from "./analytics.service.js";
import { evaluateChallengeProgress } from "./challenge-rule.service.js";

const DEFAULT_CHALLENGE_TEMPLATES = Object.freeze([
  {
    code: "WEEKLY_KILLS_100",
    version: "1.0.0",
    name: "Century Assault",
    description: "Get at least 100 kills during the league week.",
    icon: "💯",
    type: "weekly",
    metric: "totalKills",
    targetOperator: "gte",
    targetValue: 100,
    minimumMatches: 1,
    reward: {
      name: "Century Assault Badge",
      badgeIcon: "💯",
      description: "Awarded for reaching 100 weekly kills.",
    },
  },
  {
    code: "WEEKLY_FIRST_PLACE_10",
    version: "1.0.0",
    name: "Weekly Arena King",
    description: "Finish first at least 10 times during the league week.",
    icon: "👑",
    type: "weekly",
    metric: "firstPlaceCount",
    targetOperator: "gte",
    targetValue: 10,
    minimumMatches: 10,
    reward: {
      name: "Weekly Arena King Badge",
      badgeIcon: "👑",
      description: "Awarded for ten weekly first-place finishes.",
    },
  },
  {
    code: "WEEKLY_KDR_2",
    version: "1.0.0",
    name: "Elite Efficiency",
    description: "Maintain a KDR above 2.0 during the league week.",
    icon: "🎯",
    type: "weekly",
    metric: "kdr",
    targetOperator: "gt",
    targetValue: 2,
    minimumMatches: 3,
    reward: {
      name: "Elite Efficiency Badge",
      badgeIcon: "🎯",
      description: "Awarded for maintaining an elite weekly KDR.",
    },
  },
  {
    code: "MONTHLY_KILLS_500",
    version: "1.0.0",
    name: "Monthly Eliminator",
    description: "Get at least 500 kills during the league month.",
    icon: "🔥",
    type: "monthly",
    metric: "totalKills",
    targetOperator: "gte",
    targetValue: 500,
    minimumMatches: 1,
    reward: {
      name: "Monthly Eliminator Badge",
      badgeIcon: "🔥",
      description: "Awarded for reaching 500 monthly kills.",
    },
  },
  {
    code: "MONTHLY_FIRST_PLACE_25",
    version: "1.0.0",
    name: "Monthly Champion",
    description: "Finish first at least 25 times during the league month.",
    icon: "🏆",
    type: "monthly",
    metric: "firstPlaceCount",
    targetOperator: "gte",
    targetValue: 25,
    minimumMatches: 25,
    reward: {
      name: "Monthly Champion Badge",
      badgeIcon: "🏆",
      description: "Awarded for 25 monthly first-place finishes.",
    },
  },
  {
    code: "MONTHLY_MVP_3",
    version: "1.0.0",
    name: "MVP Collector",
    description: "Win at least three weekly MVP awards during the month.",
    icon: "⭐",
    type: "monthly",
    metric: "mvpCount",
    targetOperator: "gte",
    targetValue: 3,
    minimumMatches: 3,
    reward: {
      name: "MVP Collector Badge",
      badgeIcon: "⭐",
      description: "Awarded for collecting three weekly MVP awards in a month.",
    },
  },
]);

const ZERO_METRICS = Object.freeze({
  matchesPlayed: 0,
  totalKills: 0,
  totalDeaths: 0,
  kdr: 0,
  averageKills: 0,
  averageDeaths: 0,
  averageRank: 0,
  winRate: 0,
  firstPlaceCount: 0,
  lastPlaceCount: 0,
  mvpCount: 0,
  currentMvpStreak: 0,
  currentFirstPlaceStreak: 0,
  highestKillsInMatch: 0,
  highestDeathsInMatch: 0,
  bestMatchKdr: 0,
  longestMvpStreak: 0,
  longestFirstPlaceStreak: 0,
  mostMatchesInOneDay: 0,
  killStreak: 0,
  improvementRate: 0,
});

function auditFields(requestMeta = {}) {
  return {
    ipAddress: requestMeta.ipAddress ?? null,
    userAgent: requestMeta.userAgent ?? null,
    requestId: requestMeta.requestId ?? null,
  };
}

function lifecycleStatus(startAt, endAt, now = new Date()) {
  if (now < startAt) return "upcoming";
  if (now >= endAt) return "completed";
  return "active";
}

function sanitizePeriodKey(value) {
  return String(value)
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .toUpperCase();
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

function snapshot(challenge) {
  return {
    code: challenge.code,
    version: challenge.version,
    name: challenge.name,
    description: challenge.description,
    icon: challenge.icon,
    type: challenge.type,
    metric: challenge.metric,
    targetOperator: challenge.targetOperator,
    targetValue: challenge.targetValue,
    startAt: challenge.startAt,
    endAt: challenge.endAt,
    timezone: challenge.timezone,
    reward: challenge.reward?.toObject?.() ?? challenge.reward,
  };
}

function serializeChallenge(challenge, includeGovernance = false) {
  const value = challenge?.toObject?.() ?? challenge;
  return {
    id: String(value._id),
    code: value.code,
    version: value.version,
    name: value.name,
    description: value.description,
    icon: value.icon,
    type: value.type,
    status: value.status,
    startAt: value.startAt,
    endAt: value.endAt,
    timezone: value.timezone,
    metric: value.metric,
    targetOperator: value.targetOperator,
    targetValue: value.targetValue,
    minimumMatches: value.minimumMatches,
    minimumEligibility: value.minimumEligibility ?? null,
    reward: value.reward,
    isSystemDefault: value.isSystemDefault,
    completedAt: value.completedAt ?? null,
    archivedAt: value.archivedAt ?? null,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    ...(includeGovernance
      ? {
          createdBy: value.createdBy,
          updatedBy: value.updatedBy,
          statusChangedAt: value.statusChangedAt ?? null,
        }
      : {}),
  };
}

function serializeProgress(progress, player = null) {
  const value = progress?.toObject?.() ?? progress;
  return {
    id: value._id ? String(value._id) : null,
    playerId: String(value.playerId),
    player: serializePlayer(player),
    challengeId: String(value.challengeId),
    challengeCode: value.challengeCode,
    challengeVersion: value.challengeVersion,
    challenge: value.challengeSnapshot,
    isEligible: value.isEligible,
    currentValue: value.currentValue,
    targetValue: value.targetValue,
    progressPercentage: value.progressPercentage,
    status: value.status,
    completedAt: value.completedAt ?? null,
    evidence: value.evidence ?? null,
    firstEvaluatedAt: value.firstEvaluatedAt,
    lastEvaluatedAt: value.lastEvaluatedAt,
  };
}

function challengeNotFound() {
  return new AppError({
    statusCode: 404,
    code: "CHALLENGE_NOT_FOUND",
    message: "Challenge was not found.",
  });
}

function playerNotFound() {
  return new AppError({
    statusCode: 404,
    code: "PLAYER_NOT_FOUND",
    message: "Player profile was not found.",
  });
}

function mongoId(value) {
  return value instanceof mongoose.Types.ObjectId
    ? value
    : new mongoose.Types.ObjectId(value);
}

export function createChallengeService({
  ChallengeModel = Challenge,
  PlayerChallengeModel = PlayerChallenge,
  PlayerModel = Player,
  MVPAwardModel = MVPAward,
  NotificationModel = Notification,
  AuditLogModel = AuditLog,
  analytics = analyticsService,
} = {}) {
  async function resolveAlignedPeriod(type, startAt, endAt) {
    const period = await analytics.resolvePeriod({ periodType: type, date: startAt });
    if (
      new Date(startAt).getTime() !== new Date(period.startAt).getTime() ||
      new Date(endAt).getTime() !== new Date(period.endAt).getTime()
    ) {
      throw new AppError({
        statusCode: 422,
        code: "CHALLENGE_PERIOD_MISALIGNED",
        message: `Challenge dates must match the configured ${type} league boundary exactly.`,
        errors: [
          {
            path: "startAt",
            message: `Expected ${new Date(period.startAt).toISOString()} through ${new Date(period.endAt).toISOString()}.`,
          },
        ],
      });
    }
    return period;
  }

  async function ensureDefaultChallenges(date = new Date()) {
    const periods = await Promise.all([
      analytics.resolvePeriod({ periodType: "weekly", date }),
      analytics.resolvePeriod({ periodType: "monthly", date }),
    ]);
    const periodMap = new Map(periods.map((period) => [period.type, period]));
    const now = new Date();
    const operations = DEFAULT_CHALLENGE_TEMPLATES.map((template) => {
      const period = periodMap.get(template.type);
      const code = `${template.code}_${sanitizePeriodKey(period.key)}`;
      const status = lifecycleStatus(period.startAt, period.endAt, now);
      return {
        updateOne: {
          filter: { code },
          update: {
            $setOnInsert: {
              ...template,
              code,
              status,
              startAt: period.startAt,
              endAt: period.endAt,
              timezone: period.timezone,
              minimumEligibility: null,
              isSystemDefault: true,
              createdBy: "system",
              updatedBy: "system",
              statusChangedAt: now,
              completedAt: status === "completed" ? now : null,
              archivedAt: null,
            },
          },
          upsert: true,
        },
      };
    });
    if (operations.length)
      await ChallengeModel.bulkWrite(operations, { ordered: false });
    return ChallengeModel.find({
      code: { $in: operations.map((operation) => operation.updateOne.filter.code) },
    }).lean();
  }

  async function syncLifecycle(now = new Date()) {
    await ChallengeModel.updateMany(
      { status: "upcoming", startAt: { $lte: now }, endAt: { $gt: now } },
      { $set: { status: "active", statusChangedAt: now, updatedBy: "system" } },
    );
    const expiring = await ChallengeModel.find({
      status: { $in: ["upcoming", "active"] },
      endAt: { $lte: now },
    })
      .select({ _id: 1 })
      .lean();
    const ids = expiring.map((item) => item._id);
    if (ids.length) {
      await ChallengeModel.updateMany(
        { _id: { $in: ids } },
        {
          $set: {
            status: "completed",
            completedAt: now,
            statusChangedAt: now,
            updatedBy: "system",
          },
        },
      );
      await PlayerChallengeModel.updateMany(
        { challengeId: { $in: ids }, status: "in_progress" },
        { $set: { status: "expired", lastEvaluatedAt: now } },
      );
    }
    return { completedChallenges: ids.length };
  }

  async function loadMetrics(challenge, playerIds = null) {
    const period = await analytics.resolvePeriod({
      periodType: challenge.type,
      date: challenge.startAt,
    });
    const result = await analytics.ensurePeriodStatistics(period, { force: true });
    const requested = playerIds ? new Set(playerIds.map(String)) : null;
    const metricsByPlayer = new Map();
    for (const entry of result.entries) {
      if (!requested || requested.has(String(entry.playerId))) {
        metricsByPlayer.set(String(entry.playerId), {
          ...ZERO_METRICS,
          ...entry.metrics,
        });
      }
    }
    const players = await PlayerModel.find({
      status: "active",
      ...(requested ? { _id: { $in: [...requested].map(mongoId) } } : {}),
    })
      .select({ playerId: 1, name: 1, profileImage: 1, status: 1, linkedUserId: 1 })
      .lean();
    for (const player of players) {
      if (!metricsByPlayer.has(String(player._id))) {
        metricsByPlayer.set(String(player._id), { ...ZERO_METRICS });
      }
    }
    if (
      challenge.metric === "mvpCount" ||
      challenge.minimumEligibility?.conditions?.some(
        (condition) => condition.metric === "mvpCount",
      )
    ) {
      const mvpCounts = await MVPAwardModel.aggregate([
        {
          $match: {
            awardType: "weekly",
            status: "current",
            endAt: { $gt: challenge.startAt, $lte: challenge.endAt },
            ...(requested ? { playerId: { $in: [...requested].map(mongoId) } } : {}),
          },
        },
        { $group: { _id: "$playerId", count: { $sum: 1 } } },
      ]);
      for (const item of mvpCounts) {
        const key = String(item._id);
        metricsByPlayer.set(key, {
          ...(metricsByPlayer.get(key) ?? ZERO_METRICS),
          mvpCount: item.count,
        });
      }
    }
    return { period, metricsByPlayer, players };
  }

  async function evaluate(input = {}, actor = null, requestMeta = {}) {
    const dates = input.dates?.length
      ? input.dates.map((item) => new Date(item))
      : [new Date(input.date ?? Date.now())];
    for (const date of dates) await ensureDefaultChallenges(date);
    await syncLifecycle();

    let playerIds = input.playerIds?.map(String) ?? null;
    if (input.playerCode) {
      const player = await PlayerModel.findOne({
        playerId: String(input.playerCode).toUpperCase(),
      })
        .select({ _id: 1 })
        .lean();
      if (!player) throw playerNotFound();
      playerIds = [String(player._id)];
    }

    const dateRanges = dates.map((date) => ({
      startAt: { $lte: date },
      endAt: { $gt: date },
    }));
    const challenges = await ChallengeModel.find({
      status: { $in: ["active", "completed"] },
      $or: dateRanges,
    }).sort({ startAt: 1, code: 1 });

    const runId = crypto.randomUUID();
    const now = new Date();
    const completed = [];
    let updatedProgress = 0;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        for (const challenge of challenges) {
          const { metricsByPlayer, players } = await loadMetrics(challenge, playerIds);
          for (const player of players) {
            const metrics = metricsByPlayer.get(String(player._id)) ?? {
              ...ZERO_METRICS,
            };
            const evaluation = evaluateChallengeProgress(challenge, metrics);
            let progress = await PlayerChallengeModel.findOne({
              playerId: player._id,
              challengeId: challenge._id,
            }).session(session);
            const wasCompleted = progress?.status === "completed";
            if (!progress) {
              progress = new PlayerChallengeModel({
                playerId: player._id,
                challengeId: challenge._id,
                challengeCode: challenge.code,
                challengeVersion: challenge.version,
                challengeSnapshot: snapshot(challenge),
                isEligible: evaluation.eligibility.eligible,
                currentValue: evaluation.currentValue,
                targetValue: evaluation.targetValue,
                progressPercentage: evaluation.progressPercentage,
                status: evaluation.completed
                  ? "completed"
                  : challenge.status === "completed"
                    ? "expired"
                    : "in_progress",
                completedAt: evaluation.completed ? now : null,
                evidence: { metrics, ...evaluation },
                evaluationRunId: runId,
                firstEvaluatedAt: now,
                lastEvaluatedAt: now,
              });
            } else {
              progress.challengeVersion = challenge.version;
              progress.challengeSnapshot = snapshot(challenge);
              progress.isEligible = evaluation.eligibility.eligible;
              progress.currentValue = evaluation.currentValue;
              progress.targetValue = evaluation.targetValue;
              progress.progressPercentage = evaluation.completed
                ? 100
                : evaluation.progressPercentage;
              progress.status = wasCompleted
                ? "completed"
                : evaluation.completed
                  ? "completed"
                  : challenge.status === "completed"
                    ? "expired"
                    : "in_progress";
              if (evaluation.completed && !progress.completedAt)
                progress.completedAt = now;
              progress.evidence = { metrics, ...evaluation };
              progress.evaluationRunId = runId;
              progress.lastEvaluatedAt = now;
            }
            await progress.save({ session });
            updatedProgress += 1;
            if (evaluation.completed && !wasCompleted) {
              completed.push({
                id: String(progress._id),
                playerId: String(player._id),
                playerCode: player.playerId,
                playerName: player.name,
                linkedUserId: player.linkedUserId,
                challenge: snapshot(challenge),
              });
            }
          }
        }
        if (actor) {
          await AuditLogModel.create(
            [
              {
                actorUserId: actor.id,
                action: "challenge.recalculated",
                entityType: "challenge_evaluation",
                entityId: runId,
                previousValue: null,
                newValue: {
                  runId,
                  challengeCount: challenges.length,
                  updatedProgress,
                  newlyCompleted: completed.length,
                },
                reason: input.reason ?? "Challenge progress recalculation.",
                ...auditFields(requestMeta),
              },
            ],
            { session },
          );
        }
      });
    } finally {
      await session.endSession();
    }

    const notifications = completed
      .filter((item) => item.linkedUserId)
      .map((item) => ({
        userId: item.linkedUserId,
        type: "challenge_completed",
        title: `Challenge completed: ${item.challenge.name}`,
        message: `${item.playerName} completed ${item.challenge.name}.`,
        relatedEntity: { entityType: "player_challenge", entityId: item.id },
        data: {
          playerId: item.playerCode,
          challengeCode: item.challenge.code,
          reward: item.challenge.reward,
        },
      }));
    if (notifications.length) await NotificationModel.insertMany(notifications);

    if (actor && completed.length) {
      await AuditLogModel.insertMany(
        completed.map((item) => ({
          actorUserId: actor.id,
          action: "challenge.completed",
          entityType: "player_challenge",
          entityId: item.id,
          previousValue: { status: "in_progress" },
          newValue: { status: "completed", challengeCode: item.challenge.code },
          reason: input.reason ?? "Challenge target reached.",
          ...auditFields(requestMeta),
        })),
      );
    }

    return {
      runId,
      evaluatedChallenges: challenges.length,
      updatedProgress,
      newlyCompleted: completed.length,
    };
  }

  async function getChallenge(identifier) {
    await ensureDefaultChallenges();
    await syncLifecycle();
    const isId = mongoose.isValidObjectId(identifier);
    const challenge = await ChallengeModel.findOne(
      isId ? { _id: identifier } : { code: String(identifier).toUpperCase() },
    ).lean();
    if (!challenge) throw challengeNotFound();
    return challenge;
  }

  return Object.freeze({
    ensureDefaultChallenges,
    syncLifecycle,
    evaluate,
    getChallenge,

    async listPublic({ type, status, lifecycle = "current" } = {}) {
      await ensureDefaultChallenges();
      await syncLifecycle();
      const now = new Date();
      const filter = { status: { $in: ["active", "completed", "upcoming"] } };
      if (type) filter.type = type;
      if (status) filter.status = status;
      if (lifecycle === "current") {
        filter.startAt = { $lte: now };
        filter.endAt = { $gt: now };
      }
      if (lifecycle === "history") filter.endAt = { $lte: now };
      const challenges = await ChallengeModel.find(filter)
        .sort({ startAt: -1, type: 1, name: 1 })
        .lean();
      const counts = await PlayerChallengeModel.aggregate([
        {
          $match: {
            challengeId: { $in: challenges.map((item) => item._id) },
            status: "completed",
          },
        },
        { $group: { _id: "$challengeId", completedPlayers: { $sum: 1 } } },
      ]);
      const countMap = new Map(
        counts.map((item) => [String(item._id), item.completedPlayers]),
      );
      return challenges.map((item) => ({
        ...serializeChallenge(item),
        completedPlayers: countMap.get(String(item._id)) ?? 0,
      }));
    },

    async getPublic(identifier) {
      const challenge = await getChallenge(identifier);
      if (["draft", "archived"].includes(challenge.status)) throw challengeNotFound();
      const leaderboard = await PlayerChallengeModel.find({
        challengeId: challenge._id,
      })
        .sort({ status: 1, progressPercentage: -1, currentValue: -1, completedAt: 1 })
        .limit(25)
        .lean();
      const players = await PlayerModel.find({
        _id: { $in: leaderboard.map((item) => item.playerId) },
      })
        .select({ playerId: 1, name: 1, profileImage: 1, status: 1 })
        .lean();
      const playerMap = new Map(players.map((item) => [String(item._id), item]));
      return {
        challenge: serializeChallenge(challenge),
        leaderboard: leaderboard.map((item) =>
          serializeProgress(item, playerMap.get(String(item.playerId))),
        ),
      };
    },

    async getPlayerChallenges(playerCode, { type, status, lifecycle = "all" } = {}) {
      await ensureDefaultChallenges();
      await syncLifecycle();
      const player = await PlayerModel.findOne({
        playerId: String(playerCode).toUpperCase(),
      })
        .select({ playerId: 1, name: 1, profileImage: 1, status: 1 })
        .lean();
      if (!player) throw playerNotFound();
      const challengeFilter = {};
      if (type) challengeFilter.type = type;
      const now = new Date();
      if (lifecycle === "current") {
        challengeFilter.startAt = { $lte: now };
        challengeFilter.endAt = { $gt: now };
      }
      if (lifecycle === "history") challengeFilter.endAt = { $lte: now };
      const challenges = await ChallengeModel.find(challengeFilter)
        .sort({ startAt: -1, name: 1 })
        .lean();
      const progress = await PlayerChallengeModel.find({
        playerId: player._id,
        challengeId: { $in: challenges.map((item) => item._id) },
        ...(status ? { status } : {}),
      }).lean();
      const progressMap = new Map(
        progress.map((item) => [String(item.challengeId), item]),
      );
      const items = challenges
        .filter((challenge) => !["draft", "archived"].includes(challenge.status))
        .map((challenge) => {
          const item = progressMap.get(String(challenge._id));
          if (item) return serializeProgress(item, player);
          return {
            id: null,
            playerId: String(player._id),
            player: serializePlayer(player),
            challengeId: String(challenge._id),
            challengeCode: challenge.code,
            challengeVersion: challenge.version,
            challenge: snapshot(challenge),
            isEligible: false,
            currentValue: 0,
            targetValue: challenge.targetValue,
            progressPercentage: 0,
            status: challenge.status === "completed" ? "expired" : "in_progress",
            completedAt: null,
            evidence: null,
          };
        })
        .filter((item) => !status || item.status === status);
      return {
        player: serializePlayer(player),
        summary: {
          total: items.length,
          inProgress: items.filter((item) => item.status === "in_progress").length,
          completed: items.filter((item) => item.status === "completed").length,
          expired: items.filter((item) => item.status === "expired").length,
        },
        items,
      };
    },

    async listAdmin({ page = 1, limit = 20, type, status, search } = {}) {
      await ensureDefaultChallenges();
      await syncLifecycle();
      const filter = {};
      if (type) filter.type = type;
      if (status) filter.status = status;
      if (search) {
        const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        filter.$or = [
          { code: { $regex: escaped, $options: "i" } },
          { name: { $regex: escaped, $options: "i" } },
        ];
      }
      const totalItems = await ChallengeModel.countDocuments(filter);
      const pagination = createPaginationMeta({ page, limit, totalItems });
      const safePage = Math.min(page, pagination.totalPages);
      const items = await ChallengeModel.find(filter)
        .sort({ startAt: -1, type: 1, code: 1 })
        .skip((safePage - 1) * limit)
        .limit(limit)
        .lean();
      return {
        items: items.map((item) => serializeChallenge(item, true)),
        pagination: createPaginationMeta({ page: safePage, limit, totalItems }),
      };
    },

    async create(input, actor, requestMeta = {}) {
      const { reason, ...challengeInput } = input;
      const period = await resolveAlignedPeriod(
        challengeInput.type,
        challengeInput.startAt,
        challengeInput.endAt,
      );
      if (await ChallengeModel.exists({ code: challengeInput.code })) {
        throw new AppError({
          statusCode: 409,
          code: "CHALLENGE_CODE_EXISTS",
          message: "A challenge with this code already exists.",
        });
      }
      const created = await ChallengeModel.create({
        ...challengeInput,
        timezone: period.timezone,
        isSystemDefault: false,
        createdBy: actor.id,
        updatedBy: actor.id,
        statusChangedAt: new Date(),
      });
      await AuditLogModel.create({
        actorUserId: actor.id,
        action: "challenge.created",
        entityType: "challenge",
        entityId: String(created._id),
        previousValue: null,
        newValue: serializeChallenge(created, true),
        reason,
        ...auditFields(requestMeta),
      });
      return serializeChallenge(created, true);
    },

    async update(identifier, input, actor, requestMeta = {}) {
      const challenge = await ChallengeModel.findById(identifier);
      if (!challenge) throw challengeNotFound();
      if (["completed", "archived"].includes(challenge.status)) {
        throw new AppError({
          statusCode: 409,
          code: "CHALLENGE_IMMUTABLE",
          message: "Completed or archived challenges cannot be edited.",
        });
      }
      const { reason, ...changes } = input;
      const previous = serializeChallenge(challenge, true);
      if (changes.startAt || changes.endAt || changes.type) {
        const type = changes.type ?? challenge.type;
        const startAt = changes.startAt ?? challenge.startAt;
        const endAt = changes.endAt ?? challenge.endAt;
        const period = await resolveAlignedPeriod(type, startAt, endAt);
        changes.timezone = period.timezone;
      }
      Object.assign(challenge, changes, { updatedBy: actor.id });
      await challenge.save();
      await AuditLogModel.create({
        actorUserId: actor.id,
        action: "challenge.updated",
        entityType: "challenge",
        entityId: String(challenge._id),
        previousValue: previous,
        newValue: serializeChallenge(challenge, true),
        reason,
        ...auditFields(requestMeta),
      });
      return serializeChallenge(challenge, true);
    },

    async changeStatus(identifier, { status, reason }, actor, requestMeta = {}) {
      const challenge = await ChallengeModel.findById(identifier);
      if (!challenge) throw challengeNotFound();
      const transitions = {
        draft: ["upcoming", "archived"],
        upcoming: ["active", "archived"],
        active: ["completed", "archived"],
        completed: ["archived"],
        archived: [],
      };
      if (!transitions[challenge.status]?.includes(status)) {
        throw new AppError({
          statusCode: 409,
          code: "INVALID_CHALLENGE_STATUS_TRANSITION",
          message: `Challenge cannot move from ${challenge.status} to ${status}.`,
        });
      }
      const previousStatus = challenge.status;
      challenge.status = status;
      challenge.statusChangedAt = new Date();
      challenge.updatedBy = actor.id;
      if (status === "completed") challenge.completedAt = new Date();
      if (status === "archived") challenge.archivedAt = new Date();
      await challenge.save();
      if (["completed", "archived"].includes(status)) {
        await PlayerChallengeModel.updateMany(
          { challengeId: challenge._id, status: "in_progress" },
          { $set: { status: "expired", lastEvaluatedAt: new Date() } },
        );
      }
      await AuditLogModel.create({
        actorUserId: actor.id,
        action: "challenge.status_changed",
        entityType: "challenge",
        entityId: String(challenge._id),
        previousValue: { status: previousStatus },
        newValue: { status },
        reason,
        ...auditFields(requestMeta),
      });
      return serializeChallenge(challenge, true);
    },

    async evaluatePlayerIds(
      playerIds,
      { actor, reason, requestMeta, dates, date } = {},
    ) {
      return evaluate(
        {
          playerIds: playerIds.map(String),
          dates: dates ?? (date ? [date] : undefined),
          reason: reason ?? "Automatic challenge progress update.",
        },
        actor,
        requestMeta,
      );
    },
  });
}

export const challengeService = createChallengeService();
