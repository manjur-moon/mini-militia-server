import crypto from "node:crypto";
import mongoose from "mongoose";
import { AuditLog } from "../models/audit-log.model.js";
import { DynamicTitle } from "../models/dynamic-title.model.js";
import { Notification } from "../models/notification.model.js";
import { PlayerTitle } from "../models/player-title.model.js";
import { Player } from "../models/player.model.js";
import { AppError } from "../utils/app-error.js";
import { analyticsService } from "./analytics.service.js";
import {
  calculateTitleExpiration,
  chooseCurrentTitle,
  evaluateTitleDefinition,
} from "./title-rule.service.js";

export const DEFAULT_DYNAMIC_TITLES = Object.freeze([
  {
    code: "KING_SLAYER",
    version: "v1",
    name: "King Slayer",
    description: "Dominates the weekly arena with repeated first-place finishes.",
    icon: "♛",
    periodType: "weekly",
    minimumMatches: 5,
    priority: 100,
    durationDays: 7,
    rules: {
      combinator: "all",
      conditions: [
        { metric: "firstPlaceCount", operator: "gte", value: 3 },
        { metric: "winRate", operator: "gte", value: 40 },
      ],
    },
  },
  {
    code: "TERMINATOR",
    version: "v1",
    name: "Terminator",
    description: "Produces an exceptional weekly kill total at a strong match average.",
    icon: "☠",
    periodType: "weekly",
    minimumMatches: 5,
    priority: 90,
    durationDays: 7,
    rules: {
      combinator: "all",
      conditions: [
        { metric: "totalKills", operator: "gte", value: 100 },
        { metric: "averageKills", operator: "gte", value: 15 },
      ],
    },
  },
  {
    code: "ON_FIRE",
    version: "v1",
    name: "On Fire",
    description: "Maintains a high weekly win rate with multiple first-place finishes.",
    icon: "🔥",
    periodType: "weekly",
    minimumMatches: 4,
    priority: 85,
    durationDays: 7,
    rules: {
      combinator: "all",
      conditions: [
        { metric: "firstPlaceCount", operator: "gte", value: 2 },
        { metric: "winRate", operator: "gte", value: 50 },
      ],
    },
  },
  {
    code: "SHARP_SHOOTER",
    version: "v1",
    name: "Sharp Shooter",
    description:
      "Combines accurate killing efficiency with a high weekly kill average.",
    icon: "🎯",
    periodType: "weekly",
    minimumMatches: 5,
    priority: 80,
    durationDays: 7,
    rules: {
      combinator: "all",
      conditions: [
        { metric: "kdr", operator: "gte", value: 2 },
        { metric: "averageKills", operator: "gte", value: 15 },
      ],
    },
  },
  {
    code: "SURVIVOR",
    version: "v1",
    name: "Survivor",
    description: "Limits deaths while maintaining a strong average placement.",
    icon: "🛡",
    periodType: "weekly",
    minimumMatches: 5,
    priority: 75,
    durationDays: 7,
    rules: {
      combinator: "all",
      conditions: [
        { metric: "averageDeaths", operator: "lte", value: 18 },
        { metric: "averageRank", operator: "lte", value: 2.5 },
      ],
    },
  },
  {
    code: "RISING_STAR",
    version: "v1",
    name: "Rising Star",
    description: "Improves monthly performance meaningfully over the previous month.",
    icon: "★",
    periodType: "monthly",
    minimumMatches: 5,
    priority: 70,
    durationDays: 31,
    rules: {
      combinator: "all",
      conditions: [{ metric: "improvementRate", operator: "gte", value: 20 }],
    },
  },
  {
    code: "DEATH_MAGNET",
    version: "v1",
    name: "Death Magnet",
    description: "Records an unusually high weekly average-death count.",
    icon: "💀",
    periodType: "weekly",
    minimumMatches: 5,
    priority: 30,
    durationDays: 7,
    rules: {
      combinator: "all",
      conditions: [{ metric: "averageDeaths", operator: "gte", value: 30 }],
    },
  },
  {
    code: "UNLUCKY_SOLDIER",
    version: "v1",
    name: "Unlucky Soldier",
    description: "Finishes last repeatedly during the weekly calculation period.",
    icon: "☂",
    periodType: "weekly",
    minimumMatches: 5,
    priority: 20,
    durationDays: 7,
    rules: {
      combinator: "all",
      conditions: [{ metric: "lastPlaceCount", operator: "gte", value: 3 }],
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

function titleSnapshot(title) {
  return {
    code: title.code,
    version: title.version,
    name: title.name,
    description: title.description,
    icon: title.icon ?? null,
    priority: title.priority,
    periodType: title.periodType,
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
    icon: value.icon ?? null,
    periodType: value.periodType,
    minimumMatches: value.minimumMatches,
    priority: value.priority,
    rules: value.rules,
    durationDays: value.durationDays,
    isActive: value.isActive,
    activatedAt: value.activatedAt,
    supersedesTitleId: value.supersedesTitleId ? String(value.supersedesTitleId) : null,
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

function serializeAward(document, player = null) {
  const value =
    typeof document?.toObject === "function" ? document.toObject() : document;
  if (!value) return null;
  return {
    id: String(value._id),
    playerId: String(value.playerId),
    player: serializePlayer(player),
    title: value.titleSnapshot,
    period: {
      key: value.periodKey,
      startAt: value.periodStartAt,
      endAt: value.periodEndAt,
    },
    awardedAt: value.awardedAt,
    expiresAt: value.expiresAt,
    isCurrent: value.isCurrent,
    status: value.status,
    revokedAt: value.revokedAt,
    revokedReason: value.revokedReason,
    evidence: value.evidence,
  };
}

function definitionInput(input, actor, supersedesTitleId = null) {
  return {
    code: input.code,
    version: input.version,
    name: input.name,
    description: input.description,
    icon: input.icon ?? null,
    periodType: input.periodType,
    minimumMatches: input.minimumMatches,
    priority: input.priority,
    rules: input.rules,
    durationDays: input.durationDays,
    isActive: false,
    activatedAt: null,
    supersedesTitleId,
    createdBy: actor.id,
    updatedBy: actor.id,
    createdReason: input.reason,
  };
}

function titleNotFound() {
  return new AppError({
    statusCode: 404,
    code: "DYNAMIC_TITLE_NOT_FOUND",
    message: "Dynamic title definition was not found.",
  });
}

export function createTitleService({
  DynamicTitleModel = DynamicTitle,
  PlayerTitleModel = PlayerTitle,
  PlayerModel = Player,
  NotificationModel = Notification,
  AuditLogModel = AuditLog,
  analytics = analyticsService,
} = {}) {
  async function ensureDefaultTitles() {
    const existing = await DynamicTitleModel.find({
      code: { $in: DEFAULT_DYNAMIC_TITLES.map((title) => title.code) },
    })
      .select({ code: 1 })
      .lean();
    const existingCodes = new Set(existing.map((title) => title.code));
    const missing = DEFAULT_DYNAMIC_TITLES.filter(
      (title) => !existingCodes.has(title.code),
    );
    if (!missing.length) return;
    try {
      await DynamicTitleModel.insertMany(
        missing.map((title) => ({
          ...title,
          isActive: true,
          activatedAt: new Date(),
          supersedesTitleId: null,
          createdBy: "system:bootstrap",
          updatedBy: "system:bootstrap",
          createdReason: "Create the required initial dynamic-title definitions.",
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
    let query = DynamicTitleModel.findOne(filter);
    if (session) query = query.session(session);
    return query;
  }

  return Object.freeze({
    ensureDefaultTitles,

    async listPublicDefinitions() {
      await ensureDefaultTitles();
      const definitions = await DynamicTitleModel.find({ isActive: true })
        .sort({ priority: -1, name: 1 })
        .lean();
      const holderCounts = await PlayerTitleModel.aggregate([
        {
          $match: {
            isCurrent: true,
            status: "awarded",
            expiresAt: { $gt: new Date() },
          },
        },
        { $group: { _id: "$titleCode", count: { $sum: 1 } } },
      ]);
      const countMap = new Map(holderCounts.map((item) => [item._id, item.count]));
      return definitions.map((definition) => ({
        ...serializeDefinition(definition),
        currentHolderCount: countMap.get(definition.code) ?? 0,
      }));
    },

    async getPublicDefinition(code) {
      await ensureDefaultTitles();
      const definition = await DynamicTitleModel.findOne({
        code: String(code).toUpperCase(),
        isActive: true,
      }).lean();
      if (!definition) throw titleNotFound();
      const currentAwards = await PlayerTitleModel.find({
        titleCode: definition.code,
        titleVersion: definition.version,
        isCurrent: true,
        status: "awarded",
        expiresAt: { $gt: new Date() },
      })
        .sort({ awardedAt: -1 })
        .limit(20)
        .lean();
      const players = await PlayerModel.find({
        _id: { $in: currentAwards.map((award) => award.playerId) },
      })
        .select({ playerId: 1, name: 1, profileImage: 1, status: 1 })
        .lean();
      const playerMap = new Map(players.map((player) => [String(player._id), player]));
      return {
        definition: serializeDefinition(definition),
        currentHolders: currentAwards.map((award) =>
          serializeAward(award, playerMap.get(String(award.playerId))),
        ),
      };
    },

    async getPlayerCurrent(playerCode) {
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
      const award = await PlayerTitleModel.findOne({
        playerId: player._id,
        isCurrent: true,
        status: "awarded",
        expiresAt: { $gt: new Date() },
      }).lean();
      return {
        player: serializePlayer(player),
        currentTitle: serializeAward(award, player),
      };
    },

    async getPlayerHistory({ playerCode, page = 1, limit = 20, status }) {
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
      const filter = { playerId: player._id };
      if (status) filter.status = status;
      const totalItems = await PlayerTitleModel.countDocuments(filter);
      const totalPages = Math.max(1, Math.ceil(totalItems / limit));
      const safePage = Math.min(page, totalPages);
      const awards = await PlayerTitleModel.find(filter)
        .sort({ awardedAt: -1, createdAt: -1 })
        .skip((safePage - 1) * limit)
        .limit(limit)
        .lean();
      return {
        player: serializePlayer(player),
        items: awards.map((award) => serializeAward(award, player)),
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

    async listDefinitions({ page = 1, limit = 20, code, active } = {}) {
      await ensureDefaultTitles();
      const filter = {};
      if (code) filter.code = code;
      if (typeof active === "boolean") filter.isActive = active;
      const totalItems = await DynamicTitleModel.countDocuments(filter);
      const totalPages = Math.max(1, Math.ceil(totalItems / limit));
      const safePage = Math.min(page, totalPages);
      const items = await DynamicTitleModel.find(filter)
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
      const existing = await DynamicTitleModel.findOne({
        code: input.code,
        version: input.version,
      })
        .select({ _id: 1 })
        .lean();
      if (existing) {
        throw new AppError({
          statusCode: 409,
          code: "TITLE_VERSION_EXISTS",
          message: "This dynamic-title code and version already exist.",
        });
      }
      const created = await DynamicTitleModel.create(definitionInput(input, actor));
      await AuditLogModel.create({
        actorUserId: actor.id,
        action: "title.created",
        entityType: "dynamic_title",
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
      if (!previous) throw titleNotFound();
      const exists = await DynamicTitleModel.findOne({
        code: previous.code,
        version: input.version,
      })
        .select({ _id: 1 })
        .lean();
      if (exists) {
        throw new AppError({
          statusCode: 409,
          code: "TITLE_VERSION_EXISTS",
          message: "This version already exists for the dynamic title.",
        });
      }
      const merged = {
        code: previous.code,
        version: input.version,
        name: input.name ?? previous.name,
        description: input.description ?? previous.description,
        icon: input.icon === undefined ? previous.icon : input.icon,
        periodType: input.periodType ?? previous.periodType,
        minimumMatches: input.minimumMatches ?? previous.minimumMatches,
        priority: input.priority ?? previous.priority,
        rules: input.rules ?? previous.rules.toObject?.() ?? previous.rules,
        durationDays: input.durationDays ?? previous.durationDays,
        reason: input.reason,
      };
      const created = await DynamicTitleModel.create(
        definitionInput(merged, actor, previous._id),
      );
      await AuditLogModel.create({
        actorUserId: actor.id,
        action: "title.updated",
        entityType: "dynamic_title",
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
      let previousActive;
      try {
        await session.withTransaction(async () => {
          const target = await findDefinition(identifier, session);
          if (!target) throw titleNotFound();
          previousActive = await DynamicTitleModel.findOne({
            code: target.code,
            isActive: true,
            _id: { $ne: target._id },
          }).session(session);
          if (previousActive) {
            previousActive.isActive = false;
            previousActive.updatedBy = actor.id;
            await previousActive.save({ session });
          }
          target.isActive = true;
          target.activatedAt = new Date();
          target.updatedBy = actor.id;
          activated = await target.save({ session });
          await AuditLogModel.create(
            [
              {
                actorUserId: actor.id,
                action: "title.activated",
                entityType: "dynamic_title",
                entityId: String(target._id),
                previousValue: previousActive
                  ? serializeDefinition(previousActive, true)
                  : null,
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
      if (!target) throw titleNotFound();
      const previous = serializeDefinition(target, true);
      target.isActive = false;
      target.updatedBy = actor.id;
      const updated = await target.save();
      await PlayerTitleModel.updateMany(
        { titleId: target._id, isCurrent: true, status: "awarded" },
        {
          $set: {
            isCurrent: false,
            status: "revoked",
            revokedAt: new Date(),
            revokedReason: input.reason,
          },
        },
      );
      await AuditLogModel.create({
        actorUserId: actor.id,
        action: "title.deactivated",
        entityType: "dynamic_title",
        entityId: String(target._id),
        previousValue: previous,
        newValue: serializeDefinition(updated, true),
        reason: input.reason,
        ...requestAuditFields(requestMeta),
      });
      return serializeDefinition(updated, true);
    },

    async recalculate(input, actor, requestMeta = {}) {
      await ensureDefaultTitles();
      const definitions = await DynamicTitleModel.find({ isActive: true }).lean();
      const selectedDefinitions = input.codes?.length
        ? definitions.filter((item) => input.codes.includes(item.code))
        : definitions;
      if (!selectedDefinitions.length) {
        throw new AppError({
          statusCode: 422,
          code: "NO_ACTIVE_TITLE_DEFINITIONS",
          message: "No active dynamic-title definitions matched the request.",
        });
      }

      const groupedPeriods = new Map();
      for (const definition of selectedDefinitions) {
        const key = `${definition.periodType}:${input.date ?? "current"}:${input.seasonId ?? "active"}`;
        if (!groupedPeriods.has(key)) {
          const period = await analytics.resolvePeriod({
            periodType: definition.periodType,
            date: input.date,
            seasonId: input.seasonId,
          });
          groupedPeriods.set(key, await analytics.ensurePeriodStatistics(period));
        }
      }

      const runId = crypto.randomUUID();
      const now = new Date();
      const qualifiedAwards = [];
      const evaluatedPlayerIds = new Set();
      const evaluations = [];

      for (const definition of selectedDefinitions) {
        const key = `${definition.periodType}:${input.date ?? "current"}:${input.seasonId ?? "active"}`;
        const result = groupedPeriods.get(key);
        for (const entry of result.entries) {
          evaluatedPlayerIds.add(String(entry.playerId));
          const evaluation = evaluateTitleDefinition(definition, entry);
          evaluations.push({ definition, entry, period: result.period, evaluation });
          if (evaluation.qualified) {
            qualifiedAwards.push({
              definition,
              entry,
              period: result.period,
              evaluation,
            });
          }
        }
      }

      const periodTargets = selectedDefinitions.map((definition) => {
        const key = `${definition.periodType}:${input.date ?? "current"}:${input.seasonId ?? "active"}`;
        const result = groupedPeriods.get(key);
        return {
          titleCode: definition.code,
          titleVersion: definition.version,
          periodKey: result.period.key,
        };
      });
      const existingAwards = await PlayerTitleModel.find({ $or: periodTargets }).lean();
      existingAwards.forEach((award) => evaluatedPlayerIds.add(String(award.playerId)));
      const existingMap = new Map(
        existingAwards.map((award) => [
          `${award.playerId}:${award.titleCode}:${award.titleVersion}:${award.periodKey}`,
          award,
        ]),
      );
      const evaluationMap = new Map(
        evaluations.map((item) => [
          `${item.entry.playerId}:${item.definition.code}:${item.definition.version}:${item.period.key}`,
          item.evaluation,
        ]),
      );
      const qualifiedKeys = new Set();
      const newlyAwardedKeys = new Set();

      for (const item of qualifiedAwards) {
        const key = `${item.entry.playerId}:${item.definition.code}:${item.definition.version}:${item.period.key}`;
        qualifiedKeys.add(key);
        if (!existingMap.has(key)) newlyAwardedKeys.add(key);
      }

      const session = await mongoose.startSession();
      let awardedCount = 0;
      let revokedCount = 0;
      let currentCount = 0;
      const selectedCurrent = [];
      try {
        await session.withTransaction(async () => {
          for (const item of qualifiedAwards) {
            const expiresAt = calculateTitleExpiration({
              awardedAt: now,
              periodEndAt: item.period.endAt,
              durationDays: item.definition.durationDays,
            });
            const result = await PlayerTitleModel.updateOne(
              {
                playerId: item.entry.playerId,
                titleCode: item.definition.code,
                titleVersion: item.definition.version,
                periodKey: item.period.key,
              },
              {
                $set: {
                  titleId: item.definition._id,
                  titleSnapshot: titleSnapshot(item.definition),
                  periodStartAt: item.period.startAt,
                  periodEndAt: item.period.endAt,
                  expiresAt,
                  status: "awarded",
                  revokedAt: null,
                  revokedReason: null,
                  evaluationRunId: runId,
                  evidence: item.evaluation,
                },
                $setOnInsert: {
                  playerId: item.entry.playerId,
                  titleCode: item.definition.code,
                  titleVersion: item.definition.version,
                  periodKey: item.period.key,
                  awardedAt: now,
                  isCurrent: false,
                },
              },
              { upsert: true, session },
            );
            if (result.upsertedCount) awardedCount += 1;
          }

          for (const award of existingAwards) {
            const key = `${award.playerId}:${award.titleCode}:${award.titleVersion}:${award.periodKey}`;
            if (qualifiedKeys.has(key) || award.status !== "awarded") continue;
            const evidence = evaluationMap.get(key) ?? {
              qualified: false,
              minimumMatchesMet: false,
              reason: "No verified period statistics remain for this player.",
              conditions: [],
            };
            const result = await PlayerTitleModel.updateOne(
              { _id: award._id, status: "awarded" },
              {
                $set: {
                  status: "revoked",
                  isCurrent: false,
                  revokedAt: now,
                  revokedReason: `Recalculation ${runId}: eligibility criteria are no longer met.`,
                  evaluationRunId: runId,
                  evidence,
                },
              },
              { session },
            );
            revokedCount += result.modifiedCount ?? 0;
          }

          const currentPlayers = await PlayerTitleModel.find({ isCurrent: true })
            .select({ playerId: 1 })
            .session(session)
            .lean();
          currentPlayers.forEach((award) =>
            evaluatedPlayerIds.add(String(award.playerId)),
          );
          const playerObjectIds = [...evaluatedPlayerIds].map(
            (id) => new mongoose.Types.ObjectId(id),
          );

          await PlayerTitleModel.updateMany(
            {
              playerId: { $in: playerObjectIds },
              isCurrent: true,
            },
            { $set: { isCurrent: false } },
            { session },
          );
          await PlayerTitleModel.updateMany(
            { status: "awarded", expiresAt: { $lte: now } },
            { $set: { status: "expired", isCurrent: false } },
            { session },
          );

          const validAwards = await PlayerTitleModel.find({
            playerId: { $in: playerObjectIds },
            status: "awarded",
            expiresAt: { $gt: now },
          })
            .session(session)
            .lean();
          const byPlayer = new Map();
          for (const award of validAwards) {
            const playerId = String(award.playerId);
            if (!byPlayer.has(playerId)) byPlayer.set(playerId, []);
            byPlayer.get(playerId).push(award);
          }
          for (const [playerId, candidates] of byPlayer) {
            const selected = chooseCurrentTitle(candidates);
            if (!selected) continue;
            await PlayerTitleModel.updateOne(
              { _id: selected._id },
              { $set: { isCurrent: true } },
              { session },
            );
            selectedCurrent.push({ ...selected, playerId });
            currentCount += 1;
          }

          await AuditLogModel.create(
            [
              {
                actorUserId: actor.id,
                action: "title.recalculated",
                entityType: "dynamic_title_evaluation",
                entityId: runId,
                previousValue: null,
                newValue: {
                  runId,
                  evaluatedDefinitions: selectedDefinitions.map((item) => ({
                    code: item.code,
                    version: item.version,
                  })),
                  evaluatedPlayers: evaluatedPlayerIds.size,
                  qualifiedAwards: qualifiedAwards.length,
                  newlyAwarded: awardedCount,
                  revoked: revokedCount,
                  currentTitles: currentCount,
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

      const selectedIds = selectedCurrent.map((award) => award.playerId);
      const players = await PlayerModel.find({ _id: { $in: selectedIds } })
        .select({ linkedUserId: 1, playerId: 1, name: 1 })
        .lean();
      const playerMap = new Map(players.map((player) => [String(player._id), player]));
      const notifications = [];
      for (const award of selectedCurrent) {
        const awardKey = `${award.playerId}:${award.titleCode}:${award.titleVersion}:${award.periodKey}`;
        const player = playerMap.get(String(award.playerId));
        if (!player?.linkedUserId || !newlyAwardedKeys.has(awardKey)) continue;
        notifications.push({
          userId: player.linkedUserId,
          type: "title_earned",
          title: `New title: ${award.titleSnapshot.name}`,
          message: `${player.name} earned the ${award.titleSnapshot.name} title.`,
          relatedEntity: {
            entityType: "player_title",
            entityId: String(award._id),
          },
          data: {
            playerId: player.playerId,
            titleCode: award.titleCode,
            periodKey: award.periodKey,
          },
        });
      }
      if (notifications.length) await NotificationModel.insertMany(notifications);

      return {
        runId,
        evaluatedDefinitions: selectedDefinitions.length,
        evaluatedPlayers: evaluatedPlayerIds.size,
        qualifiedAwards: qualifiedAwards.length,
        newlyAwarded: awardedCount,
        revoked: revokedCount,
        currentTitles: currentCount,
      };
    },
  });
}

export const titleService = createTitleService();
