import { DEFAULT_PAGINATION, USER_ROLES, USER_STATUSES } from "@mini-militia/shared";
import { z } from "zod";

const emptyObject = z.object({}).strict();
const userId = z.string().trim().min(1).max(128);
const reason = z.string().trim().min(3).max(500);
const queryInteger = (fallback) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => (value === undefined ? fallback : Number(value)))
    .pipe(z.number().int().positive());

export const listUsersSchema = z.object({
  body: emptyObject,
  params: emptyObject,
  query: z
    .object({
      page: queryInteger(DEFAULT_PAGINATION.PAGE),
      limit: queryInteger(DEFAULT_PAGINATION.LIMIT).pipe(
        z.number().max(DEFAULT_PAGINATION.MAX_LIMIT),
      ),
      search: z.string().trim().max(100).optional(),
      role: z.enum(Object.values(USER_ROLES)).optional(),
      status: z.enum(Object.values(USER_STATUSES)).optional(),
      linked: z.enum(["true", "false"]).optional(),
      sortBy: z
        .enum(["createdAt", "updatedAt", "name", "email", "role", "status"])
        .default("createdAt"),
      sortOrder: z.enum(["asc", "desc"]).default("desc"),
    })
    .strict(),
});

export const userIdSchema = z.object({
  body: emptyObject,
  params: z.object({ userId }),
  query: emptyObject,
});

export const updateRoleSchema = z.object({
  body: z.object({ role: z.enum(Object.values(USER_ROLES)), reason }).strict(),
  params: z.object({ userId }),
  query: emptyObject,
});

export const updateStatusSchema = z.object({
  body: z.object({ status: z.enum(Object.values(USER_STATUSES)), reason }).strict(),
  params: z.object({ userId }),
  query: emptyObject,
});

export const linkPlayerSchema = z.object({
  body: z.object({ playerId: z.string().trim().min(1).max(64), reason }).strict(),
  params: z.object({ userId }),
  query: emptyObject,
});

export const unlinkPlayerSchema = z.object({
  body: z.object({ reason }).strict(),
  params: z.object({ userId }),
  query: emptyObject,
});
