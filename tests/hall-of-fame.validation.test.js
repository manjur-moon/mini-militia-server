import { describe, expect, it } from "vitest";
import {
  listHallOfFameSchema,
  recalculateHallOfFameSchema,
} from "../src/validators/hall-of-fame.validation.js";

describe("Hall of Fame validation", () => {
  it("accepts validated list filters", () => {
    const result = listHallOfFameSchema.safeParse({
      body: {},
      params: {},
      query: { category: "most_kills", status: "current", page: "1", limit: "20" },
    });
    expect(result.success).toBe(true);
  });

  it("requires seasonId for season champion recalculation", () => {
    const result = recalculateHallOfFameSchema.safeParse({
      body: {
        category: "season_champion",
        reason: "Finalize the completed season champion record.",
      },
      params: {},
      query: {},
    });
    expect(result.success).toBe(false);
  });

  it("rejects seasonId for global categories", () => {
    const result = recalculateHallOfFameSchema.safeParse({
      body: {
        category: "most_kills",
        seasonId: "64b64c6f2f5d4e1a2b3c4d5e",
        reason: "Recalculate the selected global record.",
      },
      params: {},
      query: {},
    });
    expect(result.success).toBe(false);
  });
});
