import { paginationQuerySchema } from "@mini-militia/shared";
import { z } from "zod";
import { HALL_OF_FAME_CATEGORIES } from "../constants/domain.constants.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "A valid MongoDB ID is required.");
const playerCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^MM\d{3,}$/, "Player ID must use the MM001 format.");
const category = z.enum(HALL_OF_FAME_CATEGORIES);
const recordStatus = z.enum(["current", "historical", "all"]);
const auditReason = z.string().trim().min(5).max(1000);

const listQuery = paginationQuerySchema
  .extend({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    category: category.optional(),
    status: recordStatus.default("current"),
    seasonId: objectId.optional(),
  })
  .strict();

export const listHallOfFameSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: listQuery,
});

export const getHallOfFameCategorySchema = z.object({
  body: z.object({}).strict(),
  params: z.object({ category }).strict(),
  query: paginationQuerySchema
    .extend({
      limit: z.coerce.number().int().min(1).max(100).default(20),
      status: recordStatus.default("current"),
      seasonId: objectId.optional(),
    })
    .strict(),
});

export const getPlayerHallOfFameSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({ playerId: playerCode }).strict(),
  query: paginationQuerySchema
    .extend({
      limit: z.coerce.number().int().min(1).max(100).default(20),
      status: recordStatus.default("all"),
      category: category.optional(),
    })
    .strict(),
});

export const recalculateHallOfFameSchema = z.object({
  body: z
    .object({
      category: category.optional(),
      seasonId: objectId.optional(),
      reason: auditReason,
    })
    .strict()
    .superRefine((value, context) => {
      if (value.category === "season_champion" && !value.seasonId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["seasonId"],
          message: "seasonId is required for season champion recalculation.",
        });
      }
      if (value.seasonId && value.category && value.category !== "season_champion") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["seasonId"],
          message: "seasonId may be used only with the season_champion category.",
        });
      }
    }),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});
