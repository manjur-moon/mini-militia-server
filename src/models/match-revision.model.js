import mongoose from "mongoose";
import { baseSchemaOptions, createModel } from "./model.helpers.js";

const matchRevisionSchema = new mongoose.Schema(
  {
    matchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Match",
      required: true,
      immutable: true,
    },
    revisionNumber: { type: Number, required: true, min: 1, immutable: true },
    status: {
      type: String,
      enum: ["proposed", "approved", "rejected"],
      required: true,
      default: "proposed",
    },
    reason: { type: String, required: true, trim: true, maxlength: 1000 },
    requestedBy: { type: String, required: true, trim: true },
    requestedAt: { type: Date, required: true, default: Date.now },
    reviewedBy: { type: String, trim: true, default: null },
    reviewedAt: { type: Date, default: null },
    previousMatchSnapshot: { type: mongoose.Schema.Types.Mixed, required: true },
    previousResultSnapshots: { type: [mongoose.Schema.Types.Mixed], required: true },
    proposedMatchSnapshot: { type: mongoose.Schema.Types.Mixed, required: true },
    proposedResultSnapshots: { type: [mongoose.Schema.Types.Mixed], required: true },
    recalculationJobKey: { type: String, trim: true, default: null },
    appliedAt: { type: Date, default: null },
  },
  baseSchemaOptions,
);

matchRevisionSchema.index({ matchId: 1, revisionNumber: 1 }, { unique: true });
matchRevisionSchema.index({ status: 1, createdAt: -1 });

export const MatchRevision = createModel(
  "MatchRevision",
  matchRevisionSchema,
  "matchRevisions",
);
