import { describe, expect, it } from "vitest";
import {
  canTransitionSeason,
  inferSeasonStatus,
  seasonRangesOverlap,
} from "../src/services/season.service.js";

describe("Season lifecycle rules", () => {
  it("detects intersecting season ranges", () => {
    expect(
      seasonRangesOverlap(
        "2026-01-01T00:00:00.000Z",
        "2026-02-01T00:00:00.000Z",
        "2026-01-15T00:00:00.000Z",
        "2026-03-01T00:00:00.000Z",
      ),
    ).toBe(true);
  });

  it("treats adjacent ranges as non-overlapping", () => {
    expect(
      seasonRangesOverlap(
        "2026-01-01T00:00:00.000Z",
        "2026-02-01T00:00:00.000Z",
        "2026-02-01T00:00:00.000Z",
        "2026-03-01T00:00:00.000Z",
      ),
    ).toBe(false);
  });

  it("allows only controlled lifecycle transitions", () => {
    expect(canTransitionSeason("draft", "upcoming")).toBe(true);
    expect(canTransitionSeason("active", "completed")).toBe(true);
    expect(canTransitionSeason("completed", "active")).toBe(false);
    expect(canTransitionSeason("archived", "draft")).toBe(false);
  });

  it("infers upcoming, active and completed states from boundaries", () => {
    const now = new Date("2026-02-15T00:00:00.000Z");
    expect(
      inferSeasonStatus("2026-03-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z", now),
    ).toBe("upcoming");
    expect(
      inferSeasonStatus("2026-02-01T00:00:00.000Z", "2026-03-01T00:00:00.000Z", now),
    ).toBe("active");
    expect(
      inferSeasonStatus("2026-01-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z", now),
    ).toBe("completed");
  });
});
