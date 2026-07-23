import mongoose from "mongoose";
import { OCR_JOB_STATUSES } from "../constants/domain.constants.js";
import { baseSchemaOptions, createModel } from "./model.helpers.js";

const ocrErrorSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    occurredAt: { type: Date, required: true, default: Date.now },
    retryable: { type: Boolean, required: true, default: false },
  },
  { _id: false, strict: "throw" },
);

const ocrJobSchema = new mongoose.Schema(
  {
    matchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Match",
      required: true,
      unique: true,
      immutable: true,
    },
    provider: { type: String, required: true, trim: true },
    providerVersion: { type: String, trim: true, default: null },
    providerJobId: { type: String, trim: true, default: null },
    status: {
      type: String,
      enum: OCR_JOB_STATUSES,
      required: true,
      default: "queued",
      index: true,
    },
    attempts: { type: Number, required: true, min: 0, default: 0 },
    maxAttempts: { type: Number, required: true, min: 1, default: 3 },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    nextRetryAt: { type: Date, default: null },
    rawText: { type: String, default: "" },
    rawResponse: { type: mongoose.Schema.Types.Mixed, default: null },
    averageConfidence: { type: Number, min: 0, max: 1, default: null },
    parsedRowCount: { type: Number, min: 0, default: 0 },
    parserVersion: { type: String, trim: true, default: "generic-v1" },
    parserProfile: {
      type: String,
      enum: ["mini-militia-final-score-v1", "generic-v1"],
      default: "mini-militia-final-score-v1",
    },
    sourceCrop: {
      x: { type: Number, min: 0, default: null },
      y: { type: Number, min: 0, default: null },
      width: { type: Number, min: 1, default: null },
      height: { type: Number, min: 1, default: null },
    },
    columnOrder: { type: [String], default: [] },
    errorHistory: { type: [ocrErrorSchema], default: [] },
    lock: {
      token: { type: String, trim: true, default: null },
      lockedAt: { type: Date, default: null },
      expiresAt: { type: Date, default: null },
    },
  },
  baseSchemaOptions,
);

ocrJobSchema.index({ status: 1, nextRetryAt: 1, createdAt: 1 });
ocrJobSchema.index({ "lock.expiresAt": 1 });
ocrJobSchema.index({ providerJobId: 1 }, { sparse: true });

export const OCRJob = createModel("OCRJob", ocrJobSchema, "ocrJobs");
