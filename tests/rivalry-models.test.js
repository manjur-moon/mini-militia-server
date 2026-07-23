import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { RivalryStatistics } from "../src/models/rivalry-statistics.model.js";

function side(playerId, wins, kills, deaths, kdr) {
  return {
    playerId,
    headToHeadWins: wins,
    totalKills: kills,
    totalDeaths: deaths,
    kdr,
  };
}

describe("rivalry statistics model", () => {
  it("validates a versioned weekly rivalry cache", async () => {
    const playerA = new mongoose.Types.ObjectId();
    const playerB = new mongoose.Types.ObjectId();
    const document = new RivalryStatistics({
      pairKey: [String(playerA), String(playerB)].sort().join(":"),
      periodType: "weekly",
      periodKey: "2026-07-20",
      periodStartAt: new Date("2026-07-20T00:00:00.000Z"),
      periodEndAt: new Date("2026-07-27T00:00:00.000Z"),
      timezone: "Asia/Dhaka",
      playerA: side(playerA, 2, 30, 10, 3),
      playerB: side(playerB, 1, 25, 12, 2.0833),
      sharedMatches: 4,
      draws: 1,
      combinedKills: 55,
      winDifference: 1,
      competitivenessScore: 75,
      lastSharedMatchAt: new Date("2026-07-24T12:00:00.000Z"),
      calculationVersion: "rivalry-v1",
      sourceDataHash: "a".repeat(64),
      recalculatedAt: new Date(),
    });
    await expect(document.validate()).resolves.toBeUndefined();
  });

  it("rejects non-finite competitiveness values", async () => {
    const playerA = new mongoose.Types.ObjectId();
    const playerB = new mongoose.Types.ObjectId();
    const document = new RivalryStatistics({
      pairKey: [String(playerA), String(playerB)].sort().join(":"),
      periodType: "all_time",
      periodKey: "all-time",
      periodStartAt: new Date(0),
      periodEndAt: new Date(),
      timezone: "UTC",
      playerA: side(playerA, 0, 0, 0, 0),
      playerB: side(playerB, 0, 0, 0, 0),
      sharedMatches: 0,
      draws: 0,
      combinedKills: 0,
      winDifference: 0,
      competitivenessScore: Number.NaN,
      calculationVersion: "rivalry-v1",
      sourceDataHash: "b".repeat(64),
    });
    await expect(document.validate()).rejects.toBeDefined();
  });
});
