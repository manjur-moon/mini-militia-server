import { paginationQuerySchema } from "@mini-militia/shared";
import { z } from "zod";

const playerCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^MM\d{3,}$/, "Player ID must use the MM001 format.");
const objectId = z.string().regex(/^[a-f\d]{24}$/i, "A valid MongoDB ID is required.");
const isoDate = z
  .string()
  .trim()
  .optional()
  .refine((value) => value === undefined || !Number.isNaN(Date.parse(value)), {
    message: "A valid ISO date is required.",
  });
const emptyBody = z.object({}).strict();
const emptyParams = z.object({}).strict();

export const aiStatusSchema = z.object({
  body: emptyBody,
  params: emptyParams,
  query: z.object({}).strict(),
});

export const periodSummarySchema = z.object({
  body: emptyBody,
  params: z.object({ periodType: z.enum(["weekly", "monthly"]) }).strict(),
  query: z.object({ date: isoDate }).strict(),
});

export const periodHighlightSchema = z.object({
  body: emptyBody,
  params: z.object({ periodType: z.enum(["weekly", "monthly"]) }).strict(),
  query: z.object({ date: isoDate }).strict(),
});

export const playerInsightSchema = z.object({
  body: emptyBody,
  params: z.object({ playerId: playerCode }).strict(),
  query: z.object({ range: z.enum(["7d", "30d"]).default("30d") }).strict(),
});

export const matchInsightSchema = z.object({
  body: emptyBody,
  params: z.object({ matchId: objectId }).strict(),
  query: z.object({}).strict(),
});

export const listAISummariesSchema = z.object({
  body: emptyBody,
  params: emptyParams,
  query: paginationQuerySchema
    .extend({
      limit: z.coerce.number().int().min(1).max(100).default(20),
      type: z
        .enum(["weekly", "monthly", "player_performance", "match_insight", "highlight"])
        .optional(),
      status: z.enum(["generated", "fallback_generated", "failed"]).optional(),
      provider: z.string().trim().min(1).max(50).optional(),
      playerId: playerCode.optional(),
    })
    .strict(),
});

export const regenerateAIInsightSchema = z
  .object({
    body: z
      .object({
        type: z.enum([
          "weekly",
          "monthly",
          "player_performance",
          "match_insight",
          "highlight",
        ]),
        periodType: z.enum(["weekly", "monthly"]).optional(),
        date: isoDate,
        playerId: playerCode.optional(),
        matchId: objectId.optional(),
        range: z.enum(["7d", "30d"]).default("30d"),
        reason: z.string().trim().min(5).max(1000),
      })
      .strict(),
    params: emptyParams,
    query: z.object({}).strict(),
  })
  .superRefine((value, context) => {
    const body = value.body;
    if (body.type === "highlight" && !body.periodType) {
      context.addIssue({
        code: "custom",
        path: ["body", "periodType"],
        message: "periodType is required for highlight regeneration.",
      });
    }
    if (body.type === "player_performance" && !body.playerId) {
      context.addIssue({
        code: "custom",
        path: ["body", "playerId"],
        message: "playerId is required for player-performance regeneration.",
      });
    }
    if (body.type === "match_insight" && !body.matchId) {
      context.addIssue({
        code: "custom",
        path: ["body", "matchId"],
        message: "matchId is required for match-insight regeneration.",
      });
    }
  });
