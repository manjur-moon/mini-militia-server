import mongoose from "mongoose";
import { HALL_OF_FAME_CATEGORIES } from "../constants/domain.constants.js";
import {
  baseSchemaOptions,
  createModel,
  finiteNumberValidator,
} from "./model.helpers.js";

const playerSnapshotSchema = new mongoose.Schema(
  {
    playerId: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    photoUrl: { type: String, trim: true, default: null },
    status: { type: String, enum: ["active", "inactive"], required: true },
  },
  { _id: false, strict: "throw" },
);

const seasonSnapshotSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    timezone: { type: String, required: true, trim: true },
    status: { type: String, required: true, trim: true },
  },
  { _id: false, strict: "throw" },
);

const criteriaSnapshotSchema = new mongoose.Schema(
  {
    definition: { type: String, required: true, trim: true, maxlength: 1000 },
    minimumMatches: { type: Number, min: 0, default: null },
    tieBreakers: {
      type: [String],
      required: true,
      default: [],
    },
  },
  { _id: false, strict: "throw" },
);

const hallOfFameRecordSchema = new mongoose.Schema(
  {
    category: { type: String, enum: HALL_OF_FAME_CATEGORIES, required: true },
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true },
    playerSnapshot: { type: playerSnapshotSchema, required: true },
    seasonId: { type: mongoose.Schema.Types.ObjectId, ref: "Season", default: null },
    seasonSnapshot: { type: seasonSnapshotSchema, default: null },
    periodKey: { type: String, required: true, trim: true },
    recordValue: {
      type: Number,
      required: true,
      min: 0,
      validate: finiteNumberValidator,
    },
    unit: { type: String, required: true, trim: true, maxlength: 30 },
    awardDate: { type: Date, required: true },
    calculatedAt: { type: Date, required: true, default: Date.now },
    criteriaSnapshot: { type: criteriaSnapshotSchema, required: true },
    evidence: { type: mongoose.Schema.Types.Mixed, required: true },
    sourceVersion: { type: String, required: true, trim: true },
    sourceDataHash: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["current", "historical"],
      required: true,
      default: "current",
    },
    supersededAt: { type: Date, default: null },
    supersededByRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HallOfFameRecord",
      default: null,
    },
    supersededReason: { type: String, trim: true, maxlength: 1000, default: null },
  },
  baseSchemaOptions,
);

hallOfFameRecordSchema.pre("validate", function validateCategoryScope() {
  const isSeasonChampion = this.category === "season_champion";
  if (isSeasonChampion && (!this.seasonId || !this.seasonSnapshot)) {
    throw new Error("Season champion records require seasonId and seasonSnapshot.");
  }
  if (!isSeasonChampion && (this.seasonId || this.seasonSnapshot)) {
    throw new Error("Only season champion records may reference a season.");
  }
});

hallOfFameRecordSchema.index(
  { category: 1, seasonId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "current" },
  },
);
hallOfFameRecordSchema.index({ playerId: 1, awardDate: -1 });
hallOfFameRecordSchema.index({ category: 1, status: 1, awardDate: -1 });
hallOfFameRecordSchema.index({ seasonId: 1, status: 1 });
hallOfFameRecordSchema.index({ sourceDataHash: 1 });

export const HallOfFameRecord = createModel(
  "HallOfFameRecord",
  hallOfFameRecordSchema,
  "hallOfFameRecords",
);
