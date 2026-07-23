import { paginationQuerySchema } from "@mini-militia/shared";
import { z } from "zod";

const periodType = z.enum(["weekly", "monthly", "season", "all_time"]);
const objectId = z.string().regex(/^[a-f\d]{24}$/i, "A valid MongoDB ID is required.");
const playerCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^MM\d{3,}$/, "Player ID must use the MM001 format.");
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

const metricDefinition = z
  .object({
    metric: z.string().trim().min(2).max(100),
    method: z.enum(["min_max", "percentile", "target", "inverse_target"]),
    minimum: finiteNumber.nullable().optional(),
    maximum: finiteNumber.nullable().optional(),
    target: finiteNumber.positive().nullable().optional(),
    weight: finiteNumber.min(0).max(1),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.method === "min_max" &&
      (!Number.isFinite(value.minimum) ||
        !Number.isFinite(value.maximum) ||
        value.maximum <= value.minimum)
    ) {
      context.addIssue({
        code: "custom",
        message: "min_max requires maximum to be greater than minimum.",
      });
    }
    if (
      ["target", "inverse_target"].includes(value.method) &&
      (!Number.isFinite(value.target) || value.target <= 0)
    ) {
      context.addIssue({
        code: "custom",
        message: "target and inverse_target require a positive target.",
      });
    }
  });

const componentDefinition = z
  .object({
    component: z.enum(["attack", "survival", "consistency", "activity"]),
    metrics: z.array(metricDefinition).min(1).max(10),
  })
  .strict();

const periodQuery = z
  .object({
    periodType: periodType.default("all_time"),
    date: isoDate,
    seasonId: objectId.optional(),
  })
  .strict();

export const ratingLeaderboardSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: paginationQuerySchema
    .extend({
      limit: z.coerce.number().int().min(1).max(100).default(20),
      periodType: periodType.default("all_time"),
      date: isoDate,
      seasonId: objectId.optional(),
      includeProvisional: z
        .enum(["true", "false"])
        .optional()
        .transform((value) => value === "true"),
    })
    .strict(),
});

export const playerRatingSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({ playerId: playerCode }).strict(),
  query: periodQuery,
});

export const playerRatingHistorySchema = z.object({
  body: z.object({}).strict(),
  params: z.object({ playerId: playerCode }).strict(),
  query: paginationQuerySchema
    .extend({
      limit: z.coerce.number().int().min(1).max(100).default(20),
      periodType: periodType.optional(),
    })
    .strict(),
});

const createRatingConfigBody = z
  .object({
    version: z
      .string()
      .trim()
      .min(3)
      .max(50)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: z.string().trim().min(3).max(100),
    description: z.string().trim().max(1000).default(""),
    minimumMatches: z.number().int().min(1).max(100),
    newPlayerConfidenceFloor: finiteNumber.min(0).max(1),
    components: z.array(componentDefinition).length(4),
    overallWeights: z
      .object({
        attack: finiteNumber.min(0).max(1),
        survival: finiteNumber.min(0).max(1),
        consistency: finiteNumber.min(0).max(1),
        activity: finiteNumber.min(0).max(1),
      })
      .strict(),
    effectiveFrom: isoDate,
    reason: z.string().trim().min(5).max(1000),
  })
  .strict()
  .superRefine((value, context) => {
    const requiredComponents = new Set([
      "attack",
      "survival",
      "consistency",
      "activity",
    ]);
    const suppliedComponents = value.components.map((item) => item.component);
    if (
      new Set(suppliedComponents).size !== 4 ||
      suppliedComponents.some((component) => !requiredComponents.has(component))
    ) {
      context.addIssue({
        code: "custom",
        path: ["components"],
        message: "Each required rating component must be defined exactly once.",
      });
    }

    for (const [componentIndex, component] of value.components.entries()) {
      const total = component.metrics.reduce((sum, metric) => sum + metric.weight, 0);
      if (Math.abs(total - 1) > 0.000001) {
        context.addIssue({
          code: "custom",
          path: ["components", componentIndex, "metrics"],
          message: `Metric weights for ${component.component} must total 1.`,
        });
      }
    }

    const overallTotal = Object.values(value.overallWeights).reduce(
      (sum, weight) => sum + weight,
      0,
    );
    if (Math.abs(overallTotal - 1) > 0.000001) {
      context.addIssue({
        code: "custom",
        path: ["overallWeights"],
        message: "Overall rating weights must total 1.",
      });
    }
  });

export const createRatingConfigSchema = z.object({
  body: createRatingConfigBody,
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});

export const activateRatingConfigSchema = z.object({
  body: z.object({ reason: z.string().trim().min(5).max(1000) }).strict(),
  params: z
    .object({
      configId: z
        .string()
        .trim()
        .min(3)
        .max(50)
        .refine(
          (value) =>
            /^[a-f\d]{24}$/i.test(value) || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
          { message: "A valid config ID or version is required." },
        ),
    })
    .strict(),
  query: z.object({}).strict(),
});

export const listRatingConfigsSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: paginationQuerySchema
    .extend({
      limit: z.coerce.number().int().min(1).max(50).default(20),
      active: z
        .enum(["true", "false"])
        .optional()
        .transform((value) => (value === undefined ? undefined : value === "true")),
    })
    .strict(),
});

export const recalculateRatingSchema = z.object({
  body: z
    .object({
      periodType,
      date: isoDate,
      seasonId: objectId.optional(),
      reason: z.string().trim().min(5).max(1000),
    })
    .strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});

export const emptyRatingConfigSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});
