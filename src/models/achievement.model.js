import mongoose from "mongoose";
import { METRIC_KEYS, PERIOD_TYPES } from "../constants/domain.constants.js";
import {
  baseSchemaOptions,
  createModel,
  finiteNumberValidator,
} from "./model.helpers.js";
import { ruleSetSchema } from "./shared.schemas.js";

const achievementSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      match: /^[A-Z0-9_]+$/,
      immutable: true,
    },
    version: {
      type: String,
      required: true,
      trim: true,
      match: /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/i,
      immutable: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    icon: { type: String, required: true, trim: true, maxlength: 64 },
    category: { type: String, required: true, trim: true, maxlength: 80 },
    periodType: {
      type: String,
      enum: PERIOD_TYPES,
      required: true,
      default: "all_time",
    },
    minimumMatches: { type: Number, required: true, min: 0, max: 10000, default: 0 },
    criteria: { type: ruleSetSchema, required: true },
    progressMetric: { type: String, enum: METRIC_KEYS, required: true },
    targetValue: {
      type: Number,
      required: true,
      min: 0.000001,
      validate: finiteNumberValidator,
    },
    isActive: { type: Boolean, required: true, default: false },
    activatedAt: { type: Date, default: null },
    supersedesAchievementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Achievement",
      default: null,
      immutable: true,
    },
    createdBy: { type: String, required: true, trim: true, immutable: true },
    createdReason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
      immutable: true,
    },
    updatedBy: { type: String, required: true, trim: true },
  },
  baseSchemaOptions,
);

achievementSchema.index({ code: 1, version: 1 }, { unique: true });
achievementSchema.index(
  { code: 1, isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } },
);
achievementSchema.index({ category: 1, isActive: 1, name: 1 });
achievementSchema.index({ periodType: 1, isActive: 1, name: 1 });

export const Achievement = createModel(
  "Achievement",
  achievementSchema,
  "achievements",
);
