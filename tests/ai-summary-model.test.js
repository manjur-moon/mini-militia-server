import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { AISummary } from "../src/models/ai-summary.model.js";

function baseSummary(overrides = {}) {
  return {
    type: "weekly",
    periodKey: "2026-W30",
    startAt: new Date("2026-07-20T00:00:00.000Z"),
    endAt: new Date("2026-07-27T00:00:00.000Z"),
    timezone: "Asia/Dhaka",
    status: "fallback_generated",
    provider: "deterministic",
    model: null,
    isFallback: true,
    content: "A verified-data weekly summary is available.",
    structuredContent: {
      headline: "Weekly report",
      summary: "A verified-data weekly summary is available.",
    },
    sourceMetrics: { totals: { verifiedMatches: 3 } },
    sourceDataHash: "a".repeat(64),
    promptVersion: "mini-militia-insights-v1",
    generatedBy: "system:test",
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    ...overrides,
  };
}

describe("AISummary model", () => {
  it("accepts a deterministic period fallback", async () => {
    const summary = new AISummary(baseSummary());
    await expect(summary.validate()).resolves.toBeUndefined();
  });

  it("requires playerId for player performance insights", async () => {
    const summary = new AISummary(baseSummary({ type: "player_performance" }));
    await expect(summary.validate()).rejects.toThrow("playerId");
  });

  it("requires matchId for match insights", async () => {
    const summary = new AISummary(baseSummary({ type: "match_insight" }));
    await expect(summary.validate()).rejects.toThrow("matchId");
  });

  it("rejects a fallback using a non-deterministic provider", async () => {
    const summary = new AISummary(baseSummary({ provider: "openai" }));
    await expect(summary.validate()).rejects.toThrow("deterministic");
  });

  it("defines a cache uniqueness index", () => {
    const index = AISummary.schema
      .indexes()
      .find(([fields]) =>
        ["type", "periodKey", "playerId", "matchId", "sourceDataHash"].every(
          (key) => fields[key] === 1,
        ),
      );
    expect(index?.[1]?.unique).toBe(true);
  });

  it("accepts scoped object identifiers", async () => {
    const summary = new AISummary(
      baseSummary({
        type: "player_performance",
        playerId: new mongoose.Types.ObjectId(),
      }),
    );
    await expect(summary.validate()).resolves.toBeUndefined();
  });
});
