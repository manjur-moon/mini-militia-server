import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "A valid MongoDB ID is required.");

export const statisticsOverviewSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});

export const recalculateStatisticsSchema = z.object({
  body: z
    .object({
      scope: z.enum(["all", "player", "match"]),
      playerId: objectId.optional(),
      matchId: objectId.optional(),
      reason: z.string().trim().min(5).max(1000),
    })
    .strict()
    .superRefine((value, context) => {
      if (value.scope === "player" && !value.playerId) {
        context.addIssue({
          code: "custom",
          path: ["playerId"],
          message: "playerId is required for player scope.",
        });
      }
      if (value.scope === "match" && !value.matchId) {
        context.addIssue({
          code: "custom",
          path: ["matchId"],
          message: "matchId is required for match scope.",
        });
      }
    }),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});
