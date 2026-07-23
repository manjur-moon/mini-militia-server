import { paginationQuerySchema } from "@mini-militia/shared";
import { z } from "zod";
import { MATCH_STATUSES } from "../constants/domain.constants.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "A valid MongoDB ID is required.");
const dateTime = z
  .string()
  .refine(
    (value) => !Number.isNaN(Date.parse(value)),
    "A valid ISO date-time is required.",
  );
const timezone = z.string().trim().min(1).max(100);
const integerField = z
  .union([z.string(), z.number()])
  .transform(Number)
  .pipe(z.number().int());

export const uploadMatchSchema = z.object({
  body: z
    .object({
      matchDate: dateTime,
      timezone,
      participantCount: integerField.pipe(z.number().min(2).max(50)),
      seasonId: z
        .union([objectId, z.literal("")])
        .optional()
        .transform((value) => value || undefined),
    })
    .strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});

export const listMatchesSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: paginationQuerySchema
    .extend({
      limit: z
        .union([z.string(), z.number()])
        .optional()
        .transform((value) => (value === undefined ? 10 : Number(value)))
        .pipe(z.number().int().min(1).max(50)),
      status: z.enum(MATCH_STATUSES).optional(),
      search: z.string().trim().max(80).optional(),
      seasonId: objectId.optional(),
      sortBy: z.enum(["matchDate", "createdAt"]).default("matchDate"),
      sortOrder: z.enum(["asc", "desc"]).default("desc"),
      dateFrom: z
        .string()
        .optional()
        .refine(
          (value) => value === undefined || !Number.isNaN(Date.parse(value)),
          "Invalid dateFrom.",
        ),
      dateTo: z
        .string()
        .optional()
        .refine(
          (value) => value === undefined || !Number.isNaN(Date.parse(value)),
          "Invalid dateTo.",
        ),
    })
    .strict(),
});

export const matchIdSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({ matchId: objectId }).strict(),
  query: z.object({}).strict(),
});

export const ocrJobIdSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({ jobId: objectId }).strict(),
  query: z.object({}).strict(),
});

const reviewedRow = z
  .object({
    resultId: objectId.optional(),
    playerId: objectId,
    kills: z.number().int().min(0).max(9999),
    deaths: z.number().int().min(0).max(9999),
    placement: z.number().int().min(1).max(50),
    reason: z.string().trim().min(3).max(500).optional(),
  })
  .strict();

export const reviewMatchSchema = z.object({
  body: z
    .object({
      matchDate: dateTime,
      timezone,
      participantCount: z.number().int().min(2).max(50),
      seasonId: z
        .union([objectId, z.literal(""), z.null()])
        .optional()
        .transform((value) => value || undefined),
      rows: z.array(reviewedRow).min(2).max(50),
      reason: z.string().trim().min(3).max(1000),
    })
    .strict(),
  params: z.object({ matchId: objectId }).strict(),
  query: z.object({}).strict(),
});

export const matchDecisionSchema = z.object({
  body: z.object({ reason: z.string().trim().min(3).max(1000) }).strict(),
  params: z.object({ matchId: objectId }).strict(),
  query: z.object({}).strict(),
});
