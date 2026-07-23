import mongoose from "mongoose";
import { MATCH_STATUSES } from "../constants/domain.constants.js";
import { baseSchemaOptions, createModel } from "./model.helpers.js";
import { imageAssetSchema } from "./shared.schemas.js";

const verificationSchema = new mongoose.Schema(
  {
    verifiedBy: { type: String, trim: true, default: null },
    verifiedAt: { type: Date, default: null },
    rejectedBy: { type: String, trim: true, default: null },
    rejectedAt: { type: Date, default: null },
    rejectionReason: { type: String, trim: true, maxlength: 500, default: null },
  },
  { _id: false, strict: "throw" },
);

const statisticsRecalculationSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["not_started", "pending", "completed", "failed"],
      required: true,
      default: "not_started",
    },
    calculationVersion: { type: String, trim: true, default: null },
    requestedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    errorCode: { type: String, trim: true, default: null },
  },
  { _id: false, strict: "throw" },
);

const matchSchema = new mongoose.Schema(
  {
    matchCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      immutable: true,
    },
    status: {
      type: String,
      enum: MATCH_STATUSES,
      required: true,
      default: "uploaded",
      index: true,
    },
    screenshot: { type: imageAssetSchema, required: true },
    uploadMetadata: {
      originalFilename: { type: String, required: true, trim: true, maxlength: 255 },
      detectedFormat: { type: String, required: true, enum: ["jpg", "png", "webp"] },
      mimeType: { type: String, required: true, trim: true },
    },
    matchDate: { type: Date, required: true, index: true },
    timezone: { type: String, required: true, trim: true },
    seasonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Season",
      default: null,
      index: true,
    },
    participantCount: { type: Number, required: true, min: 2, max: 50 },
    uploadedBy: { type: String, required: true, trim: true },
    ocrJobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OCRJob",
      default: null,
    },
    duplicateOfMatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Match",
      default: null,
    },
    duplicateReviewNote: { type: String, trim: true, maxlength: 500, default: null },
    reviewStartedBy: { type: String, trim: true, default: null },
    reviewStartedAt: { type: Date, default: null },
    verification: { type: verificationSchema, default: () => ({}) },
    currentRevision: { type: Number, required: true, min: 0, default: 0 },
    resultCount: { type: Number, required: true, min: 0, default: 0 },
    verifiedResultCount: { type: Number, required: true, min: 0, default: 0 },
    statisticsRecalculation: {
      type: statisticsRecalculationSchema,
      required: true,
      default: () => ({}),
    },
  },
  baseSchemaOptions,
);

matchSchema.index({ status: 1, createdAt: -1 });
matchSchema.index({ status: 1, matchDate: -1 });
matchSchema.index({ seasonId: 1, matchDate: -1, status: 1 });
matchSchema.index(
  { "screenshot.sha256": 1 },
  {
    unique: true,
    partialFilterExpression: { "screenshot.sha256": { $type: "string" } },
  },
);
matchSchema.index({ uploadedBy: 1, createdAt: -1 });

export const Match = createModel("Match", matchSchema, "matches");
