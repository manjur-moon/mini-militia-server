import { paginationQuerySchema } from "@mini-militia/shared";
import { z } from "zod";

const playerCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^MM\d{3,}$/, "Player ID must use the MM001 format.");
const objectId = z.string().regex(/^[a-f\d]{24}$/i, "A valid MongoDB ID is required.");
const date = z
  .string()
  .trim()
  .optional()
  .refine((value) => value === undefined || !Number.isNaN(Date.parse(value)), {
    message: "A valid ISO date is required.",
  });

const periodQuery = {
  periodType: z.enum(["weekly", "monthly", "season", "all_time"]).default("all_time"),
  date,
  seasonId: objectId.optional(),
};

function ensureSeasonId(value, context) {
  if (value.periodType === "season" && !value.seasonId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["seasonId"],
      message: "Season ID is required for season rivalry analytics.",
    });
  }
}

export const listPlayerRivalriesSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({ playerId: playerCode }).strict(),
  query: paginationQuerySchema
    .extend({
      limit: z.coerce.number().int().min(1).max(50).default(10),
      ...periodQuery,
    })
    .strict()
    .superRefine(ensureSeasonId),
});

export const getRivalryComparisonSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({ playerId: playerCode, opponentId: playerCode }).strict(),
  query: z.object(periodQuery).strict().superRefine(ensureSeasonId),
});

export const getRivalryMatchesSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({ playerId: playerCode, opponentId: playerCode }).strict(),
  query: paginationQuerySchema
    .extend({
      limit: z.coerce.number().int().min(1).max(50).default(10),
      ...periodQuery,
    })
    .strict()
    .superRefine(ensureSeasonId),
});

export const getRivalOfWeekSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z.object({ date }).strict(),
});

export const recalculateRivalriesSchema = z.object({
  body: z
    .object({
      playerId: playerCode.optional(),
      periodTypes: z
        .array(z.enum(["weekly", "monthly", "season", "all_time"]))
        .min(1)
        .max(4)
        .optional(),
      date,
      seasonId: objectId.optional(),
      reason: z.string().trim().min(5).max(1000),
    })
    .strict()
    .superRefine((value, context) => {
      if (value.periodTypes?.includes("season") && !value.seasonId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["seasonId"],
          message: "Season ID is required when recalculating season rivalries.",
        });
      }
    }),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});
