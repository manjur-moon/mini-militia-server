import mongoose from "mongoose";
import { baseSchemaOptions, createModel } from "./model.helpers.js";

const leagueConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "primary",
      immutable: true,
    },
    leagueName: { type: String, required: true, trim: true, maxlength: 100 },
    timezone: { type: String, required: true, trim: true, default: "Asia/Dhaka" },
    weekStartsOn: { type: Number, required: true, min: 0, max: 6, default: 1 },
    playerIdPrefix: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      match: /^[A-Z]{2,6}$/,
      default: "MM",
    },
    playerIdMinimumDigits: {
      type: Number,
      required: true,
      min: 3,
      max: 10,
      default: 3,
    },
    branding: {
      logoUrl: { type: String, trim: true, default: null },
      primaryName: { type: String, trim: true, default: "Mini Militia League" },
    },
    updatedBy: { type: String, required: true, trim: true },
  },
  baseSchemaOptions,
);

export const LeagueConfig = createModel(
  "LeagueConfig",
  leagueConfigSchema,
  "leagueConfigs",
);
