import mongoose from "mongoose";
import { PERIOD_TYPES } from "../constants/domain.constants.js";
import {
  baseSchemaOptions,
  createModel,
  finiteNumberValidator,
} from "./model.helpers.js";

const ratingValue = {
  type: Number,
  required: true,
  min: 0,
  max: 100,
  validate: finiteNumberValidator,
};

const playerRatingSchema = new mongoose.Schema(
  {
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true },
    periodType: { type: String, enum: PERIOD_TYPES, required: true },
    periodKey: { type: String, required: true, trim: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    timezone: { type: String, required: true, trim: true },
    seasonId: { type: mongoose.Schema.Types.ObjectId, ref: "Season", default: null },
    attack: ratingValue,
    survival: ratingValue,
    consistency: ratingValue,
    activity: ratingValue,
    overall: ratingValue,
    rank: { type: Number, min: 1, default: null },
    sampleSize: { type: Number, required: true, min: 0 },
    minimumMatchesMet: { type: Boolean, required: true, default: false },
    confidenceFactor: { type: Number, required: true, min: 0, max: 1 },
    formulaVersion: { type: String, required: true, trim: true },
    sourceDataHash: { type: String, required: true, trim: true },
    inputSnapshot: { type: mongoose.Schema.Types.Mixed, required: true },
    calculatedAt: { type: Date, required: true, default: Date.now },
  },
  baseSchemaOptions,
);

playerRatingSchema.index(
  { playerId: 1, periodType: 1, periodKey: 1, formulaVersion: 1 },
  { unique: true },
);
playerRatingSchema.index({ periodType: 1, periodKey: 1, rank: 1 });
playerRatingSchema.index({ periodType: 1, periodKey: 1, overall: -1 });

export const PlayerRating = createModel(
  "PlayerRating",
  playerRatingSchema,
  "playerRatings",
);
