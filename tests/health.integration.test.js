import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

describe("GET /api/v1/health", () => {
  it("returns the standard success response", async () => {
    const response = await request(app).get("/api/v1/health").expect(200);

    expect(response.body).toMatchObject({
      success: true,
      message: "API health check completed.",
      data: {
        service: "mini-militia-api",
        status: "ok",
        environment: "test",
      },
    });

    expect(response.headers["x-request-id"]).toBeTruthy();
  });

  it("rejects unsupported query parameters", async () => {
    const response = await request(app)
      .get("/api/v1/health?unexpected=true")
      .expect(422);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Request validation failed.");
  });
});
