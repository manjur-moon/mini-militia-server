import { paginationQuerySchema } from "@mini-militia/shared";
import { z } from "zod";

const awardType = z.enum(["weekly", "monthly", "season", "all_time"]);
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
const weights = z
  .object({
    killWeight: z.number().min(0).max(100),
    deathPenalty: z.number().min(0).max(100),
    firstPlaceBonus: z.number().min(0).max(1000),
    secondPlaceBonus: z.number().min(0).max(1000),
    thirdPlaceBonus: z.number().min(0).max(1000),
    kdrBonusWeight: z.number().min(0).max(100),
    maximumKdrBonus: z.number().min(0).max(1000),
    activityWeight: z.number().min(0).max(100),
    maximumActivityBonus: z.number().min(0).max(1000),
  })
  .strict();

export const currentMvpSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z
    .object({
      awardType: awardType.default("weekly"),
      date: isoDate,
      seasonId: objectId.optional(),
    })
    .strict(),
});

export const listMvpAwardsSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: paginationQuerySchema
    .extend({
      limit: z.coerce.number().int().min(1).max(100).default(10),
      awardType: awardType.optional(),
      playerId: playerCode.optional(),
      status: z.enum(["current", "superseded"]).optional(),
    })
    .strict(),
});

export const createMvpConfigSchema = z.object({
  body: z
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
      weights,
      effectiveFrom: isoDate,
      reason: z.string().trim().min(5).max(1000),
    })
    .strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});

export const activateMvpConfigSchema = z.object({
  body: z.object({ reason: z.string().trim().min(5).max(1000) }).strict(),
  params: z.object({ configId: objectId }).strict(),
  query: z.object({}).strict(),
});

export const recalculateMvpSchema = z.object({
  body: z
    .object({
      awardType,
      date: isoDate,
      seasonId: objectId.optional(),
      reason: z.string().trim().min(5).max(1000),
    })
    .strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});

export const emptyMvpConfigSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});
