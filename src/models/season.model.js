import mongoose from "mongoose";
import { SEASON_STATUSES } from "../constants/domain.constants.js";
import { baseSchemaOptions, createModel } from "./model.helpers.js";

const finalizationSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["not_started", "processing", "completed", "failed"],
      required: true,
      default: "not_started",
    },
    version: { type: String, trim: true, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    errorCode: { type: String, trim: true, default: null },
  },
  { _id: false, strict: "throw" },
);

const seasonSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },
    description: { type: String, trim: true, maxlength: 1000, default: "" },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    timezone: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: SEASON_STATUSES,
      required: true,
      default: "draft",
    },
    championPlayerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      default: null,
    },
    mvpAwardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MVPAward",
      default: null,
    },
    activatedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
    finalization: {
      type: finalizationSchema,
      required: true,
      default: () => ({}),
    },
    finalizedSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    createdBy: { type: String, required: true, trim: true },
    updatedBy: { type: String, required: true, trim: true },
  },
  baseSchemaOptions,
);

seasonSchema.pre("validate", function validateSeasonRange() {
  if (this.startAt && this.endAt && this.endAt <= this.startAt) {
    throw new Error("Season endAt must be later than startAt.");
  }

  if (this.status === "active" && !this.activatedAt) {
    throw new Error("An active season requires activatedAt.");
  }

  if (["completed", "archived"].includes(this.status) && !this.completedAt) {
    throw new Error("A completed or archived season requires completedAt.");
  }

  if (this.status === "archived" && !this.archivedAt) {
    throw new Error("An archived season requires archivedAt.");
  }
});

seasonSchema.index({ startAt: 1, endAt: 1 });
seasonSchema.index({ status: 1, startAt: -1 });
seasonSchema.index({ status: 1, endAt: -1 });
seasonSchema.index({ championPlayerId: 1, completedAt: -1 });
seasonSchema.index(
  { status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "active" },
  },
);

export const Season = createModel("Season", seasonSchema, "seasons");
