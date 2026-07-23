import { AppError } from "../utils/app-error.js";

export function notFoundMiddleware(request, _response, next) {
  next(
    new AppError({
      statusCode: 404,
      code: "ROUTE_NOT_FOUND",
      message: `Route ${request.method} ${request.originalUrl} was not found.`,
    }),
  );
}
