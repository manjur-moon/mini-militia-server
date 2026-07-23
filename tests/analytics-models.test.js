import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { LeaderboardSnapshot } from "../src/models/leaderboard-snapshot.model.js";
import { PeriodicStatistics } from "../src/models/periodic-statistics.model.js";

const playerId = new mongoose.Types.ObjectId();

describe("analytics persistence models", () => {
  it("validates a versioned periodic statistics cache", async () => {
    const document = new PeriodicStatistics({
      playerId,
      periodType: "weekly",
      periodKey: "2026-07-20",
      startAt: new Date("2026-07-19T18:00:00.000Z"),
      endAt: new Date("2026-07-26T18:00:00.000Z"),
      timezone: "Asia/Dhaka",
      metrics: {
        matchesPlayed: 3,
        totalKills: 30,
        totalDeaths: 10,
        kdr: 3,
        averageKills: 10,
        averageDeaths: 3.333333,
        averageRank: 2,
        winRate: 33.333333,
        firstPlaceCount: 1,
        lastPlaceCount: 0,
        mvpCount: 0,
      },
      placementCounts: { secondPlaceCount: 1, thirdPlaceCount: 1 },
      performanceScore: 67.5,
      previousPerformanceScore: 50,
      rank: 1,
      previousPeriodRank: 2,
      improvementRate: 35,
      minimumMatchesMet: true,
      calculationVersion: "analytics-v1",
      sourceDataHash: "a".repeat(64),
      sourceVerifiedMatchCount: 3,
    });

    await expect(document.validate()).resolves.toBeUndefined();
  });

  it("validates leaderboard player metadata and cache hash", async () => {
    const document = new LeaderboardSnapshot({
      metric: "overall",
      periodType: "weekly",
      periodKey: "2026-07-20",
      startAt: new Date("2026-07-19T18:00:00.000Z"),
      endAt: new Date("2026-07-26T18:00:00.000Z"),
      timezone: "Asia/Dhaka",
      minimumMatches: 3,
      entries: [
        {
          rank: 1,
          playerId,
          playerName: "Ninja",
          playerCode: "MM001",
          photoUrl: null,
          value: 67.5,
          matchesPlayed: 3,
          tieBreak: { totalKills: 30 },
        },
      ],
      calculationVersion: "analytics-v1",
      sourceDataHash: "b".repeat(64),
    });

    await expect(document.validate()).resolves.toBeUndefined();
  });
});
