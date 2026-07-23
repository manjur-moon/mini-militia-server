import { paginationQuerySchema } from "@mini-militia/shared";
import { z } from "zod";
import { SEASON_STATUSES } from "../constants/domain.constants.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "A valid MongoDB ID is required.");
const identifier = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine(
    (value) => /^[a-f\d]{24}$/i.test(value) || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
    "Season identifier must be a MongoDB ID or lowercase slug.",
  );
const dateTime = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "A valid ISO date-time is required.",
});
const timezone = z.string().trim().min(1).max(100);
const auditReason = z.string().trim().min(5).max(1000);
const publicSeasonStatus = z.enum(["upcoming", "active", "completed", "archived"]);
const slug = z
  .string()
  .trim()
  .min(2)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a lowercase URL-safe slug.");

const editableFields = {
  name: z.string().trim().min(2).max(100),
  slug,
  description: z.string().trim().max(1000).default(""),
  startAt: dateTime,
  endAt: dateTime,
  timezone,
};

export const listSeasonsSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: paginationQuerySchema
    .extend({
      limit: z.coerce.number().int().min(1).max(100).default(20),
      status: publicSeasonStatus.optional(),
      search: z.string().trim().max(100).optional(),
      sortBy: z.enum(["startAt", "endAt", "createdAt", "name"]).default("startAt"),
      sortOrder: z.enum(["asc", "desc"]).default("desc"),
    })
    .strict(),
});

export const listAdminSeasonsSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: paginationQuerySchema
    .extend({
      limit: z.coerce.number().int().min(1).max(100).default(20),
      status: z.enum(SEASON_STATUSES).optional(),
      search: z.string().trim().max(100).optional(),
      sortBy: z.enum(["startAt", "endAt", "createdAt", "name"]).default("startAt"),
      sortOrder: z.enum(["asc", "desc"]).default("desc"),
    })
    .strict(),
});

export const getActiveSeasonSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});

export const getSeasonSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({ identifier }).strict(),
  query: z.object({}).strict(),
});

export const getSeasonLeaderboardSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({ identifier }).strict(),
  query: paginationQuerySchema
    .extend({
      limit: z.coerce.number().int().min(1).max(100).default(20),
      metric: z
        .enum([
          "overall",
          "kills",
          "deaths",
          "kdr",
          "activity",
          "first_places",
          "last_places",
          "win_rate",
          "average_rank",
        ])
        .default("overall"),
    })
    .strict(),
});

export const createSeasonSchema = z.object({
  body: z
    .object({
      ...editableFields,
      status: z.enum(["draft", "upcoming"]).default("draft"),
      reason: auditReason,
    })
    .strict()
    .superRefine((value, context) => {
      if (new Date(value.endAt) <= new Date(value.startAt)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endAt"],
          message: "Season endAt must be later than startAt.",
        });
      }
    }),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});

export const updateSeasonSchema = z.object({
  body: z
    .object({
      name: editableFields.name.optional(),
      slug: editableFields.slug.optional(),
      description: editableFields.description.optional(),
      startAt: editableFields.startAt.optional(),
      endAt: editableFields.endAt.optional(),
      timezone: editableFields.timezone.optional(),
      reason: auditReason,
    })
    .strict(),
  params: z.object({ seasonId: objectId }).strict(),
  query: z.object({}).strict(),
});

export const changeSeasonStatusSchema = z.object({
  body: z
    .object({
      status: z.enum(SEASON_STATUSES),
      reason: auditReason,
    })
    .strict(),
  params: z.object({ seasonId: objectId }).strict(),
  query: z.object({}).strict(),
});

export const recalculateSeasonSchema = z.object({
  body: z.object({ reason: auditReason }).strict(),
  params: z.object({ seasonId: objectId }).strict(),
  query: z.object({}).strict(),
});
