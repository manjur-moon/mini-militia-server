import { describe, expect, it } from "vitest";
import {
  periodSummarySchema,
  playerInsightSchema,
  regenerateAIInsightSchema,
} from "../src/validators/ai-insight.validation.js";

describe("AI insight validation", () => {
  it("accepts weekly summary requests", () => {
    const result = periodSummarySchema.safeParse({
      body: {},
      params: { periodType: "weekly" },
      query: {},
    });
    expect(result.success).toBe(true);
  });

  it("normalizes player identifiers", () => {
    const result = playerInsightSchema.safeParse({
      body: {},
      params: { playerId: "mm001" },
      query: {},
    });
    expect(result.success).toBe(true);
    expect(result.data.params.playerId).toBe("MM001");
  });

  it("requires a player for player-performance regeneration", () => {
    const result = regenerateAIInsightSchema.safeParse({
      body: {
        type: "player_performance",
        reason: "Regenerate after reviewed verified-data changes.",
      },
      params: {},
      query: {},
    });
    expect(result.success).toBe(false);
  });

  it("requires a match for match-insight regeneration", () => {
    const result = regenerateAIInsightSchema.safeParse({
      body: {
        type: "match_insight",
        reason: "Regenerate after reviewed verified-data changes.",
      },
      params: {},
      query: {},
    });
    expect(result.success).toBe(false);
  });
});
