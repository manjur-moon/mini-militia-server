import mongoose from "mongoose";
import { PERIOD_TYPES } from "../constants/domain.constants.js";
import {
  baseSchemaOptions,
  createModel,
  finiteNumberValidator,
} from "./model.helpers.js";
import { statisticsMetricsSchema } from "./shared.schemas.js";

const periodicStatisticsSchema = new mongoose.Schema(
  {
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      required: true,
      immutable: true,
    },
    periodType: {
      type: String,
      enum: PERIOD_TYPES,
      required: true,
      immutable: true,
    },
    periodKey: { type: String, required: true, trim: true, immutable: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    timezone: { type: String, required: true, trim: true },
    seasonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Season",
      default: null,
    },
    metrics: { type: statisticsMetricsSchema, required: true, default: () => ({}) },
    placementCounts: {
      secondPlaceCount: { type: Number, required: true, min: 0, default: 0 },
      thirdPlaceCount: { type: Number, required: true, min: 0, default: 0 },
    },
    performanceScore: {
      type: Number,
      required: true,
      default: 0,
      validate: finiteNumberValidator,
    },
    previousPerformanceScore: {
      type: Number,
      default: null,
      validate: {
        validator: (value) => value === null || finiteNumberValidator(value),
        message: "previousPerformanceScore must be finite.",
      },
    },
    rank: { type: Number, min: 1, default: null },
    previousPeriodRank: { type: Number, min: 1, default: null },
    improvementRate: {
      type: Number,
      default: null,
      validate: {
        validator: (value) => value === null || finiteNumberValidator(value),
        message: "improvementRate must be finite.",
      },
    },
    minimumMatchesMet: { type: Boolean, required: true, default: false },
    calculationVersion: { type: String, required: true, trim: true },
    sourceDataHash: { type: String, required: true, trim: true },
    sourceVerifiedMatchCount: { type: Number, required: true, min: 0, default: 0 },
    recalculatedAt: { type: Date, required: true, default: Date.now },
  },
  baseSchemaOptions,
);

periodicStatisticsSchema.index(
  { playerId: 1, periodType: 1, periodKey: 1 },
  { unique: true },
);
periodicStatisticsSchema.index({ periodType: 1, periodKey: 1, rank: 1 });
periodicStatisticsSchema.index({
  periodType: 1,
  periodKey: 1,
  "metrics.totalKills": -1,
});
periodicStatisticsSchema.index({ periodType: 1, periodKey: 1, "metrics.kdr": -1 });
periodicStatisticsSchema.index({ seasonId: 1, rank: 1 });

export const PeriodicStatistics = createModel(
  "PeriodicStatistics",
  periodicStatisticsSchema,
  "periodicStatistics",
);
