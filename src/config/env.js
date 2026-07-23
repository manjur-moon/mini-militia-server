import "dotenv/config";
import { z } from "zod";


const optionalNonEmptyString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.url().optional(),
);

const booleanString = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(5000),
    MONGODB_URI: z.string().min(1, "MONGODB_URI is required."),
    MONGODB_DB_NAME: z.string().trim().min(1).default("mini_militia_league"),
    CLIENT_ORIGINS: z.string().min(1, "At least one CLIENT_ORIGINS value is required."),
    PUBLIC_APP_URL: optionalUrl,
    PUBLIC_API_URL: optionalUrl,
    BETTER_AUTH_URL: z.url(),
    BETTER_AUTH_SECRET: z
      .string()
      .min(32, "BETTER_AUTH_SECRET must be at least 32 characters."),
    BETTER_AUTH_COOKIE_PREFIX: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9_-]+$/)
      .default("mini_militia"),
    AUTH_COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).optional(),
    AUTH_SESSION_EXPIRES_IN: z.coerce
      .number()
      .int()
      .positive()
      .default(60 * 60 * 24 * 7),
    AUTH_SESSION_UPDATE_AGE: z.coerce
      .number()
      .int()
      .positive()
      .default(60 * 60 * 24),
    AUTH_SESSION_FRESH_AGE: z.coerce
      .number()
      .int()
      .nonnegative()
      .default(60 * 60 * 24),
    TRUST_PROXY: booleanString,
    LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
    JSON_BODY_LIMIT: z.string().default("1mb"),
    API_RATE_LIMIT_WINDOW_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(15 * 60 * 1000),
    API_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(300),
    LEAGUE_TIMEZONE: z.string().min(1).default("Asia/Dhaka"),
    CLOUDINARY_CLOUD_NAME: optionalNonEmptyString,
    CLOUDINARY_API_KEY: optionalNonEmptyString,
    CLOUDINARY_API_SECRET: optionalNonEmptyString,
    CLOUDINARY_PLAYER_FOLDER: z.string().trim().min(1).default("mini-militia/players"),
    CLOUDINARY_MATCH_FOLDER: z.string().trim().min(1).default("mini-militia/matches"),
    MATCH_SCREENSHOT_MAX_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .default(10 * 1024 * 1024),
    OCR_PROVIDER: z
  .enum(["google-vision", "tesseract", "mock", "disabled"])
  .default("disabled"),
    GOOGLE_VISION_API_KEY: optionalNonEmptyString,
    OCR_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
    OCR_LOW_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.75),
    OCR_PARSER_PROFILE: z
      .enum(["mini-militia-final-score-v1", "generic-v1"])
      .default("mini-militia-final-score-v1"),
    OCR_RESULT_COLUMN_ORDER: z.string().trim().default("placement,name,kills,deaths"),
    OCR_CROP_X_RATIO: z.coerce.number().min(0).max(1).default(0.205),
    OCR_CROP_Y_RATIO: z.coerce.number().min(0).max(1).default(0.3),
    OCR_CROP_WIDTH_RATIO: z.coerce.number().gt(0).max(1).default(0.32),
    OCR_CROP_HEIGHT_RATIO: z.coerce.number().gt(0).max(1).default(0.51),
    OCR_UPSCALE_WIDTH: z.coerce.number().int().min(500).max(4000).default(1600),
    OCR_MOCK_TEXT: z.string().default(""),
    AI_PROVIDER: z.enum(["openai", "disabled"]).default("disabled"),
    OPENAI_API_KEY: optionalNonEmptyString,
    OPENAI_MODEL: z.string().trim().min(1).default("gpt-5.6-luna"),
    AI_REQUEST_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(120_000)
      .default(20_000),
    AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(300).max(10_000).default(1_200),
  })
  .superRefine((value, context) => {
    const credentials = [
      value.CLOUDINARY_CLOUD_NAME,
      value.CLOUDINARY_API_KEY,
      value.CLOUDINARY_API_SECRET,
    ];
    const configuredCount = credentials.filter(Boolean).length;
    if (configuredCount > 0 && configuredCount < credentials.length) {
      context.addIssue({
        code: "custom",
        path: ["CLOUDINARY_CLOUD_NAME"],
        message:
          "Cloudinary cloud name, API key and API secret must be provided together.",
      });
    }
    if (value.OCR_PROVIDER === "google-vision" && !value.GOOGLE_VISION_API_KEY) {
      context.addIssue({
        code: "custom",
        path: ["GOOGLE_VISION_API_KEY"],
        message: "GOOGLE_VISION_API_KEY is required when OCR_PROVIDER=google-vision.",
      });
    }
    if (value.AI_PROVIDER === "openai" && !value.OPENAI_API_KEY) {
      context.addIssue({
        code: "custom",
        path: ["OPENAI_API_KEY"],
        message: "OPENAI_API_KEY is required when AI_PROVIDER=openai.",
      });
    }
    const columnOrder = value.OCR_RESULT_COLUMN_ORDER.split(",").map((item) =>
      item.trim(),
    );
    const requiredColumns = new Set(["placement", "name", "kills", "deaths"]);
    if (
      value.OCR_PARSER_PROFILE === "generic-v1" &&
      (columnOrder.length !== 4 ||
        columnOrder.some((item) => !requiredColumns.has(item)) ||
        new Set(columnOrder).size !== 4)
    ) {
      context.addIssue({
        code: "custom",
        path: ["OCR_RESULT_COLUMN_ORDER"],
        message:
          "OCR_RESULT_COLUMN_ORDER must contain placement,name,kills,deaths exactly once for generic-v1.",
      });
    }
    if (value.OCR_CROP_X_RATIO + value.OCR_CROP_WIDTH_RATIO > 1) {
      context.addIssue({
        code: "custom",
        path: ["OCR_CROP_WIDTH_RATIO"],
        message: "OCR horizontal crop must stay inside the source image.",
      });
    }
    if (value.OCR_CROP_Y_RATIO + value.OCR_CROP_HEIGHT_RATIO > 1) {
      context.addIssue({
        code: "custom",
        path: ["OCR_CROP_HEIGHT_RATIO"],
        message: "OCR vertical crop must stay inside the source image.",
      });
    }
  });

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const formattedErrors = result.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  throw new Error(`Invalid server environment variables:\n${formattedErrors}`);
}

