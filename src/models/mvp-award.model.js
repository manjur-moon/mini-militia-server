import mongoose from "mongoose";
import { MVP_AWARD_TYPES } from "../constants/domain.constants.js";
import {
  baseSchemaOptions,
  createModel,
  finiteNumberValidator,
} from "./model.helpers.js";

const scoreBreakdownSchema = new mongoose.Schema(
  {
    killScore: { type: Number, required: true, validate: finiteNumberValidator },
    deathPenalty: { type: Number, required: true, validate: finiteNumberValidator },
    placementBonus: { type: Number, required: true, validate: finiteNumberValidator },
    kdrBonus: { type: Number, required: true, validate: finiteNumberValidator },
    activityAdjustment: {
      type: Number,
      required: true,
      validate: finiteNumberValidator,
    },
    totalScore: { type: Number, required: true, validate: finiteNumberValidator },
    inputs: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { _id: false, strict: "throw" },
);

const mvpAwardSchema = new mongoose.Schema(
  {
    awardType: { type: String, enum: MVP_AWARD_TYPES, required: true },
    periodKey: { type: String, required: true, trim: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    timezone: { type: String, required: true, trim: true },
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true },
    seasonId: { type: mongoose.Schema.Types.ObjectId, ref: "Season", default: null },
    score: { type: Number, required: true, validate: finiteNumberValidator },
    scoreBreakdown: { type: scoreBreakdownSchema, required: true },
    formulaVersion: { type: String, required: true, trim: true },
    minimumMatchesMet: { type: Boolean, required: true },
    status: {
      type: String,
      enum: ["current", "superseded"],
      required: true,
      default: "current",
    },
    supersededByAwardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MVPAward",
      default: null,
    },
    awardedAt: { type: Date, required: true, default: Date.now },
    sourceDataHash: { type: String, required: true, trim: true },
  },
  baseSchemaOptions,
);

mvpAwardSchema.pre("validate", function validateAwardScore() {
  if (
    this.scoreBreakdown &&
    Math.abs(this.score - this.scoreBreakdown.totalScore) > 0.000001
  ) {
    throw new Error("Award score must equal scoreBreakdown.totalScore.");
  }
});

mvpAwardSchema.index(
  { awardType: 1, periodKey: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "current" },
  },
);
mvpAwardSchema.index({ playerId: 1, awardedAt: -1 });
mvpAwardSchema.index({ seasonId: 1, score: -1 });

export const MVPAward = createModel("MVPAward", mvpAwardSchema, "mvpAwards");
