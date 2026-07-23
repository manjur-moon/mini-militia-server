import mongoose from "mongoose";
import { baseSchemaOptions, createModel } from "./model.helpers.js";
import { recordReferenceSchema, statisticsMetricsSchema } from "./shared.schemas.js";

const personalRecordsSchema = new mongoose.Schema(
  {
    highestKills: { type: recordReferenceSchema, default: () => ({}) },
    highestDeaths: { type: recordReferenceSchema, default: () => ({}) },
    bestKdr: { type: recordReferenceSchema, default: () => ({}) },
    longestMvpStreak: { type: Number, required: true, min: 0, default: 0 },
    longestFirstPlaceStreak: { type: Number, required: true, min: 0, default: 0 },
    mostMatchesInOneDay: {
      value: { type: Number, required: true, min: 0, default: 0 },
      date: { type: Date, default: null },
    },
  },
  { _id: false, strict: "throw" },
);

const playerStatisticsSchema = new mongoose.Schema(
  {
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      required: true,
      unique: true,
      immutable: true,
    },
    metrics: { type: statisticsMetricsSchema, required: true, default: () => ({}) },
    records: { type: personalRecordsSchema, required: true, default: () => ({}) },
    globalRank: { type: Number, min: 1, default: null },
    calculationVersion: { type: String, required: true, trim: true },
    sourceVerifiedMatchCount: { type: Number, required: true, min: 0, default: 0 },
    lastVerifiedMatchAt: { type: Date, default: null },
    recalculatedAt: { type: Date, required: true, default: Date.now },
  },
  baseSchemaOptions,
);

playerStatisticsSchema.index({ "metrics.totalKills": -1, playerId: 1 });
playerStatisticsSchema.index({ "metrics.kdr": -1, "metrics.matchesPlayed": -1 });
playerStatisticsSchema.index({ globalRank: 1 });

export const PlayerStatistics = createModel(
  "PlayerStatistics",
  playerStatisticsSchema,
  "playerStatistics",
);
