import mongoose from "mongoose";
import { PERIOD_TYPES } from "../constants/domain.constants.js";
import { baseSchemaOptions, createModel } from "./model.helpers.js";
import { ruleSetSchema } from "./shared.schemas.js";

const dynamicTitleSchema = new mongoose.Schema(
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
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    icon: { type: String, trim: true, maxlength: 32, default: null },
    periodType: { type: String, enum: PERIOD_TYPES, required: true },
    minimumMatches: { type: Number, required: true, min: 1, max: 500 },
    priority: { type: Number, required: true, min: 1, max: 1000 },
    rules: { type: ruleSetSchema, required: true },
    durationDays: { type: Number, min: 1, max: 365, required: true },
    isActive: { type: Boolean, required: true, default: false },
    activatedAt: { type: Date, default: null },
    supersedesTitleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DynamicTitle",
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

dynamicTitleSchema.index({ code: 1, version: 1 }, { unique: true });
dynamicTitleSchema.index(
  { code: 1, isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } },
);
dynamicTitleSchema.index({ isActive: 1, priority: -1, name: 1 });
dynamicTitleSchema.index({ periodType: 1, isActive: 1, priority: -1 });

export const DynamicTitle = createModel(
  "DynamicTitle",
  dynamicTitleSchema,
  "dynamicTitles",
);
