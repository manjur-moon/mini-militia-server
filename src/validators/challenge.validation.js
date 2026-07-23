import { paginationQuerySchema } from "@mini-militia/shared";
import { z } from "zod";
import { METRIC_KEYS } from "../constants/domain.constants.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "A valid MongoDB ID is required.");
const challengeIdentifier = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .transform((value) => (/^[a-f\d]{24}$/i.test(value) ? value : value.toUpperCase()));
const challengeCode = z
  .string()
  .trim()
  .toUpperCase()
  .min(3)
  .max(120)
  .regex(
    /^[A-Z0-9_]+$/,
    "Challenge code may contain only uppercase letters, numbers, and underscores.",
  );
const playerCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^MM\d{3,}$/, "Player ID must use the MM001 format.");
const isoDate = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), "A valid ISO date is required.")
  .transform((value) => new Date(value));
const finiteNumber = z.number().finite();
const auditReason = z.string().trim().min(5).max(1000);

const ruleCondition = z
  .object({
    metric: z.enum(METRIC_KEYS),
    operator: z.enum(["eq", "gte", "lte", "gt", "lt"]),
    value: finiteNumber,
  })
  .strict();

const ruleSet = z
  .object({
    combinator: z.enum(["all", "any"]).default("all"),
    conditions: z.array(ruleCondition).min(1).max(10),
  })
  .strict();

const reward = z
  .object({
    name: z.string().trim().min(2).max(100),
    badgeIcon: z.string().trim().min(1).max(64).default("🎯"),
    description: z.string().trim().max(300).default(""),
  })
  .strict();

const challengeFields = {
  code: challengeCode,
  version: z.string().trim().min(1).max(50),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().min(5).max(500),
  icon: z.string().trim().min(1).max(64).default("🎯"),
  type: z.enum(["weekly", "monthly"]),
  status: z.enum(["draft", "upcoming"]).default("draft"),
  startAt: isoDate,
  endAt: isoDate,
  metric: z.enum(METRIC_KEYS),
  targetOperator: z.enum(["gte", "lte", "gt", "lt"]).default("gte"),
  targetValue: finiteNumber.positive(),
  minimumMatches: z.number().int().min(0).max(10000).default(0),
  minimumEligibility: ruleSet.nullable().optional(),
  reward,
  reason: auditReason,
};

function validateDateRange(value, context) {
  if (value.startAt && value.endAt && value.endAt <= value.startAt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endAt"],
      message: "Challenge end date must be later than the start date.",
    });
  }
}

export const listPublicChallengesSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z
    .object({
      type: z.enum(["weekly", "monthly"]).optional(),
      status: z.enum(["upcoming", "active", "completed"]).optional(),
      lifecycle: z.enum(["current", "history", "all"]).default("current"),
    })
    .strict(),
});

export const getChallengeSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({ identifier: challengeIdentifier }).strict(),
  query: z.object({}).strict(),
});

export const getPlayerChallengesSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({ playerId: playerCode }).strict(),
  query: z
    .object({
      type: z.enum(["weekly", "monthly"]).optional(),
      status: z.enum(["in_progress", "completed", "expired"]).optional(),
      lifecycle: z.enum(["current", "history", "all"]).default("all"),
    })
    .strict(),
});

export const listAdminChallengesSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: paginationQuerySchema
    .extend({
      limit: z.coerce.number().int().min(1).max(100).default(20),
      type: z.enum(["weekly", "monthly"]).optional(),
      status: z
        .enum(["draft", "upcoming", "active", "completed", "archived"])
        .optional(),
      search: z.string().trim().max(100).optional(),
    })
    .strict(),
});

export const createChallengeSchema = z.object({
  body: z.object(challengeFields).strict().superRefine(validateDateRange),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});

const updateFields = z
  .object({
    version: challengeFields.version.optional(),
    name: challengeFields.name.optional(),
    description: challengeFields.description.optional(),
    icon: z.string().trim().min(1).max(64).optional(),
    type: challengeFields.type.optional(),
    startAt: isoDate.optional(),
    endAt: isoDate.optional(),
    metric: challengeFields.metric.optional(),
    targetOperator: challengeFields.targetOperator.optional(),
    targetValue: finiteNumber.positive().optional(),
    minimumMatches: z.number().int().min(0).max(10000).optional(),
    minimumEligibility: ruleSet.nullable().optional(),
    reward: reward.optional(),
    reason: auditReason,
  })
  .strict()
  .superRefine((value, context) => {
    if (Object.keys(value).filter((key) => key !== "reason").length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [],
        message: "At least one challenge field must be updated.",
      });
    }
    validateDateRange(value, context);
  });

export const updateChallengeSchema = z.object({
  body: updateFields,
  params: z.object({ challengeId: objectId }).strict(),
  query: z.object({}).strict(),
});

export const changeChallengeStatusSchema = z.object({
  body: z
    .object({
      status: z.enum(["upcoming", "active", "completed", "archived"]),
      reason: auditReason,
    })
    .strict(),
  params: z.object({ challengeId: objectId }).strict(),
  query: z.object({}).strict(),
});

export const recalculateChallengesSchema = z.object({
  body: z
    .object({
      playerId: playerCode.optional(),
      date: isoDate.optional(),
      dates: z.array(isoDate).min(1).max(12).optional(),
      reason: auditReason,
    })
    .strict()
    .superRefine((value, context) => {
      if (value.date && value.dates) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["dates"],
          message: "Use either date or dates, not both.",
        });
      }
    }),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});
