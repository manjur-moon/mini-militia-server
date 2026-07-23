import mongoose from "mongoose";
import { PLAYER_STATUSES } from "../constants/domain.constants.js";
import { baseSchemaOptions, createModel, normalizeText } from "./model.helpers.js";
import { imageAssetSchema } from "./shared.schemas.js";

const playerSchema = new mongoose.Schema(
  {
    playerId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      match: /^MM\d{3,}$/,
      immutable: true,
    },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    normalizedName: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 80,
    },
    aliases: {
      type: [String],
      default: [],
      set: (aliases) => [
        ...new Set(aliases.map((alias) => normalizeText(alias)).filter(Boolean)),
      ],
    },
    profileImage: { type: imageAssetSchema, default: null },
    joinDate: { type: Date, required: true },
    status: {
      type: String,
      enum: PLAYER_STATUSES,
      required: true,
      default: "active",
      index: true,
    },
    linkedUserId: {
      type: String,
      trim: true,
      default: null,
    },
    deactivatedAt: { type: Date, default: null },
    deactivationReason: { type: String, trim: true, maxlength: 300, default: null },
    createdBy: { type: String, required: true, trim: true },
    updatedBy: { type: String, required: true, trim: true },
  },
  baseSchemaOptions,
);

playerSchema.pre("validate", function normalizePlayerName() {
  if (this.name) this.normalizedName = normalizeText(this.name);
});

playerSchema.index({ normalizedName: 1, status: 1 });
playerSchema.index({ aliases: 1 });
playerSchema.index(
  { linkedUserId: 1 },
  {
    unique: true,
    partialFilterExpression: { linkedUserId: { $type: "string" } },
  },
);
playerSchema.index({ createdAt: -1 });

export const Player = createModel("Player", playerSchema, "players");
