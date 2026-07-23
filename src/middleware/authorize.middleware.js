import { AppError } from "../utils/app-error.js";
import { roleHasPermission } from "../constants/rbac.constants.js";

export function authorizeRoles(...allowedRoles) {
  const allowed = new Set(allowedRoles);

  return function roleAuthorizationMiddleware(request, _response, next) {
    if (!request.auth?.user) {
      next(
        new AppError({
          statusCode: 401,
          code: "AUTHENTICATION_REQUIRED",
          message: "You must be signed in to access this resource.",
        }),
      );
      return;
    }

    if (!allowed.has(request.auth.user.role)) {
      next(
        new AppError({
          statusCode: 403,
          code: "INSUFFICIENT_ROLE",
          message: "You do not have permission to access this resource.",
        }),
      );
      return;
    }

    next();
  };
}

export function authorizePermission(permission) {
  return function permissionAuthorizationMiddleware(request, _response, next) {
    if (!request.auth?.user) {
      next(
        new AppError({
          statusCode: 401,
          code: "AUTHENTICATION_REQUIRED",
          message: "You must be signed in to access this resource.",
        }),
      );
      return;
    }

    if (!roleHasPermission(request.auth.user.role, permission)) {
      next(
        new AppError({
          statusCode: 403,
          code: "INSUFFICIENT_PERMISSION",
          message: "You do not have the required permission.",
        }),
      );
      return;
    }

    next();
  };
}
