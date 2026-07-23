import { paginationQuerySchema } from "@mini-militia/shared";
import { z } from "zod";

const isoDate = z
  .string()
  .trim()
  .optional()
  .refine((value) => value === undefined || !Number.isNaN(Date.parse(value)), {
    message: "A valid ISO date is required.",
  });
const objectId = z.string().regex(/^[a-f\d]{24}$/i, "A valid MongoDB ID is required.");
const playerCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^MM\d{3,}$/, "Player ID must use the MM001 format.");
const periodType = z.enum(["weekly", "monthly", "season", "all_time"]);

export const leaderboardSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: paginationQuerySchema
    .extend({
      limit: z.coerce.number().int().min(1).max(100).default(10),
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
      periodType: periodType.default("weekly"),
      date: isoDate,
      seasonId: objectId.optional(),
    })
    .strict(),
});

export const periodAnalyticsSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({ periodType: z.enum(["weekly", "monthly"]) }).strict(),
  query: z
    .object({
      date: isoDate,
    })
    .strict(),
});

export const globalAnalyticsSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});

export const mostImprovedSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z
    .object({
      periodType: z.enum(["weekly", "monthly"]).default("weekly"),
      date: isoDate,
      limit: z.coerce.number().int().min(1).max(50).default(10),
    })
    .strict(),
});

export const playerPerformanceSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({ playerId: playerCode }).strict(),
  query: z
    .object({
      range: z.enum(["7d", "30d"]).default("30d"),
      date: isoDate,
    })
    .strict(),
});

export const playerAdvancedAnalyticsSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({ playerId: playerCode }).strict(),
  query: z.object({}).strict(),
});

export const recalculateAnalyticsSchema = z.object({
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
