import { paginationQuerySchema } from "@mini-militia/shared";
import { z } from "zod";
import { NOTIFICATION_TYPES } from "../constants/domain.constants.js";

const emptyObject = z.object({}).strict();
const notificationId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "A valid notification ID is required.");
const userIdentifier = z.string().trim().min(1).max(254);
const auditReason = z.string().trim().min(5).max(1000);
const internalActionUrl = z
  .string()
  .trim()
  .max(500)
  .regex(/^\/(?!\/)/, "Use an internal relative URL beginning with one slash.");
const relatedEntity = z
  .object({
    entityType: z.string().trim().min(1).max(100),
    entityId: z.string().trim().min(1).max(128),
  })
  .strict();

const listFilters = {
  type: z.enum(NOTIFICATION_TYPES).optional(),
  readStatus: z.enum(["all", "read", "unread"]).default("all"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
};

export const listNotificationsSchema = z.object({
  body: emptyObject,
  params: emptyObject,
  query: paginationQuerySchema
    .extend({
      limit: z.coerce.number().int().min(1).max(100).default(20),
      ...listFilters,
    })
    .strict(),
});

export const getUnreadNotificationCountSchema = z.object({
  body: emptyObject,
  params: emptyObject,
  query: emptyObject,
});

export const markNotificationReadSchema = z.object({
  body: emptyObject,
  params: z.object({ notificationId }).strict(),
  query: emptyObject,
});

export const markAllNotificationsReadSchema = z.object({
  body: emptyObject,
  params: emptyObject,
  query: emptyObject,
});

export const listAdminNotificationsSchema = z.object({
  body: emptyObject,
  params: emptyObject,
  query: paginationQuerySchema
    .extend({
      limit: z.coerce.number().int().min(1).max(100).default(20),
      ...listFilters,
      userId: z.string().trim().max(128).optional(),
      search: z.string().trim().max(150).optional(),
      source: z.enum(["system", "admin"]).optional(),
      dateFrom: z.string().datetime({ offset: true }).optional(),
      dateTo: z.string().datetime({ offset: true }).optional(),
    })
    .strict()
    .superRefine((value, context) => {
      if (
        value.dateFrom &&
        value.dateTo &&
        new Date(value.dateTo) < new Date(value.dateFrom)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["dateTo"],
          message: "dateTo must be later than or equal to dateFrom.",
        });
      }
    }),
});

export const createAdminNotificationSchema = z.object({
  body: z
    .object({
      userIdentifier,
      title: z.string().trim().min(2).max(150),
      message: z.string().trim().min(2).max(1000),
      actionUrl: internalActionUrl.nullable().optional(),
      relatedEntity: relatedEntity.nullable().optional(),
      reason: auditReason,
    })
    .strict(),
  params: emptyObject,
  query: emptyObject,
});
