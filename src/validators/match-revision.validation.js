import { paginationQuerySchema } from "@mini-militia/shared";
import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "A valid MongoDB ID is required.");
const dateTime = z
  .string()
  .refine(
    (value) => !Number.isNaN(Date.parse(value)),
    "A valid ISO date-time is required.",
  );
const revisionNumber = z.coerce.number().int().min(1);
const reason = z.string().trim().min(5).max(1000);

export const listMatchRevisionsSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({ matchId: objectId }).strict(),
  query: paginationQuerySchema
    .extend({
      limit: z.coerce.number().int().min(1).max(50).default(10),
      status: z.enum(["proposed", "approved", "rejected"]).optional(),
    })
    .strict(),
});

const proposedResult = z
  .object({
    resultId: objectId,
    playerId: objectId,
    kills: z.number().int().min(0).max(9999),
    deaths: z.number().int().min(0).max(9999),
    placement: z.number().int().min(1).max(50),
  })
  .strict();

export const proposeMatchRevisionSchema = z.object({
  body: z
    .object({
      reason,
      expectedRevision: z.number().int().min(1),
      matchChanges: z
        .object({
          matchDate: dateTime.optional(),
          timezone: z.string().trim().min(1).max(100).optional(),
          seasonId: z.union([objectId, z.literal(""), z.null()]).optional(),
          participantCount: z.number().int().min(2).max(50).optional(),
        })
        .strict()
        .optional(),
      results: z.array(proposedResult).min(2).max(50),
    })
    .strict(),
  params: z.object({ matchId: objectId }).strict(),
  query: z.object({}).strict(),
});

export const matchRevisionIdSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({ matchId: objectId, revisionNumber }).strict(),
  query: z.object({}).strict(),
});

export const approveMatchRevisionSchema = z.object({
  body: z
    .object({
      expectedMatchRevision: z.number().int().min(1),
      approvalReason: z.string().trim().min(3).max(1000).optional(),
    })
    .strict(),
  params: z.object({ matchId: objectId, revisionNumber }).strict(),
  query: z.object({}).strict(),
});

export const rejectMatchRevisionSchema = z.object({
  body: z.object({ reason }).strict(),
  params: z.object({ matchId: objectId, revisionNumber }).strict(),
  query: z.object({}).strict(),
});
