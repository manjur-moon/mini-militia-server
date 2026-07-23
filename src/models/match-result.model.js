import mongoose from "mongoose";
import {
  MATCH_RESULT_STATUSES,
  PLAYER_MATCH_STATUSES,
} from "../constants/domain.constants.js";
import { baseSchemaOptions, createModel } from "./model.helpers.js";

const extractedResultSchema = new mongoose.Schema(
  {
    playerName: { type: String, required: true, trim: true, maxlength: 100 },
    normalizedPlayerName: { type: String, required: true, trim: true, lowercase: true },
    kills: { type: Number, required: true, min: 0 },
    deaths: { type: Number, required: true, min: 0 },
    placement: { type: Number, required: true, min: 1 },
    scoreDifference: { type: Number, default: null },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    rawText: { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { _id: false, strict: "throw" },
);

const matchCandidateSchema = new mongoose.Schema(
  {
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true },
    playerCode: { type: String, required: true, trim: true },
    playerName: { type: String, required: true, trim: true },
    score: { type: Number, required: true, min: 0, max: 1 },
  },
  { _id: false, strict: "throw" },
);

const playerMatchSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: PLAYER_MATCH_STATUSES,
      required: true,
      default: "none",
    },
    suggestedPlayerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      default: null,
    },
    candidates: { type: [matchCandidateSchema], default: [] },
    confirmedBy: { type: String, trim: true, default: null },
    confirmedAt: { type: Date, default: null },
  },
  { _id: false, strict: "throw" },
);

const correctedResultSchema = new mongoose.Schema(
  {
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true },
    playerName: { type: String, required: true, trim: true, maxlength: 100 },
    normalizedPlayerName: { type: String, required: true, trim: true, lowercase: true },
    kills: { type: Number, required: true, min: 0 },
    deaths: { type: Number, required: true, min: 0 },
    placement: { type: Number, required: true, min: 1 },
    correctedBy: { type: String, required: true, trim: true },
    correctedAt: { type: Date, required: true },
    reason: { type: String, trim: true, maxlength: 500, default: null },
  },
  { _id: false, strict: "throw" },
);

const officialResultSchema = new mongoose.Schema(
  {
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true },
    playerName: { type: String, required: true, trim: true, maxlength: 100 },
    kills: { type: Number, required: true, min: 0 },
    deaths: { type: Number, required: true, min: 0 },
    placement: { type: Number, required: true, min: 1 },
    verifiedBy: { type: String, required: true, trim: true },
    verifiedAt: { type: Date, required: true },
    lastCorrectedBy: { type: String, trim: true, default: null },
    lastCorrectedAt: { type: Date, default: null },
  },
  { _id: false, strict: "throw" },
);

const matchResultSchema = new mongoose.Schema(
  {
    matchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Match",
      required: true,
      index: true,
      immutable: true,
    },
    rowIndex: { type: Number, required: true, min: 0, immutable: true },
    source: { type: String, enum: ["ocr", "manual"], required: true, default: "ocr" },
    status: {
      type: String,
      enum: MATCH_RESULT_STATUSES,
      required: true,
      default: "pending",
      index: true,
    },
    extracted: { type: extractedResultSchema, required: true },
    playerMatch: { type: playerMatchSchema, required: true, default: () => ({}) },
    corrected: { type: correctedResultSchema, default: null },
    official: { type: officialResultSchema, default: null },
    officialMatchDate: { type: Date, default: null, index: true },
    officialSeasonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Season",
      default: null,
    },
    validationWarnings: { type: [String], default: [] },
    rejectedReason: { type: String, trim: true, maxlength: 500, default: null },
  },
  baseSchemaOptions,
);

matchResultSchema.index({ matchId: 1, rowIndex: 1 }, { unique: true });
matchResultSchema.index(
  { matchId: 1, "official.playerId": 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: "verified",
      "official.playerId": { $type: "objectId" },
    },
  },
);
matchResultSchema.index(
  { matchId: 1, "official.placement": 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: "verified",
      "official.placement": { $type: "number" },
    },
  },
);
matchResultSchema.index({ "official.playerId": 1, officialMatchDate: -1, status: 1 });
matchResultSchema.index({ officialSeasonId: 1, officialMatchDate: -1, status: 1 });

export const MatchResult = createModel(
  "MatchResult",
  matchResultSchema,
  "matchResults",
);
