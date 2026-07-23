import { describe, expect, it } from "vitest";
import {
  changeSeasonStatusSchema,
  createSeasonSchema,
  getSeasonLeaderboardSchema,
  listSeasonsSchema,
  updateSeasonSchema,
} from "../src/validators/season.validation.js";

const seasonId = "64b64c6f2f5d4e1a2b3c4d5e";

describe("Season validation", () => {
  it("accepts validated list filters", () => {
    const result = listSeasonsSchema.safeParse({
      body: {},
      params: {},
      query: { status: "completed", page: "1", limit: "20" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a season whose end precedes its start", () => {
    const result = createSeasonSchema.safeParse({
      body: {
        name: "Season One",
        slug: "season-one",
        description: "League season",
        startAt: "2026-02-01T00:00:00.000Z",
        endAt: "2026-01-01T00:00:00.000Z",
        timezone: "UTC",
        status: "draft",
        reason: "Create the season schedule.",
      },
      params: {},
      query: {},
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid controlled status change", () => {
    const result = changeSeasonStatusSchema.safeParse({
      body: {
        status: "completed",
        reason: "Finalize the active season results.",
      },
      params: { seasonId },
      query: {},
    });
    expect(result.success).toBe(true);
  });

  it("requires a sufficiently descriptive audit reason", () => {
    const result = updateSeasonSchema.safeParse({
      body: { name: "Updated", reason: "no" },
      params: { seasonId },
      query: {},
    });
    expect(result.success).toBe(false);
  });

  it("validates public leaderboard metric and pagination", () => {
    const result = getSeasonLeaderboardSchema.safeParse({
      body: {},
      params: { identifier: "season-one" },
      query: { metric: "kills", page: "1", limit: "25" },
    });
    expect(result.success).toBe(true);
  });
});
