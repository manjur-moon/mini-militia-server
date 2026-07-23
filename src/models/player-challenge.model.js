import mongoose from "mongoose";
import { PLAYER_CHALLENGE_STATUSES } from "../constants/domain.constants.js";
import {
  baseSchemaOptions,
  createModel,
  finiteNumberValidator,
} from "./model.helpers.js";

const challengeSnapshotSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true },
    version: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    icon: { type: String, required: true, trim: true },
    type: { type: String, enum: ["weekly", "monthly"], required: true },
    metric: { type: String, required: true, trim: true },
    targetOperator: { type: String, enum: ["gte", "lte", "gt", "lt"], required: true },
    targetValue: { type: Number, required: true, validate: finiteNumberValidator },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    timezone: { type: String, required: true, trim: true },
    reward: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { _id: false, strict: "throw" },
);

const playerChallengeSchema = new mongoose.Schema(
  {
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true },
    challengeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Challenge",
      required: true,
    },
    challengeCode: { type: String, required: true, uppercase: true, trim: true },
    challengeVersion: { type: String, required: true, trim: true },
    challengeSnapshot: { type: challengeSnapshotSchema, required: true },
    isEligible: { type: Boolean, required: true, default: false },
    currentValue: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: finiteNumberValidator,
    },
    targetValue: {
      type: Number,
      required: true,
      min: 0.000001,
      validate: finiteNumberValidator,
    },
    progressPercentage: { type: Number, required: true, min: 0, max: 100, default: 0 },
    status: {
      type: String,
      enum: PLAYER_CHALLENGE_STATUSES,
      required: true,
      default: "in_progress",
    },
    completedAt: { type: Date, default: null },
    evidence: { type: mongoose.Schema.Types.Mixed, default: null },
    evaluationRunId: { type: String, required: true, trim: true },
    firstEvaluatedAt: { type: Date, required: true, default: Date.now },
    lastEvaluatedAt: { type: Date, required: true, default: Date.now },
  },
  baseSchemaOptions,
);

playerChallengeSchema.index({ playerId: 1, challengeId: 1 }, { unique: true });
playerChallengeSchema.index({ challengeCode: 1, status: 1, currentValue: -1 });
playerChallengeSchema.index({ playerId: 1, status: 1, updatedAt: -1 });
playerChallengeSchema.index({ "challengeSnapshot.type": 1, status: 1, updatedAt: -1 });

export const PlayerChallenge = createModel(
  "PlayerChallenge",
  playerChallengeSchema,
  "playerChallenges",
);
