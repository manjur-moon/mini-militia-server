import mongoose from "mongoose";
import multer from "multer";
import { ZodError } from "zod";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { AppError } from "../utils/app-error.js";

function normalizeError(error) {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof ZodError) {
    return new AppError({
      statusCode: 422,
      code: "VALIDATION_ERROR",
      message: "Request validation failed.",
      errors: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
        code: issue.code,
      })),
      cause: error,
    });
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return new AppError({
      statusCode: 422,
      code: "DATABASE_VALIDATION_ERROR",
      message: "Database validation failed.",
      errors: Object.values(error.errors).map((item) => ({
        path: item.path,
        message: item.message,
      })),
      cause: error,
    });
  }

  if (error instanceof mongoose.Error.CastError) {
    return new AppError({
      statusCode: 400,
      code: "INVALID_IDENTIFIER",
      message: `Invalid value for ${error.path}.`,
      cause: error,
    });
  }

  if (error?.code === 11000) {
    return new AppError({
      statusCode: 409,
      code: "DUPLICATE_RESOURCE",
      message: "A resource with the same unique value already exists.",
      errors: Object.keys(error.keyPattern ?? {}).map((field) => ({
        path: field,
        message: `${field} must be unique.`,
      })),
      cause: error,
    });
  }

  if (error?.type === "entity.parse.failed") {
    return new AppError({
      statusCode: 400,
      code: "INVALID_JSON_BODY",
      message: "The JSON request body is invalid.",
      cause: error,
    });
  }

  if (error?.type === "entity.too.large") {
    return new AppError({
      statusCode: 413,
      code: "PAYLOAD_TOO_LARGE",
      message: "The request payload is too large.",
      cause: error,
    });
  }

  if (error instanceof multer.MulterError) {
    const fileTooLarge = error.code === "LIMIT_FILE_SIZE";
    return new AppError({
      statusCode: fileTooLarge ? 413 : 400,
      code: fileTooLarge ? "FILE_TOO_LARGE" : "INVALID_MULTIPART_UPLOAD",
      message: fileTooLarge
        ? `The uploaded image must not exceed ${Math.round(env.MATCH_SCREENSHOT_MAX_BYTES / 1024 / 1024)} MB.`
        : "The image upload request is invalid.",
      errors: [{ path: "image", message: error.message, code: error.code }],
      cause: error,
    });
  }

  return new AppError({
    statusCode: 500,
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred.",
    isOperational: false,
    cause: error,
  });
}

export function errorMiddleware(error, request, response, _next) {
  const normalizedError = normalizeError(error);

  const logMethod = normalizedError.statusCode >= 500 ? "error" : "warn";

  logger[logMethod](normalizedError.message, {
    code: normalizedError.code,
    statusCode: normalizedError.statusCode,
    requestId: request.id,
    method: request.method,
    path: request.originalUrl,
    stack:
      normalizedError.statusCode >= 500 && !env.isProduction ? error.stack : undefined,
  });

  const payload = {
    success: false,
    message: normalizedError.message,
    errors: normalizedError.errors,
    requestId: request.id,
  };

  if (!env.isProduction && normalizedError.statusCode === 500) {
    payload.debug = {
      name: error.name,
      stack: error.stack,
    };
  }

  response.status(normalizedError.statusCode).json(payload);
}
