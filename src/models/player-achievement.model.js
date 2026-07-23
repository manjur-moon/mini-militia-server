import mongoose from "mongoose";
import {
  baseSchemaOptions,
  createModel,
  finiteNumberValidator,
} from "./model.helpers.js";

const achievementSnapshotSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true },
    version: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    icon: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    periodType: { type: String, required: true, trim: true },
    progressMetric: { type: String, required: true, trim: true },
    targetValue: { type: Number, required: true, validate: finiteNumberValidator },
  },
  { _id: false, strict: "throw" },
);

const conditionProgressSchema = new mongoose.Schema(
  {
    metric: { type: String, required: true, trim: true },
    operator: { type: String, required: true, trim: true },
    expected: { type: Number, required: true, validate: finiteNumberValidator },
    actual: { type: Number, default: null, validate: finiteNumberValidator },
    percentage: { type: Number, required: true, min: 0, max: 100 },
    passed: { type: Boolean, required: true },
  },
  { _id: false, strict: "throw" },
);

const playerAchievementSchema = new mongoose.Schema(
  {
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true },
    achievementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Achievement",
      required: true,
    },
    achievementCode: { type: String, required: true, trim: true, uppercase: true },
    achievementVersion: { type: String, required: true, trim: true },
    achievementSnapshot: { type: achievementSnapshotSchema, required: true },
    progress: {
      current: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
        validate: finiteNumberValidator,
      },
      target: {
        type: Number,
        required: true,
        min: 0.000001,
        validate: finiteNumberValidator,
      },
      percentage: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
        default: 0,
        validate: finiteNumberValidator,
      },
      conditions: { type: [conditionProgressSchema], required: true, default: [] },
    },
    unlockedAt: { type: Date, default: null },
    isUnlocked: { type: Boolean, required: true, default: false },
    evidence: { type: mongoose.Schema.Types.Mixed, default: null },
    evaluationRunId: { type: String, required: true, trim: true },
    firstEvaluatedAt: { type: Date, required: true, default: Date.now },
    lastEvaluatedAt: { type: Date, required: true, default: Date.now },
  },
  baseSchemaOptions,
);

playerAchievementSchema.index({ playerId: 1, achievementCode: 1 }, { unique: true });
playerAchievementSchema.index({ playerId: 1, isUnlocked: 1, unlockedAt: -1 });
playerAchievementSchema.index({ achievementCode: 1, isUnlocked: 1, unlockedAt: -1 });
playerAchievementSchema.index({ "achievementSnapshot.category": 1, isUnlocked: 1 });

export const PlayerAchievement = createModel(
  "PlayerAchievement",
  playerAchievementSchema,
  "playerAchievements",
);
