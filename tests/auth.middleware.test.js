import { describe, expect, it, vi } from "vitest";
import { createRequireAuthMiddleware } from "../src/middleware/auth.middleware.js";

function invokeMiddleware(middleware, request = {}) {
  return new Promise((resolve) => {
    middleware(request, {}, (error) => resolve({ error, request }));
  });
}

describe("requireAuth middleware", () => {
  it("attaches an active session to the request", async () => {
    const authSession = {
      user: { id: "user-1", status: "active" },
      session: { id: "session-1" },
    };
    const middleware = createRequireAuthMiddleware({
      getSession: vi.fn().mockResolvedValue(authSession),
    });

    const result = await invokeMiddleware(middleware);

    expect(result.error).toBeUndefined();
    expect(result.request.auth).toEqual(authSession);
  });

  it("rejects a missing session", async () => {
    const middleware = createRequireAuthMiddleware({
      getSession: vi.fn().mockResolvedValue(null),
    });

    const result = await invokeMiddleware(middleware);

    expect(result.error).toMatchObject({
      statusCode: 401,
      code: "AUTHENTICATION_REQUIRED",
    });
  });

  it("rejects an inactive account", async () => {
    const middleware = createRequireAuthMiddleware({
      getSession: vi.fn().mockResolvedValue({
        user: { id: "user-1", status: "inactive" },
        session: { id: "session-1" },
      }),
    });

    const result = await invokeMiddleware(middleware);

    expect(result.error).toMatchObject({
      statusCode: 403,
      code: "ACCOUNT_INACTIVE",
    });
  });
});
