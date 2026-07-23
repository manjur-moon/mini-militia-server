import { describe, expect, it } from "vitest";
import {
  createAchievementDefinitionSchema,
  recalculateAchievementsSchema,
} from "../src/validators/achievement.validation.js";

describe("achievement validation", () => {
  it("accepts a versioned achievement definition", () => {
    const result = createAchievementDefinitionSchema.safeParse({
      body: {
        code: "ARENA_VETERAN",
        version: "v1",
        name: "Arena Veteran",
        description: "Rewards fifty verified league appearances.",
        icon: "🎖️",
        category: "career",
        periodType: "all_time",
        minimumMatches: 50,
        progressMetric: "matchesPlayed",
        targetValue: 50,
        criteria: {
          combinator: "all",
          conditions: [{ metric: "matchesPlayed", operator: "gte", value: 50 }],
        },
        reason: "Create the reviewed Arena Veteran achievement.",
      },
      params: {},
      query: {},
    });
    expect(result.success).toBe(true);
  });

  it("rejects a progress metric that is absent from criteria", () => {
    const result = createAchievementDefinitionSchema.safeParse({
      body: {
        code: "INVALID_RULE",
        version: "v1",
        name: "Invalid Rule",
        description: "This payload should fail validation.",
        icon: "❌",
        category: "test",
        periodType: "all_time",
        minimumMatches: 1,
        progressMetric: "totalKills",
        targetValue: 10,
        criteria: {
          combinator: "all",
          conditions: [{ metric: "matchesPlayed", operator: "gte", value: 10 }],
        },
        reason: "Validate progress metric consistency.",
      },
      params: {},
      query: {},
    });
    expect(result.success).toBe(false);
  });

  it("requires an audit reason for recalculation", () => {
    const result = recalculateAchievementsSchema.safeParse({
      body: {},
      params: {},
      query: {},
    });
    expect(result.success).toBe(false);
  });
});
