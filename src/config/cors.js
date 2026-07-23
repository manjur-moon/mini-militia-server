import { env } from "./env.js";
import { AppError } from "../utils/app-error.js";

const allowedOrigins = new Set(env.clientOrigins);

export const corsOptions = Object.freeze({
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-CSRF-Token",
    "X-Request-ID",
    "Idempotency-Key",
  ],
  exposedHeaders: ["X-Request-ID", "RateLimit", "RateLimit-Policy"],
  maxAge: 600,
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(
      new AppError({
        statusCode: 403,
        code: "CORS_ORIGIN_DENIED",
        message: "The request origin is not allowed.",
      }),
    );
  },
});
