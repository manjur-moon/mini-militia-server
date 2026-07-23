import { paginationQuerySchema } from "@mini-militia/shared";
import { z } from "zod";

const playerId = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^MM\d{3,}$/, "Player ID must use the MM001 format.");
const objectId = z.string().regex(/^[a-f\d]{24}$/i, "A valid MongoDB ID is required.");
const optionalDate = z
  .string()
  .optional()
  .refine((value) => value === undefined || !Number.isNaN(Date.parse(value)), {
    message: "A valid ISO date is required.",
  });

export const playerMatchesSchema = z
  .object({
    body: z.object({}).strict(),
    params: z.object({ playerId }).strict(),
    query: paginationQuerySchema
      .extend({
        limit: z.coerce.number().int().min(1).max(50).default(10),
        from: optionalDate,
        to: optionalDate,
        seasonId: objectId.optional(),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
      })
      .strict(),
  })
  .superRefine((value, context) => {
    if (value.query.from && value.query.to) {
      const from = new Date(value.query.from);
      const to = new Date(value.query.to);
      if (from > to) {
        context.addIssue({
          code: "custom",
          path: ["query", "to"],
          message: "to must be on or after from.",
        });
      }
      if (to - from > 366 * 24 * 60 * 60 * 1000) {
        context.addIssue({
          code: "custom",
          path: ["query", "to"],
          message: "Public match-history ranges cannot exceed 366 days.",
        });
      }
    }
  });

export const playerStatisticsSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({ playerId }).strict(),
  query: z.object({}).strict(),
});

export const linkedPlayerMatchesSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: paginationQuerySchema
    .extend({
      limit: z.coerce.number().int().min(1).max(50).default(10),
      from: optionalDate,
      to: optionalDate,
      seasonId: objectId.optional(),
      sortOrder: z.enum(["asc", "desc"]).default("desc"),
    })
    .strict(),
});

export const linkedPlayerProfileSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});
