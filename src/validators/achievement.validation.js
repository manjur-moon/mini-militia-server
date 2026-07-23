import { paginationQuerySchema } from "@mini-militia/shared";
import { z } from "zod";
import { METRIC_KEYS } from "../constants/domain.constants.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "A valid MongoDB ID is required.");
const playerCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^MM\d{3,}$/, "Player ID must use the MM001 format.");
const achievementCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[A-Z0-9_]+$/,
    "Achievement code may contain uppercase letters, numbers and underscores.",
  );
const achievementVersion = z
  .string()
  .trim()
  .min(2)
  .max(50)
  .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/i);
const finiteNumber = z.number().refine(Number.isFinite, {
  message: "A finite number is required.",
});
const isoDate = z
  .string()
  .trim()
  .optional()
  .refine((value) => value === undefined || !Number.isNaN(Date.parse(value)), {
    message: "A valid ISO date is required.",
  });

const condition = z
  .object({
    metric: z.enum(METRIC_KEYS),
    operator: z.enum(["eq", "gte", "lte", "gt", "lt"]),
    value: finiteNumber,
  })
  .strict();
const criteria = z
  .object({
    combinator: z.enum(["all", "any"]),
    conditions: z.array(condition).min(1).max(10),
  })
  .strict();

const definitionFields = {
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().min(5).max(500),
  icon: z.string().trim().min(1).max(64),
  category: z.string().trim().min(2).max(80),
  periodType: z.enum(["weekly", "monthly", "season", "all_time"]),
  minimumMatches: z.number().int().min(0).max(10000),
  criteria,
  progressMetric: z.enum(METRIC_KEYS),
  targetValue: finiteNumber.refine((value) => value > 0, {
    message: "Target value must be greater than zero.",
  }),
};

function ensureProgressMetricInCriteria(value, context) {
  if (
    value.progressMetric &&
    value.criteria &&
    !value.criteria.conditions.some(
      (conditionItem) => conditionItem.metric === value.progressMetric,
    )
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["progressMetric"],
      message: "Progress metric must appear in the achievement criteria.",
    });
  }
}

export const listPublicAchievementsSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z.object({ category: z.string().trim().min(2).max(80).optional() }).strict(),
});

export const getPublicAchievementSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({ code: achievementCode }).strict(),
  query: z.object({}).strict(),
});

export const getPlayerAchievementsSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({ playerId: playerCode }).strict(),
  query: z
    .object({
      unlocked: z
        .enum(["true", "false"])
        .optional()
        .transform((value) => (value === undefined ? undefined : value === "true")),
      category: z.string().trim().min(2).max(80).optional(),
    })
    .strict(),
});

export const listAchievementDefinitionsSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: paginationQuerySchema
    .extend({
      limit: z.coerce.number().int().min(1).max(100).default(20),
      code: achievementCode.optional(),
      active: z
        .enum(["true", "false"])
        .optional()
        .transform((value) => (value === undefined ? undefined : value === "true")),
    })
    .strict(),
});

export const createAchievementDefinitionSchema = z.object({
  body: z
    .object({
      code: achievementCode,
      version: achievementVersion,
      ...definitionFields,
      reason: z.string().trim().min(5).max(1000),
    })
    .strict()
    .superRefine(ensureProgressMetricInCriteria),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});

export const createAchievementRevisionSchema = z.object({
  body: z
    .object({
      version: achievementVersion,
      name: definitionFields.name.optional(),
      description: definitionFields.description.optional(),
      icon: definitionFields.icon.optional(),
      category: definitionFields.category.optional(),
      periodType: definitionFields.periodType.optional(),
      minimumMatches: definitionFields.minimumMatches.optional(),
      criteria: definitionFields.criteria.optional(),
      progressMetric: definitionFields.progressMetric.optional(),
      targetValue: definitionFields.targetValue.optional(),
      reason: z.string().trim().min(5).max(1000),
    })
    .strict()
    .superRefine((value, context) => {
      if (value.progressMetric && value.criteria) {
        ensureProgressMetricInCriteria(value, context);
      }
    }),
  params: z.object({ achievementId: objectId }).strict(),
  query: z.object({}).strict(),
});

export const changeAchievementStatusSchema = z.object({
  body: z.object({ reason: z.string().trim().min(5).max(1000) }).strict(),
  params: z.object({ achievementId: objectId }).strict(),
  query: z.object({}).strict(),
});

export const recalculateAchievementsSchema = z.object({
  body: z
    .object({
      playerId: playerCode.optional(),
      date: isoDate,
      seasonId: objectId.optional(),
      codes: z.array(achievementCode).min(1).max(50).optional(),
      reason: z.string().trim().min(5).max(1000),
    })
    .strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});
