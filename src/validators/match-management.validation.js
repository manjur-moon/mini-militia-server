import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "A valid MongoDB ID is required.");
const dateTime = z
  .string()
  .refine(
    (value) => !Number.isNaN(Date.parse(value)),
    "A valid ISO date-time is required.",
  );
const timezone = z.string().trim().min(1).max(100);
const reason = z.string().trim().min(3).max(1000);

const resultInput = z
  .object({
    playerId: objectId,
    kills: z.number().int().min(0).max(9999),
    deaths: z.number().int().min(0).max(9999),
    placement: z.number().int().min(1).max(50),
    reason: reason.optional(),
  })
  .strict();

export const updateMatchMetadataSchema = z.object({
  body: z
    .object({
      matchDate: dateTime.optional(),
      timezone: timezone.optional(),
      seasonId: z.union([objectId, z.literal(""), z.null()]).optional(),
      participantCount: z.number().int().min(2).max(50).optional(),
      duplicateReviewNote: z.string().trim().max(500).optional(),
      expectedUpdatedAt: dateTime.optional(),
      reason,
    })
    .strict()
    .refine(
      (value) =>
        value.matchDate !== undefined ||
        value.timezone !== undefined ||
        value.seasonId !== undefined ||
        value.participantCount !== undefined ||
        value.duplicateReviewNote !== undefined,
      { message: "Provide at least one editable match field." },
    ),
  params: z.object({ matchId: objectId }).strict(),
  query: z.object({}).strict(),
});

export const addMatchResultSchema = z.object({
  body: resultInput,
  params: z.object({ matchId: objectId }).strict(),
  query: z.object({}).strict(),
});

export const updateMatchResultSchema = z.object({
  body: resultInput,
  params: z.object({ matchId: objectId, resultId: objectId }).strict(),
  query: z.object({}).strict(),
});

export const removeMatchResultSchema = z.object({
  body: z.object({ reason }).strict(),
  params: z.object({ matchId: objectId, resultId: objectId }).strict(),
  query: z.object({}).strict(),
});
