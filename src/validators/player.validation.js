import { paginationQuerySchema } from "@mini-militia/shared";
import { z } from "zod";

const playerId = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^MM\d{3,}$/, "Player ID must use the MM001 format.");

const playerName = z.string().trim().min(2).max(80);
const aliases = z
  .array(z.string().trim().min(2).max(80))
  .max(10)
  .default([])
  .transform((values) => [...new Set(values.map((value) => value.toLowerCase()))]);
const dateString = z.iso.datetime({ offset: true });
const optionalDateQuery = z
  .string()
  .trim()
  .optional()
  .refine((value) => value === undefined || !Number.isNaN(Date.parse(value)), {
    message: "Date must be a valid ISO date.",
  });

export const listPlayersSchema = z
  .object({
    body: z.object({}).strict(),
    params: z.object({}).strict(),
    query: paginationQuerySchema
      .extend({
        limit: z
          .union([z.string(), z.number()])
          .optional()
          .transform((value) => (value === undefined ? 12 : Number(value)))
          .pipe(z.number().int().min(1).max(50)),
        search: z.string().trim().max(80).optional(),
        status: z.enum(["active", "inactive"]).default("active"),
        joinedFrom: optionalDateQuery,
        joinedTo: optionalDateQuery,
        sortBy: z
          .enum(["playerId", "name", "joinDate", "createdAt"])
          .default("createdAt"),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
      })
      .strict(),
  })
  .superRefine((value, context) => {
    const { joinedFrom, joinedTo } = value.query;
    if (joinedFrom && joinedTo && new Date(joinedFrom) > new Date(joinedTo)) {
      context.addIssue({
        code: "custom",
        path: ["query", "joinedTo"],
        message: "joinedTo must be on or after joinedFrom.",
      });
    }
  });

export const createPlayerSchema = z.object({
  body: z
    .object({
      name: playerName,
      aliases,
      joinDate: dateString,
      status: z.enum(["active", "inactive"]).default("active"),
    })
    .strict(),
  params: z.object({}).strict(),
  query: z.object({}).strict(),
});

export const playerIdSchema = z.object({
  body: z.object({}).strict(),
  params: z.object({ playerId }).strict(),
  query: z.object({}).strict(),
});

export const updatePlayerSchema = z.object({
  body: z
    .object({
      name: playerName.optional(),
      aliases: aliases.optional(),
      joinDate: dateString.optional(),
      expectedUpdatedAt: dateString.optional(),
      reason: z.string().trim().min(3).max(500).default("Player profile update"),
    })
    .strict()
    .refine(
      (value) =>
        value.name !== undefined ||
        value.aliases !== undefined ||
        value.joinDate !== undefined,
      { message: "Provide at least one editable player field." },
    ),
  params: z.object({ playerId }).strict(),
  query: z.object({}).strict(),
});

export const updatePlayerStatusSchema = z.object({
  body: z
    .object({
      status: z.enum(["active", "inactive"]),
      reason: z.string().trim().min(3).max(500),
    })
    .strict(),
  params: z.object({ playerId }).strict(),
  query: z.object({}).strict(),
});

export const playerPhotoParamsSchema = z.object({
  body: z.unknown(),
  params: z.object({ playerId }).strict(),
  query: z.object({}).strict(),
});

export const deletePlayerPhotoSchema = z.object({
  body: z
    .object({
      reason: z.string().trim().min(3).max(500).default("Player photo removed"),
    })
    .strict(),
  params: z.object({ playerId }).strict(),
  query: z.object({}).strict(),
});
