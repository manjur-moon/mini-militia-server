import mongoose from "mongoose";
import { baseSchemaOptions, createModel } from "./model.helpers.js";

const playerCounterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    sequence: { type: Number, required: true, min: 0, default: 0 },
  },
  baseSchemaOptions,
);

export const PlayerCounter = createModel(
  "PlayerCounter",
  playerCounterSchema,
  "playerCounters",
);
