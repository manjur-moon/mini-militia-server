import { describe, expect, it } from "vitest";
import {
  authorizePermission,
  authorizeRoles,
} from "../src/middleware/authorize.middleware.js";

function invoke(middleware, request = {}) {
  return new Promise((resolve) => {
    middleware(request, {}, (error) => resolve(error));
  });
}

describe("RBAC authorization middleware", () => {
  it("allows an accepted role", async () => {
    const error = await invoke(authorizeRoles("admin", "moderator"), {
      auth: { user: { role: "moderator" } },
    });

    expect(error).toBeUndefined();
  });

  it("rejects a role outside the allow-list", async () => {
    const error = await invoke(authorizeRoles("admin"), {
      auth: { user: { role: "player" } },
    });

    expect(error).toMatchObject({
      statusCode: 403,
      code: "INSUFFICIENT_ROLE",
    });
  });

  it("evaluates named permissions on the backend", async () => {
    const allowed = await invoke(authorizePermission("matches:verify"), {
      auth: { user: { role: "moderator" } },
    });
    const denied = await invoke(authorizePermission("users:manage-role"), {
      auth: { user: { role: "moderator" } },
    });

    expect(allowed).toBeUndefined();
    expect(denied).toMatchObject({
      statusCode: 403,
      code: "INSUFFICIENT_PERMISSION",
    });
  });
});
