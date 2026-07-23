import { describe, expect, it } from "vitest";
import {
  getRivalryComparisonSchema,
  listPlayerRivalriesSchema,
  recalculateRivalriesSchema,
} from "../src/validators/rivalry.validation.js";

describe("rivalry validation", () => {
  it("accepts a paginated all-time player rivalry request", () => {
    const result = listPlayerRivalriesSchema.safeParse({
      body: {},
      params: { playerId: "MM001" },
      query: {},
    });
    expect(result.success).toBe(true);
  });

  it("rejects self-incompatible malformed player codes", () => {
    const result = getRivalryComparisonSchema.safeParse({
      body: {},
      params: { playerId: "1", opponentId: "MM002" },
      query: {},
    });
    expect(result.success).toBe(false);
  });

  it("requires a season ID for season recalculation", () => {
    const result = recalculateRivalriesSchema.safeParse({
      body: {
        periodTypes: ["season"],
        reason: "Recalculate the selected season rivalry cache.",
      },
      params: {},
      query: {},
    });
    expect(result.success).toBe(false);
  });
});
