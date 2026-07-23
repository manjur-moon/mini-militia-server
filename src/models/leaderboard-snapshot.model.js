import mongoose from "mongoose";
import { PERIOD_TYPES } from "../constants/domain.constants.js";
import {
  baseSchemaOptions,
  createModel,
  finiteNumberValidator,
} from "./model.helpers.js";

const leaderboardEntrySchema = new mongoose.Schema(
  {
    rank: { type: Number, required: true, min: 1 },
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true },
    playerName: { type: String, required: true, trim: true },
    playerCode: { type: String, required: true, trim: true },
    photoUrl: { type: String, trim: true, default: null },
    value: { type: Number, required: true, validate: finiteNumberValidator },
    matchesPlayed: { type: Number, required: true, min: 0 },
    tieBreak: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { _id: false, strict: "throw" },
);

const leaderboardSnapshotSchema = new mongoose.Schema(
  {
    metric: { type: String, required: true, trim: true },
    periodType: { type: String, enum: PERIOD_TYPES, required: true },
    periodKey: { type: String, required: true, trim: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    timezone: { type: String, required: true, trim: true },
    seasonId: { type: mongoose.Schema.Types.ObjectId, ref: "Season", default: null },
    minimumMatches: { type: Number, required: true, min: 0, default: 0 },
    entries: { type: [leaderboardEntrySchema], required: true, default: [] },
    calculationVersion: { type: String, required: true, trim: true },
    sourceDataHash: { type: String, required: true, trim: true },
    generatedAt: { type: Date, required: true, default: Date.now },
  },
  baseSchemaOptions,
);

leaderboardSnapshotSchema.index(
  { metric: 1, periodType: 1, periodKey: 1, calculationVersion: 1 },
  { unique: true },
);
leaderboardSnapshotSchema.index({ periodType: 1, periodKey: 1, generatedAt: -1 });

export const LeaderboardSnapshot = createModel(
  "LeaderboardSnapshot",
  leaderboardSnapshotSchema,
  "leaderboardSnapshots",
);
