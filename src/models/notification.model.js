import mongoose from "mongoose";
import { NOTIFICATION_TYPES } from "../constants/domain.constants.js";
import { baseSchemaOptions, createModel } from "./model.helpers.js";
import { entityReferenceSchema } from "./shared.schemas.js";

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, trim: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    relatedEntity: { type: entityReferenceSchema, default: null },
    actionUrl: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
      validate: {
        validator: (value) => value === null || /^\/(?!\/)/.test(value),
        message: "Notification actionUrl must be an internal relative path.",
      },
    },
    isRead: { type: Boolean, required: true, default: false },
    readAt: { type: Date, default: null },
    data: { type: mongoose.Schema.Types.Mixed, default: null },
    source: {
      type: String,
      enum: ["system", "admin"],
      required: true,
      default: "system",
    },
    createdBy: { type: String, trim: true, maxlength: 128, default: null },
    deduplicationKey: {
      type: String,
      trim: true,
      maxlength: 250,
      default: null,
    },
  },
  baseSchemaOptions,
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1, createdAt: -1 });
notificationSchema.index({ createdAt: -1, type: 1 });
notificationSchema.index(
  { deduplicationKey: 1 },
  {
    unique: true,
    partialFilterExpression: { deduplicationKey: { $type: "string" } },
  },
);

notificationSchema.pre("validate", function normalizeReadState() {
  if (this.isRead && !this.readAt) this.readAt = new Date();
  if (!this.isRead) this.readAt = null;
});

export const Notification = createModel(
  "Notification",
  notificationSchema,
  "notifications",
);
