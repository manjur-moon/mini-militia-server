import mongoose from "mongoose";
import { AuditLog } from "../models/audit-log.model.js";
import { RatingConfig } from "../models/rating-config.model.js";
import { AppError } from "../utils/app-error.js";
import { RATING_METRICS } from "./rating-math.service.js";

export const DEFAULT_RATING_CONFIG = Object.freeze({
  version: "rating-v1",
  name: "Balanced verified-performance rating",
  description:
    "A transparent 0–100 rating based on verified attack, survival, consistency and activity metrics.",
  minimumMatches: 5,
  newPlayerConfidenceFloor: 0.25,
  components: [
    {
      component: "attack",
      metrics: [
        { metric: "averageKills", method: "target", target: 25, weight: 0.45 },
        { metric: "kdr", method: "target", target: 1.5, weight: 0.35 },
        { metric: "winRate", method: "target", target: 40, weight: 0.2 },
      ],
    },
    {
      component: "survival",
      metrics: [
        {
          metric: "averageDeaths",
          method: "inverse_target",
          target: 25,
          weight: 0.45,
        },
        {
          metric: "averageRank",
          method: "inverse_target",
          target: 2,
          weight: 0.35,
        },
        {
          metric: "lastPlaceRate",
          method: "inverse_target",
          target: 20,
          weight: 0.2,
        },
      ],
    },
    {
      component: "consistency",
      metrics: [
        {
          metric: "killsCoefficientOfVariation",
          method: "inverse_target",
          target: 0.35,
          weight: 0.55,
        },
        {
          metric: "placementStandardDeviation",
          method: "inverse_target",
          target: 1.25,
          weight: 0.45,
        },
      ],
    },
    {
      component: "activity",
      metrics: [
        { metric: "matchesPlayed", method: "target", target: 10, weight: 0.7 },
        { metric: "activeDays", method: "target", target: 5, weight: 0.3 },
      ],
    },
  ],
  overallWeights: {
    attack: 0.35,
    survival: 0.25,
    consistency: 0.25,
    activity: 0.15,
  },
  isActive: true,
  effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
  createdBy: "system:bootstrap",
  createdReason: "Create the initial documented rating formula.",
});

function serializeConfig(document, includeGovernance = false) {
  const value =
    typeof document?.toObject === "function" ? document.toObject() : document;
  if (!value) return null;
  const serialized = {
    id: String(value._id),
    version: value.version,
    name: value.name,
    description: value.description,
    minimumMatches: value.minimumMatches,
    newPlayerConfidenceFloor: value.newPlayerConfidenceFloor,
    components: value.components,
    overallWeights: value.overallWeights,
    isActive: value.isActive,
    effectiveFrom: value.effectiveFrom,
    createdAt: value.createdAt,
  };
  if (includeGovernance) {
    serialized.createdBy = value.createdBy;
    serialized.createdReason = value.createdReason;
  }
  return serialized;
}

function assertKnownMetrics(components) {
  const knownMetrics = new Set(RATING_METRICS);
  for (const component of components) {
    for (const metric of component.metrics) {
      if (!knownMetrics.has(metric.metric)) {
        throw new AppError({
          statusCode: 422,
          code: "UNSUPPORTED_RATING_METRIC",
          message: `Unsupported rating metric: ${metric.metric}.`,
        });
      }
    }
  }
}

export function createRatingConfigService({
  RatingConfigModel = RatingConfig,
  AuditLogModel = AuditLog,
} = {}) {
  async function ensureDefaultConfig() {
    const active = await RatingConfigModel.findOne({ isActive: true }).lean();
    if (active) return active;

    try {
      return await RatingConfigModel.create(DEFAULT_RATING_CONFIG);
    } catch (error) {
      if (error?.code === 11000) {
        return RatingConfigModel.findOne({ isActive: true }).lean();
      }
      throw error;
    }
  }

  return Object.freeze({
    async getActiveConfig() {
      return ensureDefaultConfig();
    },

    async getPublicConfig() {
      return serializeConfig(await ensureDefaultConfig(), false);
    },

    async listConfigs({ page = 1, limit = 20, active } = {}) {
      await ensureDefaultConfig();
      const filter = {};
      if (typeof active === "boolean") filter.isActive = active;
      const totalItems = await RatingConfigModel.countDocuments(filter);
      const totalPages = Math.max(1, Math.ceil(totalItems / limit));
      const safePage = Math.min(page, totalPages);
      const configs = await RatingConfigModel.find(filter)
        .sort({ isActive: -1, effectiveFrom: -1, createdAt: -1 })
        .skip((safePage - 1) * limit)
        .limit(limit)
        .lean();
      return {
        items: configs.map((config) => serializeConfig(config, true)),
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

    async createConfig(input, actor, requestMeta = {}) {
      assertKnownMetrics(input.components);
      const existing = await RatingConfigModel.findOne({ version: input.version })
        .select({ _id: 1 })
        .lean();
      if (existing) {
        throw new AppError({
          statusCode: 409,
          code: "RATING_CONFIG_VERSION_EXISTS",
          message: "A rating configuration with this version already exists.",
        });
      }

      const { reason, effectiveFrom, ...configInput } = input;
      const config = await RatingConfigModel.create({
        ...configInput,
        isActive: false,
        effectiveFrom: effectiveFrom ?? new Date(),
        createdBy: actor.id,
        createdReason: reason,
      });

      await AuditLogModel.create({
        actorUserId: actor.id,
        action: "rating_config.created",
        entityType: "rating_config",
        entityId: String(config._id),
        previousValue: null,
        newValue: serializeConfig(config, true),
        reason: input.reason,
        ipAddress: requestMeta.ipAddress ?? null,
        userAgent: requestMeta.userAgent ?? null,
        requestId: requestMeta.requestId ?? null,
      });

      return serializeConfig(config, true);
    },

    async activateConfig(configId, input, actor, requestMeta = {}) {
      const session = await mongoose.startSession();
      let activated;
      let previous;
      try {
        await session.withTransaction(async () => {
          const targetFilter = mongoose.isValidObjectId(configId)
            ? { _id: configId }
            : { version: configId };
          const target = await RatingConfigModel.findOne(targetFilter).session(session);
          if (!target) {
            throw new AppError({
              statusCode: 404,
              code: "RATING_CONFIG_NOT_FOUND",
              message: "Rating configuration was not found.",
            });
          }

          previous = await RatingConfigModel.findOne({ isActive: true }).session(
            session,
          );
          if (previous && String(previous._id) !== String(target._id)) {
            previous.isActive = false;
            await previous.save({ session });
          }

          target.isActive = true;
          target.effectiveFrom = new Date();
          activated = await target.save({ session });

          await AuditLogModel.create(
            [
              {
                actorUserId: actor.id,
                action: "rating_config.activated",
                entityType: "rating_config",
                entityId: String(target._id),
                previousValue: previous ? serializeConfig(previous, true) : null,
                newValue: serializeConfig(activated, true),
                reason: input.reason,
                ipAddress: requestMeta.ipAddress ?? null,
                userAgent: requestMeta.userAgent ?? null,
                requestId: requestMeta.requestId ?? null,
              },
            ],
            { session },
          );
        });
      } finally {
        await session.endSession();
      }
      return serializeConfig(activated, true);
    },
  });
}

export const ratingConfigService = createRatingConfigService();
