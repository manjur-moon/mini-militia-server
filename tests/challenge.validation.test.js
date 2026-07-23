import { describe, expect, it } from "vitest";
import {
  createChallengeSchema,
  recalculateChallengesSchema,
} from "../src/validators/challenge.validation.js";

const validBody = {
  code: "WEEKLY_CUSTOM_2026_W29",
  version: "1.0.0",
  name: "Weekly Custom",
  description: "A custom weekly challenge for league players.",
  icon: "🎯",
  type: "weekly",
  status: "draft",
  startAt: "2026-07-13T00:00:00.000Z",
  endAt: "2026-07-20T00:00:00.000Z",
  metric: "totalKills",
  targetOperator: "gte",
  targetValue: 100,
  minimumMatches: 1,
  reward: { name: "Custom Badge", badgeIcon: "🎯", description: "Reward" },
  reason: "Create the weekly custom challenge.",
};

describe("challenge validation", () => {
  it("accepts a valid custom challenge", () => {
    const result = createChallengeSchema.safeParse({
      body: validBody,
      params: {},
      query: {},
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid date range", () => {
    const result = createChallengeSchema.safeParse({
      body: { ...validBody, endAt: "2026-07-12T00:00:00.000Z" },
      params: {},
      query: {},
    });
    expect(result.success).toBe(false);
  });

  it("requires an auditable recalculation reason", () => {
    const result = recalculateChallengesSchema.safeParse({
      body: { playerId: "MM001", reason: "bad" },
      params: {},
      query: {},
    });
    expect(result.success).toBe(false);
  });
});
