export class AppError extends Error {
  constructor({
    statusCode = 500,
    code = "INTERNAL_SERVER_ERROR",
    message = "An unexpected error occurred.",
    errors = [],
    isOperational = true,
    cause,
  } = {}) {
    super(message, { cause });
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
    this.isOperational = isOperational;
    Error.captureStackTrace?.(this, AppError);
  }
}
