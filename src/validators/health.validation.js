import { z } from "zod";

export const healthRequestSchema = z.object({
  body: z.object({}).passthrough().default({}),
  params: z.object({}).passthrough().default({}),
  query: z
    .object({
      verbose: z
        .enum(["true", "false"])
        .optional()
        .transform((value) => value === "true"),
    })
    .strict()
    .default({}),
});
