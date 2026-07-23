import { describe, expect, it } from "vitest";
import {
  buildDailyTrend,
  calculateConsistency,
  calculateImprovementRate,
  calculateKillEfficiency,
  calculateMvpScoreBreakdown,
  sortLeaderboardEntries,
} from "../src/services/analytics-math.service.js";

const config = {
  weights: {
    killWeight: 1,
    deathPenalty: 0.35,
    firstPlaceBonus: 15,
    secondPlaceBonus: 8,
    thirdPlaceBonus: 4,
    kdrBonusWeight: 5,
    maximumKdrBonus: 20,
    activityWeight: 1,
    maximumActivityBonus: 10,
  },
};

describe("analytics calculations", () => {
  it("produces a transparent capped MVP score breakdown", () => {
    const result = calculateMvpScoreBreakdown(
      {
        matchesPlayed: 3,
        totalKills: 30,
        totalDeaths: 10,
        kdr: 3,
        firstPlaceCount: 1,
        secondPlaceCount: 1,
        thirdPlaceCount: 0,
      },
      config,
    );

    expect(result).toMatchObject({
      killScore: 30,
      deathPenalty: 3.5,
      placementBonus: 23,
      kdrBonus: 15,
      activityAdjustment: 3,
      totalScore: 67.5,
    });
  });

  it("calculates finite efficiency and period improvement", () => {
    expect(calculateKillEfficiency(30, 10)).toBe(75);
    expect(calculateKillEfficiency(0, 0)).toBe(0);
    expect(calculateImprovementRate(15, 10)).toBe(50);
    expect(calculateImprovementRate(2, 0)).toBe(200);
  });

  it("rewards stable performance with a higher consistency score", () => {
    expect(calculateConsistency([10, 10, 10, 10])).toBe(100);
    expect(calculateConsistency([1, 20, 2, 19])).toBeLessThan(100);
    expect(calculateConsistency([10])).toBe(50);
  });

  it("aggregates daily graph data in the configured timezone", () => {
    const trend = buildDailyTrend(
      [
        {
          matchDate: new Date("2026-07-20T02:00:00.000Z"),
          kills: 10,
          deaths: 2,
          placement: 1,
          participantCount: 4,
        },
        {
          matchDate: new Date("2026-07-20T12:00:00.000Z"),
          kills: 6,
          deaths: 4,
          placement: 4,
          participantCount: 4,
        },
      ],
      { timezone: "Asia/Dhaka" },
    );

    expect(trend).toEqual([
      {
        date: "2026-07-20",
        matches: 2,
        kills: 16,
        deaths: 6,
        kdr: 2.666667,
        averageRank: 2.5,
        firstPlaces: 1,
        lastPlaces: 1,
      },
    ]);
  });

  it("uses deterministic tie-breakers and lower average rank as better", () => {
    const entries = [
      {
        playerId: "2",
        metrics: {
          averageRank: 2,
          firstPlaceCount: 1,
          totalKills: 20,
          totalDeaths: 8,
          matchesPlayed: 3,
        },
        performanceScore: 20,
      },
      {
        playerId: "1",
        metrics: {
          averageRank: 1.5,
          firstPlaceCount: 1,
          totalKills: 18,
          totalDeaths: 7,
          matchesPlayed: 3,
        },
        performanceScore: 19,
      },
    ];

    const ranked = sortLeaderboardEntries(entries, "average_rank");
    expect(ranked[0].playerId).toBe("1");
    expect(ranked[0].leaderboardRank).toBe(1);
  });
});
