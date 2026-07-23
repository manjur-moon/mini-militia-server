import mongoose from "mongoose";
import {
  CHALLENGE_STATUSES,
  CHALLENGE_TYPES,
  METRIC_KEYS,
} from "../constants/domain.constants.js";
import {
  baseSchemaOptions,
  createModel,
  finiteNumberValidator,
} from "./model.helpers.js";
import { ruleSetSchema } from "./shared.schemas.js";

const rewardSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    badgeIcon: { type: String, trim: true, maxlength: 64, default: "🎯" },
    description: { type: String, trim: true, maxlength: 300, default: "" },
  },
  { _id: false, strict: "throw" },
);

const challengeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 120,
      match: /^[A-Z0-9_]+$/,
    },
    version: { type: String, required: true, trim: true, maxlength: 50 },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    icon: { type: String, required: true, trim: true, maxlength: 64, default: "🎯" },
    type: { type: String, enum: CHALLENGE_TYPES, required: true },
    status: {
      type: String,
      enum: CHALLENGE_STATUSES,
      required: true,
      default: "draft",
    },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    timezone: { type: String, required: true, trim: true },
    metric: { type: String, enum: METRIC_KEYS, required: true },
    targetOperator: {
      type: String,
      enum: ["gte", "lte", "gt", "lt"],
      required: true,
      default: "gte",
    },
    targetValue: {
      type: Number,
      required: true,
      min: 0.000001,
      validate: finiteNumberValidator,
    },
    minimumMatches: { type: Number, required: true, min: 0, default: 0 },
    minimumEligibility: { type: ruleSetSchema, default: null },
    reward: { type: rewardSchema, required: true },
    isSystemDefault: { type: Boolean, required: true, default: false },
    createdBy: { type: String, required: true, trim: true },
    updatedBy: { type: String, required: true, trim: true },
    statusChangedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
  },
  baseSchemaOptions,
);

challengeSchema.pre("validate", function validateChallengeRange() {
  if (this.startAt && this.endAt && this.endAt <= this.startAt) {
    throw new Error("Challenge endAt must be later than startAt.");
  }
  if (this.status === "archived" && !this.archivedAt) this.archivedAt = new Date();
  if (this.status === "completed" && !this.completedAt) this.completedAt = new Date();
});

challengeSchema.index({ type: 1, status: 1, startAt: -1 });
challengeSchema.index({ status: 1, endAt: 1 });
challengeSchema.index({ startAt: 1, endAt: 1, metric: 1 });

export const Challenge = createModel("Challenge", challengeSchema, "challenges");
