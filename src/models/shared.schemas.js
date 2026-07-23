import mongoose from "mongoose";
import {
  METRIC_KEYS,
  PERIOD_TYPES,
  RULE_COMBINATORS,
  RULE_OPERATORS,
} from "../constants/domain.constants.js";
import { finiteNumberValidator } from "./model.helpers.js";

const { Schema } = mongoose;

export const imageAssetSchema = new Schema(
  {
    publicId: { type: String, required: true, trim: true },
    secureUrl: { type: String, required: true, trim: true },
    format: { type: String, required: true, trim: true, lowercase: true },
    width: { type: Number, required: true, min: 1 },
    height: { type: Number, required: true, min: 1 },
    bytes: { type: Number, required: true, min: 1 },
    sha256: { type: String, trim: true, lowercase: true },
    perceptualHash: { type: String, trim: true, lowercase: true },
  },
  { _id: false, strict: "throw" },
);

export const statisticsMetricsSchema = new Schema(
  {
    matchesPlayed: { type: Number, required: true, min: 0, default: 0 },
    totalKills: { type: Number, required: true, min: 0, default: 0 },
    totalDeaths: { type: Number, required: true, min: 0, default: 0 },
    kdr: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: finiteNumberValidator,
    },
    averageKills: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: finiteNumberValidator,
    },
    averageDeaths: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: finiteNumberValidator,
    },
    averageRank: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: finiteNumberValidator,
    },
    winRate: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0,
      validate: finiteNumberValidator,
    },
    firstPlaceCount: { type: Number, required: true, min: 0, default: 0 },
    lastPlaceCount: { type: Number, required: true, min: 0, default: 0 },
    mvpCount: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false, strict: "throw" },
);

export const periodSchema = new Schema(
  {
    type: { type: String, enum: PERIOD_TYPES, required: true },
    key: { type: String, required: true, trim: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    timezone: { type: String, required: true, trim: true },
  },
  { _id: false, strict: "throw" },
);

export const recordReferenceSchema = new Schema(
  {
    value: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: finiteNumberValidator,
    },
    matchId: { type: Schema.Types.ObjectId, ref: "Match", default: null },
    occurredAt: { type: Date, default: null },
  },
  { _id: false, strict: "throw" },
);

export const ruleConditionSchema = new Schema(
  {
    metric: { type: String, enum: METRIC_KEYS, required: true },
    operator: { type: String, enum: RULE_OPERATORS, required: true },
    value: { type: Number, required: true, validate: finiteNumberValidator },
  },
  { _id: false, strict: "throw" },
);

export const ruleSetSchema = new Schema(
  {
    combinator: {
      type: String,
      enum: RULE_COMBINATORS,
      required: true,
      default: "all",
    },
    conditions: {
      type: [ruleConditionSchema],
      required: true,
      validate: {
        validator: (conditions) => conditions.length > 0,
        message: "At least one rule condition is required.",
      },
    },
  },
  { _id: false, strict: "throw" },
);

export const entityReferenceSchema = new Schema(
  {
    entityType: { type: String, required: true, trim: true },
    entityId: { type: String, required: true, trim: true },
  },
  { _id: false, strict: "throw" },
);
