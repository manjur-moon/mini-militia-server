import { describe, expect, it } from "vitest";
import { createRatingConfigSchema } from "../src/validators/rating.validation.js";
import { DEFAULT_RATING_CONFIG } from "../src/services/rating-config.service.js";

function requestWithFormula(overrides = {}) {
  const formula = structuredClone(DEFAULT_RATING_CONFIG);
  return {
    body: {
      version: "rating-v2",
      name: "Reviewed rating formula",
      description: "Test formula",
      minimumMatches: formula.minimumMatches,
      newPlayerConfidenceFloor: formula.newPlayerConfidenceFloor,
      components: formula.components,
      overallWeights: formula.overallWeights,
      reason: "Create a reviewed test formula",
      ...overrides,
    },
    params: {},
    query: {},
  };
}

describe("rating request validation", () => {
  it("accepts a complete documented formula", () => {
    expect(createRatingConfigSchema.safeParse(requestWithFormula()).success).toBe(true);
  });

  it("rejects metric weights that do not total one", () => {
    const request = requestWithFormula();
    request.body.components[0].metrics[0].weight = 0.2;
    const result = createRatingConfigSchema.safeParse(request);
    expect(result.success).toBe(false);
    expect(
      result.error.issues.some((issue) => issue.message.includes("must total 1")),
    ).toBe(true);
  });

  it("rejects overall weights that do not total one", () => {
    const request = requestWithFormula({
      overallWeights: {
        attack: 0.5,
        survival: 0.25,
        consistency: 0.25,
        activity: 0.15,
      },
    });
    const result = createRatingConfigSchema.safeParse(request);
    expect(result.success).toBe(false);
    expect(
      result.error.issues.some((issue) => issue.path.includes("overallWeights")),
    ).toBe(true);
  });
});
