import mongoose from "mongoose";
import {
  baseSchemaOptions,
  createModel,
  finiteNumberValidator,
} from "./model.helpers.js";

const playerSideSchema = new mongoose.Schema(
  {
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true },
    headToHeadWins: { type: Number, required: true, min: 0, default: 0 },
    totalKills: { type: Number, required: true, min: 0, default: 0 },
    totalDeaths: { type: Number, required: true, min: 0, default: 0 },
    kdr: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: finiteNumberValidator,
    },
  },
  { _id: false, strict: "throw" },
);

const rivalryStatisticsSchema = new mongoose.Schema(
  {
    pairKey: { type: String, required: true, immutable: true, index: true },
    periodType: {
      type: String,
      enum: ["weekly", "monthly", "season", "all_time"],
      required: true,
      index: true,
    },
    periodKey: { type: String, required: true, trim: true, index: true },
    periodStartAt: { type: Date, required: true },
    periodEndAt: { type: Date, required: true },
    timezone: { type: String, required: true, trim: true },
    seasonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Season",
      default: null,
    },
    playerA: { type: playerSideSchema, required: true },
    playerB: { type: playerSideSchema, required: true },
    sharedMatches: { type: Number, required: true, min: 0, default: 0 },
    draws: { type: Number, required: true, min: 0, default: 0 },
    combinedKills: { type: Number, required: true, min: 0, default: 0 },
    winDifference: { type: Number, required: true, min: 0, default: 0 },
    competitivenessScore: {
      type: Number,
      required: true,
      min: 0,
      validate: finiteNumberValidator,
    },
    lastSharedMatchAt: { type: Date, default: null },
    calculationVersion: { type: String, required: true, trim: true },
    sourceDataHash: { type: String, required: true, trim: true },
    recalculatedAt: { type: Date, required: true, default: Date.now },
  },
  baseSchemaOptions,
);

rivalryStatisticsSchema.index(
  { pairKey: 1, periodType: 1, periodKey: 1 },
  { unique: true },
);
rivalryStatisticsSchema.index({ "playerA.playerId": 1, periodType: 1, periodKey: 1 });
rivalryStatisticsSchema.index({ "playerB.playerId": 1, periodType: 1, periodKey: 1 });
rivalryStatisticsSchema.index({
  periodType: 1,
  periodKey: 1,
  competitivenessScore: -1,
  sharedMatches: -1,
});
rivalryStatisticsSchema.index(
  { recalculatedAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 400 },
);

export const RivalryStatistics = createModel(
  "RivalryStatistics",
  rivalryStatisticsSchema,
  "rivalryStatistics",
);
