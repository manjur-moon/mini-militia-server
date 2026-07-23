import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { HallOfFameRecord } from "../src/models/hall-of-fame-record.model.js";

function baseRecord(overrides = {}) {
  return {
    category: "most_kills",
    playerId: new mongoose.Types.ObjectId(),
    playerSnapshot: {
      playerId: "MM001",
      name: "Test Player",
      photoUrl: null,
      status: "active",
    },
    seasonId: null,
    seasonSnapshot: null,
    periodKey: "all-time",
    recordValue: 100,
    unit: "kills",
    awardDate: new Date(),
    criteriaSnapshot: {
      definition: "Highest verified kill total.",
      minimumMatches: null,
      tieBreakers: ["More first places"],
    },
    evidence: { totalKills: 100 },
    sourceVersion: "hall-of-fame-v1:core-v1",
    sourceDataHash: "abc123",
    status: "current",
    ...overrides,
  };
}

describe("Hall of Fame model", () => {
  it("validates a global record snapshot", async () => {
    await expect(
      new HallOfFameRecord(baseRecord()).validate(),
    ).resolves.toBeUndefined();
  });

  it("requires a season snapshot for season champion", async () => {
    await expect(
      new HallOfFameRecord(baseRecord({ category: "season_champion" })).validate(),
    ).rejects.toThrow("seasonId");
  });

  it("rejects a season reference on global categories", async () => {
    await expect(
      new HallOfFameRecord(
        baseRecord({
          seasonId: new mongoose.Types.ObjectId(),
          seasonSnapshot: {
            name: "Season One",
            slug: "season-one",
            startAt: new Date("2026-01-01"),
            endAt: new Date("2026-02-01"),
            timezone: "UTC",
            status: "completed",
          },
        }),
      ).validate(),
    ).rejects.toThrow("Only season champion");
  });
});