const parsed = result.data;
const isProduction = parsed.NODE_ENV === "production";
const sameSite = parsed.AUTH_COOKIE_SAME_SITE ?? (isProduction ? "none" : "lax");

if (sameSite === "none" && !isProduction) {
  throw new Error(
    "AUTH_COOKIE_SAME_SITE=none requires HTTPS. Use lax locally and none only in production.",
  );
}

const clientOrigins = parsed.CLIENT_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const env = Object.freeze({
  ...parsed,
  AUTH_COOKIE_SAME_SITE: sameSite,
  publicAppUrl: (parsed.PUBLIC_APP_URL ?? clientOrigins[0]).replace(/\/+$/, ""),
  publicApiUrl: (parsed.PUBLIC_API_URL ?? parsed.BETTER_AUTH_URL).replace(/\/+$/, ""),
  isDevelopment: parsed.NODE_ENV === "development",
  isTest: parsed.NODE_ENV === "test",
  isProduction,
  clientOrigins,
  ocrColumnOrder: parsed.OCR_RESULT_COLUMN_ORDER.split(",").map((item) => item.trim()),
  ocrCrop: Object.freeze({
    xRatio: parsed.OCR_CROP_X_RATIO,
    yRatio: parsed.OCR_CROP_Y_RATIO,
    widthRatio: parsed.OCR_CROP_WIDTH_RATIO,
    heightRatio: parsed.OCR_CROP_HEIGHT_RATIO,
  }),
  cloudinaryConfigured: Boolean(
    parsed.CLOUDINARY_CLOUD_NAME &&
    parsed.CLOUDINARY_API_KEY &&
    parsed.CLOUDINARY_API_SECRET,
  ),
});
