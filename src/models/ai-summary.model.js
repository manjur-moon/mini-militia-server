import mongoose from "mongoose";
import {
  AI_SUMMARY_STATUSES,
  AI_SUMMARY_TYPES,
} from "../constants/domain.constants.js";
import { baseSchemaOptions, createModel } from "./model.helpers.js";

const usageSchema = new mongoose.Schema(
  {
    inputTokens: { type: Number, required: true, min: 0, default: 0 },
    outputTokens: { type: Number, required: true, min: 0, default: 0 },
    totalTokens: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false, strict: "throw" },
);

const aiSummarySchema = new mongoose.Schema(
  {
    type: { type: String, enum: AI_SUMMARY_TYPES, required: true },
    periodKey: { type: String, required: true, trim: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    timezone: { type: String, required: true, trim: true },
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", default: null },
    matchId: { type: mongoose.Schema.Types.ObjectId, ref: "Match", default: null },
    seasonId: { type: mongoose.Schema.Types.ObjectId, ref: "Season", default: null },
    status: {
      type: String,
      enum: AI_SUMMARY_STATUSES,
      required: true,
      default: "pending",
    },
    provider: { type: String, required: true, trim: true },
    model: { type: String, trim: true, default: null },
    providerRequestId: { type: String, trim: true, default: null },
    isFallback: { type: Boolean, required: true, default: false },
    content: { type: String, required: true, trim: true, maxlength: 10000 },
    structuredContent: { type: mongoose.Schema.Types.Mixed, required: true },
    sourceMetrics: { type: mongoose.Schema.Types.Mixed, required: true },
    sourceDataHash: { type: String, required: true, trim: true },
    promptVersion: { type: String, required: true, trim: true },
    generatedAt: { type: Date, required: true, default: Date.now },
    generatedBy: { type: String, required: true, trim: true },
    generationReason: { type: String, trim: true, maxlength: 1000, default: null },
    usage: { type: usageSchema, required: true, default: () => ({}) },
    validationWarnings: { type: [String], default: [] },
  },
  baseSchemaOptions,
);

aiSummarySchema.pre("validate", function validateSummaryScope() {
  if (this.type === "player_performance" && !this.playerId) {
    throw new Error("Player performance insight requires playerId.");
  }
  if (this.type === "match_insight" && !this.matchId) {
    throw new Error("Match insight requires matchId.");
  }
  if (this.endAt < this.startAt) {
    throw new Error("AI summary endAt must not be earlier than startAt.");
  }
  if (this.isFallback && this.provider !== "deterministic") {
    throw new Error("Fallback summaries must use the deterministic provider.");
  }
});

aiSummarySchema.index(
  { type: 1, periodKey: 1, playerId: 1, matchId: 1, sourceDataHash: 1 },
  { unique: true },
);
aiSummarySchema.index({ type: 1, periodKey: 1, generatedAt: -1 });
aiSummarySchema.index({ playerId: 1, generatedAt: -1 });
aiSummarySchema.index({ matchId: 1, generatedAt: -1 });
aiSummarySchema.index({ provider: 1, status: 1, generatedAt: -1 });

export const AISummary = createModel("AISummary", aiSummarySchema, "aiSummaries");
