import mongoose from "mongoose";
import {
  baseSchemaOptions,
  createModel,
  finiteNumberValidator,
} from "./model.helpers.js";

const mvpWeightsSchema = new mongoose.Schema(
  {
    killWeight: {
      type: Number,
      required: true,
      min: 0,
      validate: finiteNumberValidator,
    },
    deathPenalty: {
      type: Number,
      required: true,
      min: 0,
      validate: finiteNumberValidator,
    },
    firstPlaceBonus: {
      type: Number,
      required: true,
      min: 0,
      validate: finiteNumberValidator,
    },
    secondPlaceBonus: {
      type: Number,
      required: true,
      min: 0,
      validate: finiteNumberValidator,
    },
    thirdPlaceBonus: {
      type: Number,
      required: true,
      min: 0,
      validate: finiteNumberValidator,
    },
    kdrBonusWeight: {
      type: Number,
      required: true,
      min: 0,
      validate: finiteNumberValidator,
    },
    maximumKdrBonus: {
      type: Number,
      required: true,
      min: 0,
      validate: finiteNumberValidator,
    },
    activityWeight: {
      type: Number,
      required: true,
      min: 0,
      validate: finiteNumberValidator,
    },
    maximumActivityBonus: {
      type: Number,
      required: true,
      min: 0,
      validate: finiteNumberValidator,
    },
  },
  { _id: false, strict: "throw" },
);

const mvpConfigSchema = new mongoose.Schema(
  {
    version: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      immutable: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 1000, default: "" },
    minimumMatches: { type: Number, required: true, min: 1 },
    weights: { type: mvpWeightsSchema, required: true },
    isActive: { type: Boolean, required: true, default: false },
    effectiveFrom: { type: Date, required: true },
    retiredAt: { type: Date, default: null },
    createdBy: { type: String, required: true, trim: true },
    activationReason: { type: String, trim: true, maxlength: 500, default: null },
  },
  baseSchemaOptions,
);

mvpConfigSchema.index(
  { isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } },
);

export const MVPConfig = createModel("MVPConfig", mvpConfigSchema, "mvpConfigs");
