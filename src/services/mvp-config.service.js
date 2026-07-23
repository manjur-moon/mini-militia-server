import mongoose from "mongoose";
import { AuditLog } from "../models/audit-log.model.js";
import { MVPConfig } from "../models/mvp-config.model.js";
import { AppError } from "../utils/app-error.js";

export const DEFAULT_MVP_CONFIG = Object.freeze({
  version: "mvp-v1",
  name: "Balanced league scoring",
  description:
    "Kills and placement are rewarded, deaths are penalized, and KDR/activity bonuses are capped.",
  minimumMatches: 3,
  weights: Object.freeze({
    killWeight: 1,
    deathPenalty: 0.35,
    firstPlaceBonus: 15,
    secondPlaceBonus: 8,
    thirdPlaceBonus: 4,
    kdrBonusWeight: 5,
    maximumKdrBonus: 20,
    activityWeight: 1,
    maximumActivityBonus: 10,
  }),
});

function serializeConfig(document) {
  const value =
    typeof document?.toObject === "function" ? document.toObject() : document;
  if (!value) return null;
  return {
    id: String(value._id),
    version: value.version,
    name: value.name,
    description: value.description,
    minimumMatches: value.minimumMatches,
    weights: value.weights,
    isActive: value.isActive,
    effectiveFrom: value.effectiveFrom,
    retiredAt: value.retiredAt,
    createdBy: value.createdBy,
    activationReason: value.activationReason,
    createdAt: value.createdAt,
  };
}

export function createMvpConfigService({
  MVPConfigModel = MVPConfig,
  AuditLogModel = AuditLog,
} = {}) {
  async function ensureDefaultConfig() {
    const active = await MVPConfigModel.findOne({ isActive: true }).lean();
    if (active) return active;
    const existingDefault = await MVPConfigModel.findOne({
      version: DEFAULT_MVP_CONFIG.version,
    });
    if (existingDefault) {
      existingDefault.isActive = true;
      existingDefault.retiredAt = null;
      try {
        await existingDefault.save();
        return existingDefault.toObject();
      } catch (error) {
        if (error?.code === 11000) {
          return MVPConfigModel.findOne({ isActive: true }).lean();
        }
        throw error;
      }
    }
    try {
      const created = await MVPConfigModel.create({
        ...DEFAULT_MVP_CONFIG,
        isActive: true,
        effectiveFrom: new Date(0),
        createdBy: "system",
        activationReason: "Initial production scoring formula",
      });
      return created.toObject();
    } catch (error) {
      if (error?.code === 11000) {
        return MVPConfigModel.findOne({ isActive: true }).lean();
      }
      throw error;
    }
  }

  async function getActiveConfig() {
    return ensureDefaultConfig();
  }

  return Object.freeze({
    getActiveConfig,

    async getPublicConfig() {
      return serializeConfig(await getActiveConfig());
    },

    async listConfigs() {
      const configs = await MVPConfigModel.find({}).sort({ createdAt: -1 }).lean();
      return configs.map(serializeConfig);
    },

    async createConfig(input, actor, requestMeta = {}) {
      const { reason, effectiveFrom, ...configInput } = input;
      const existing = await MVPConfigModel.exists({ version: configInput.version });
      if (existing) {
        throw new AppError({
          statusCode: 409,
          code: "MVP_CONFIG_VERSION_EXISTS",
          message: "This MVP formula version already exists.",
        });
      }
      const config = await MVPConfigModel.create({
        ...configInput,
        isActive: false,
        effectiveFrom: effectiveFrom ?? new Date(),
        createdBy: actor.id,
      });
      await AuditLogModel.create({
        actorUserId: actor.id,
        action: "mvp_config.created",
        entityType: "mvp_config",
        entityId: String(config._id),
        previousValue: null,
        newValue: serializeConfig(config),
        reason,
        ipAddress: requestMeta.ipAddress ?? null,
        userAgent: requestMeta.userAgent ?? null,
        requestId: requestMeta.requestId ?? null,
      });
      return serializeConfig(config);
    },

    async activateConfig(configId, { reason }, actor, requestMeta = {}) {
      const session = await mongoose.startSession();
      let activated;
      try {
        await session.withTransaction(async () => {
          const target = await MVPConfigModel.findById(configId).session(session);
          if (!target) {
            throw new AppError({
              statusCode: 404,
              code: "MVP_CONFIG_NOT_FOUND",
              message: "MVP configuration was not found.",
            });
          }
          const previous = await MVPConfigModel.findOne({ isActive: true }).session(
            session,
          );
          const previousSnapshot = previous ? serializeConfig(previous) : null;
          if (previous && String(previous._id) !== String(target._id)) {
            previous.isActive = false;
            previous.retiredAt = new Date();
            await previous.save({ session });
          }
          target.isActive = true;
          target.retiredAt = null;
          target.effectiveFrom = new Date();
          target.activationReason = reason;
          await target.save({ session });
          activated = target;
          await AuditLogModel.create(
            [
              {
                actorUserId: actor.id,
                action: "mvp_config.activated",
                entityType: "mvp_config",
                entityId: String(target._id),
                previousValue: previousSnapshot,
                newValue: serializeConfig(target),
                reason,
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
      return serializeConfig(activated);
    },
  });
}

export const mvpConfigService = createMvpConfigService();
