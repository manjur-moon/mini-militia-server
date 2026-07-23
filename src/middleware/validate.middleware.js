import { AppError } from "../utils/app-error.js";

export function validateRequest(schema) {
  return async function validationMiddleware(request, _response, next) {
    const result = await schema.safeParseAsync({
      body: request.body ?? {},
      params: request.params ?? {},
      query: request.query ?? {},
    });

    if (!result.success) {
      next(
        new AppError({
          statusCode: 422,
          code: "VALIDATION_ERROR",
          message: "Request validation failed.",
          errors: result.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
            code: issue.code,
          })),
        }),
      );
      return;
    }

    request.validated = result.data;
    next();
  };
}
