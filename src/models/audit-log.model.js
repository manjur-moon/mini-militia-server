import mongoose from "mongoose";
import { AUDIT_ACTIONS } from "../constants/domain.constants.js";
import { baseSchemaOptions, createModel } from "./model.helpers.js";

const auditLogSchema = new mongoose.Schema(
  {
    actorUserId: { type: String, required: true, trim: true, index: true },
    action: { type: String, enum: AUDIT_ACTIONS, required: true, index: true },
    entityType: { type: String, required: true, trim: true, index: true },
    entityId: { type: String, required: true, trim: true },
    previousValue: { type: mongoose.Schema.Types.Mixed, default: null },
    newValue: { type: mongoose.Schema.Types.Mixed, default: null },
    reason: { type: String, trim: true, maxlength: 1000, default: null },
    ipAddress: { type: String, trim: true, maxlength: 64, default: null },
    userAgent: { type: String, trim: true, maxlength: 1000, default: null },
    requestId: { type: String, trim: true, maxlength: 100, default: null },
  },
  {
    ...baseSchemaOptions,
    timestamps: { createdAt: true, updatedAt: false },
  },
);

auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ actorUserId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

auditLogSchema.pre(
  [
    "updateOne",
    "updateMany",
    "findOneAndUpdate",
    "deleteOne",
    "deleteMany",
    "findOneAndDelete",
  ],
  function rejectAuditMutation() {
    throw new Error("Audit logs are append-only.");
  },
);

export const AuditLog = createModel("AuditLog", auditLogSchema, "auditLogs");
