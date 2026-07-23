import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

describe("Better Auth integration", () => {
  it("mounts the Better Auth handler before Express body parsing", async () => {
    const response = await request(app).get("/api/auth/ok").expect(200);

    expect(response.body).toEqual({ ok: true });
  });

  it("rejects unauthenticated access to the admin user endpoint", async () => {
    const response = await request(app).get("/api/v1/users").expect(401);

    expect(response.body).toMatchObject({
      success: false,
      message: "You must be signed in to access this resource.",
      errors: [],
    });
  });

  it("rejects unauthenticated access to the protected account endpoint", async () => {
    const response = await request(app).get("/api/v1/auth/me").expect(401);

    expect(response.body).toMatchObject({
      success: false,
      message: "You must be signed in to access this resource.",
      errors: [],
    });
  });
});
