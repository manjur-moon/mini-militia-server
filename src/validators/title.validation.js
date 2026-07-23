import { paginationQuerySchema } from "@mini-militia/shared";
import { z } from "zod";
import { METRIC_KEYS } from "../constants/domain.constants.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "A valid MongoDB ID is required.");
const playerCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^MM\d{3,}$/, "Player ID must use the MM001 format.");
const titleCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[A-Z0-9_]+$/,
    "Title code may contain uppercase letters, numbers and underscores.",
  );
const titleVersion = z
  .string()
  .trim()
  .min(2)
  .max(50)
  .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/i);
const isoDate = z
  .string()
  .trim()
  .optional()
  .refine((value) => value === undefined || !Number.isNaN(Date.parse(value)), {
    message: "A valid ISO date is required.",
  });
const finiteNumber = z.number().refine(Number.isFinite, {
  message: "A finite number is required.",
});

const condition = z
  .object({
    metric: z.enum(METRIC_KEYS),
    operator: z.enum(["eq", "gte", "lte", "gt", "lt"]),
    value: finiteNumber,
  })
  .strict();
const rules = z
  .object({
    combinator: z.enum(["all", "any"]),
    conditions: z.array(condition).min(1).max(10),
  })
  .strict();

const definitionFields = {
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().min(5).max(500),
  icon: z.string().trim().max(32).nullable().optional(),
  periodType: z.enum(["weekly", "monthly", "season", "all_time"]),
  minimumMatches: z.number().int().min(1).max(500),
  priority: z.number().int().min(1).max(1000),
  rules,
  durationDays: z.number().int().min(1).max(365),
};

export const listPublicTitlesSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});

export const getPublicTitleSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({ code: titleCode }).strict(),
  query: z.object({}).strict(),
});

export const getPlayerCurrentTitleSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({ playerId: playerCode }).strict(),
  query: z.object({}).strict(),
});

export const getPlayerTitleHistorySchema = z.object({
  body: z.object({}).strict(),
  params: z.object({ playerId: playerCode }).strict(),
  query: paginationQuerySchema
    .extend({
      limit: z.coerce.number().int().min(1).max(100).default(20),
      status: z.enum(["awarded", "expired", "superseded", "revoked"]).optional(),
    })
    .strict(),
});

export const listTitleDefinitionsSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: paginationQuerySchema
    .extend({
      limit: z.coerce.number().int().min(1).max(100).default(20),
      code: titleCode.optional(),
      active: z
        .enum(["true", "false"])
        .optional()
        .transform((value) => (value === undefined ? undefined : value === "true")),
    })
    .strict(),
});

export const createTitleDefinitionSchema = z.object({
  body: z
    .object({
      code: titleCode,
      version: titleVersion,
      ...definitionFields,
      reason: z.string().trim().min(5).max(1000),
    })
    .strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});

export const createTitleRevisionSchema = z.object({
  body: z
    .object({
      version: titleVersion,
      name: definitionFields.name.optional(),
      description: definitionFields.description.optional(),
      icon: definitionFields.icon,
      periodType: definitionFields.periodType.optional(),
      minimumMatches: definitionFields.minimumMatches.optional(),
      priority: definitionFields.priority.optional(),
      rules: definitionFields.rules.optional(),
      durationDays: definitionFields.durationDays.optional(),
      reason: z.string().trim().min(5).max(1000),
    })
    .strict(),
  params: z.object({ titleId: objectId }).strict(),
  query: z.object({}).strict(),
});

export const changeTitleStatusSchema = z.object({
  body: z.object({ reason: z.string().trim().min(5).max(1000) }).strict(),
  params: z.object({ titleId: objectId }).strict(),
  query: z.object({}).strict(),
});

export const recalculateTitlesSchema = z.object({
  body: z
    .object({
      date: isoDate,
      seasonId: objectId.optional(),
      codes: z.array(titleCode).min(1).max(20).optional(),
      reason: z.string().trim().min(5).max(1000),
    })
    .strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});
