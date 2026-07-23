import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../config/auth.js";
import { ACTIVE_USER_STATUS } from "../constants/domain.constants.js";
import { AppError } from "../utils/app-error.js";

export async function resolveSession(request) {
  return auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });
}

export function createRequireAuthMiddleware({ getSession = resolveSession } = {}) {
  return async function requireAuth(request, _response, next) {
    try {
      const authSession = await getSession(request);

      if (!authSession?.user || !authSession?.session) {
        throw new AppError({
          statusCode: 401,
          code: "AUTHENTICATION_REQUIRED",
          message: "You must be signed in to access this resource.",
        });
      }

      if (authSession.user.status !== ACTIVE_USER_STATUS) {
        throw new AppError({
          statusCode: 403,
          code: "ACCOUNT_INACTIVE",
          message: "This account is not active.",
        });
      }

      request.auth = authSession;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const requireAuth = createRequireAuthMiddleware();

export function createOptionalAuthMiddleware({ getSession = resolveSession } = {}) {
  return async function optionalAuth(request, _response, next) {
    try {
      const authSession = await getSession(request);
      if (authSession?.user?.status === ACTIVE_USER_STATUS && authSession?.session) {
        request.auth = authSession;
      }
      next();
    } catch {
      next();
    }
  };
}

export const optionalAuth = createOptionalAuthMiddleware();
