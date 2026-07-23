import { z } from "zod";

const playerCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^MM\d{3,}$/, "Player ID must use the MM001 format.");
const objectId = z.string().regex(/^[a-f\d]{24}$/i, "A valid MongoDB ID is required.");
const optionalDate = z
  .string()
  .trim()
  .optional()
  .refine((value) => value === undefined || !Number.isNaN(Date.parse(value)), {
    message: "A valid ISO date is required.",
  });

export const playerCardSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({ playerId: playerCode }).strict(),
  query: z
    .object({
      periodType: z
        .enum(["weekly", "monthly", "season", "all_time"])
        .default("all_time"),
      date: optionalDate,
      seasonId: objectId.optional(),
    })
    .strict(),
});
