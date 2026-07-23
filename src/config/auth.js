import { APP_NAME } from "@mini-militia/shared";
import { betterAuth } from "better-auth";
import {
  ACTIVE_USER_STATUS,
  DEFAULT_USER_ROLE,
} from "../constants/domain.constants.js";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { authDatabase, authMongoClient } from "./auth-database.js";
import { env } from "./env.js";

const USER_COLLECTION = "user";

export const auth = betterAuth({
  appName: APP_NAME,
  baseURL: env.BETTER_AUTH_URL,
  basePath: "/api/auth",
  secret: env.BETTER_AUTH_SECRET,
  database: mongodbAdapter(authDatabase, {
    client: authMongoClient,
  }),
  trustedOrigins: env.clientOrigins,
  emailAndPassword: {
    enabled: true,
    disableSignUp: false,
    requireEmailVerification: false,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: DEFAULT_USER_ROLE,
        input: false,
        returned: true,
      },
      status: {
        type: "string",
        required: true,
        defaultValue: ACTIVE_USER_STATUS,
        input: false,
        returned: true,
      },
      linkedPlayerId: {
        type: "string",
        required: false,
        defaultValue: null,
        input: false,
        returned: true,
      },
    },
  },
  session: {
    expiresIn: env.AUTH_SESSION_EXPIRES_IN,
    updateAge: env.AUTH_SESSION_UPDATE_AGE,
    freshAge: env.AUTH_SESSION_FRESH_AGE,
    // RBAC changes must take effect immediately after session revocation.
    cookieCache: {
      enabled: false,
    },
  },
  hooks: {
    before: createAuthMiddleware(async (context) => {
      if (context.path !== "/sign-in/email") {
        return;
      }

      const email = context.body?.email?.trim().toLowerCase();

      if (!email) {
        return;
      }

      const user = await authDatabase
        .collection(USER_COLLECTION)
        .findOne({ email }, { projection: { status: 1 } });

      if (user && user.status !== ACTIVE_USER_STATUS) {
        throw new APIError("FORBIDDEN", {
          message: "This account is not active.",
        });
      }
    }),
  },
  rateLimit: {
    enabled: !env.isTest,
    window: 60,
    max: 100,
    storage: "memory",
    customRules: {
      "/sign-in/email": {
        window: 60,
        max: 10,
      },
      "/sign-up/email": {
        window: 60,
        max: 5,
      },
    },
  },
  advanced: {
    useSecureCookies: env.isProduction,
    cookiePrefix: env.BETTER_AUTH_COOKIE_PREFIX,
    defaultCookieAttributes: {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: env.AUTH_COOKIE_SAME_SITE,
      path: "/",
    },
  },
  experimental: {
    joins: true,
  },
});
