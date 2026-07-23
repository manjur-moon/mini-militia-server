import { z } from "zod";

const playerId = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^MM\d{3,}$/, "Player ID must use the MM001 format.");

const achievementCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9_]{2,80}$/, "Achievement code is invalid.");

const optionalDate = z
  .string()
  .trim()
  .optional()
  .refine((value) => value === undefined || !Number.isNaN(Date.parse(value)), {
    message: "Date must be a valid ISO date.",
  });

const emptyBody = z.object({}).strict();
const emptyQuery = z.object({}).strict();

export const playerProfileShareSchema = z.object({
  body: emptyBody,
  params: z.object({ playerId }).strict(),
  query: emptyQuery,
});

export const achievementShareSchema = z.object({
  body: emptyBody,
  params: z.object({ playerId, achievementCode }).strict(),
  query: emptyQuery,
});

export const weeklyMvpShareSchema = z.object({
  body: emptyBody,
  params: z.object({}).strict(),
  query: z.object({ date: optionalDate }).strict(),
});
