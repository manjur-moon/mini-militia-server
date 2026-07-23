import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

describe("HTTP security and error-response integration", () => {
  it("sets security headers, removes framework disclosure and returns a request ID", async () => {
    const response = await request(app).get("/api/v1/health").expect(200);

    expect(response.headers["x-powered-by"]).toBeUndefined();
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(response.headers["content-security-policy"]).toContain("default-src 'self'");
    expect(response.headers["x-request-id"]).toMatch(/^[a-zA-Z0-9-]{8,}$/);
  });

  it("echoes a valid caller-supplied request ID", async () => {
    const response = await request(app)
      .get("/api/v1/health")
      .set("X-Request-ID", "123e4567-e89b-42d3-a456-426614174000")
      .expect(200);

    expect(response.headers["x-request-id"]).toBe(
      "123e4567-e89b-42d3-a456-426614174000",
    );
  });

  it("allows configured CORS origins with credentials", async () => {
    const response = await request(app)
      .get("/api/v1/health")
      .set("Origin", "http://localhost:5173")
      .expect(200);

    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("rejects an origin outside the configured CORS allow-list", async () => {
    const response = await request(app)
      .get("/api/v1/health")
      .set("Origin", "https://attacker.example")
      .expect(403);

    expect(response.body).toMatchObject({
      success: false,
      message: "The request origin is not allowed.",
      errors: [],
    });
    expect(response.body.debug).toBeUndefined();
  });

  it("rejects malformed JSON as a sanitized client error", async () => {
    const response = await request(app)
      .post("/api/v1/players")
      .set("Content-Type", "application/json")
      .send('{"name":')
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      message: "The JSON request body is invalid.",
      errors: [],
    });
    expect(response.body.stack).toBeUndefined();
    expect(response.body.debug).toBeUndefined();
  });

  it("rejects unknown query keys instead of accepting operator-like input", async () => {
    const response = await request(app)
      .get("/api/v1/players?status%5B%24ne%5D=inactive")
      .expect(422);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Request validation failed.");
    expect(response.body.errors.some((error) => error.path.startsWith("query"))).toBe(
      true,
    );
  });

  it("returns the standard sanitized response for missing routes", async () => {
    const response = await request(app).get("/api/v1/not-a-real-route").expect(404);

    expect(response.body).toMatchObject({
      success: false,
      message: "Route GET /api/v1/not-a-real-route was not found.",
      errors: [],
    });
    expect(response.body.requestId).toBeTruthy();
    expect(response.body.debug).toBeUndefined();
  });
});
