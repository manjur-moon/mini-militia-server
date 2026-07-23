import { describe, expect, it } from "vitest";
import {
  createTitleDefinitionSchema,
  recalculateTitlesSchema,
} from "../src/validators/title.validation.js";

describe("dynamic-title validation", () => {
  it("accepts a documented rule definition", () => {
    const result = createTitleDefinitionSchema.safeParse({
      body: {
        code: "ARENA_MASTER",
        version: "v1",
        name: "Arena Master",
        description: "Rewards repeated verified first-place performance.",
        icon: "★",
        periodType: "weekly",
        minimumMatches: 5,
        priority: 60,
        durationDays: 7,
        rules: {
          combinator: "all",
          conditions: [{ metric: "firstPlaceCount", operator: "gte", value: 3 }],
        },
        reason: "Create the reviewed Arena Master title.",
      },
      params: {},
      query: {},
    });
    expect(result.success).toBe(true);
  });

  it("requires an audit reason for recalculation", () => {
    const result = recalculateTitlesSchema.safeParse({
      body: {},
      params: {},
      query: {},
    });
    expect(result.success).toBe(false);
  });
});
