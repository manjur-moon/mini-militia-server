import mongoose from "mongoose";
import { baseSchemaOptions, createModel } from "./model.helpers.js";

const titleSnapshotSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true },
    version: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    icon: { type: String, trim: true, default: null },
    priority: { type: Number, required: true, min: 1 },
    periodType: { type: String, required: true, trim: true },
  },
  { _id: false, strict: "throw" },
);

const playerTitleSchema = new mongoose.Schema(
  {
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true },
    titleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DynamicTitle",
      required: true,
    },
    titleCode: { type: String, required: true, trim: true, uppercase: true },
    titleVersion: { type: String, required: true, trim: true },
    titleSnapshot: { type: titleSnapshotSchema, required: true },
    periodKey: { type: String, required: true, trim: true },
    periodStartAt: { type: Date, required: true },
    periodEndAt: { type: Date, required: true },
    awardedAt: { type: Date, required: true, default: Date.now },
    expiresAt: { type: Date, required: true },
    isCurrent: { type: Boolean, required: true, default: false },
    status: {
      type: String,
      enum: ["awarded", "expired", "superseded", "revoked"],
      required: true,
      default: "awarded",
    },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, trim: true, maxlength: 1000, default: null },
    evaluationRunId: { type: String, required: true, trim: true },
    evidence: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  baseSchemaOptions,
);

playerTitleSchema.index(
  { playerId: 1, titleCode: 1, periodKey: 1, titleVersion: 1 },
  { unique: true },
);
playerTitleSchema.index(
  { playerId: 1, isCurrent: 1 },
  { unique: true, partialFilterExpression: { isCurrent: true } },
);
playerTitleSchema.index({ playerId: 1, awardedAt: -1 });
playerTitleSchema.index({ expiresAt: 1, isCurrent: 1 });
playerTitleSchema.index({ titleCode: 1, periodKey: 1, status: 1 });

export const PlayerTitle = createModel(
  "PlayerTitle",
  playerTitleSchema,
  "playerTitles",
);
