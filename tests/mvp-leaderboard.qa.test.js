import { describe, expect, it } from "vitest";
import {
  calculateMvpScoreBreakdown,
  rankPeriodicEntries,
  sortLeaderboardEntries,
} from "../src/services/analytics-math.service.js";

const config = {
  minimumMatches: 3,
  weights: {
    killWeight: 1,
    deathPenalty: 0.5,
    firstPlaceBonus: 15,
    secondPlaceBonus: 8,
    thirdPlaceBonus: 4,
    kdrBonusWeight: 10,
    maximumKdrBonus: 20,
    activityWeight: 2,
    maximumActivityBonus: 10,
  },
};

function entry(playerId, overrides = {}) {
  return {
    playerId,
    performanceScore: overrides.performanceScore ?? 50,
    metrics: {
      matchesPlayed: overrides.matchesPlayed ?? 5,
      totalKills: overrides.totalKills ?? 30,
      totalDeaths: overrides.totalDeaths ?? 10,
      kdr: overrides.kdr ?? 3,
      firstPlaceCount: overrides.firstPlaceCount ?? 1,
      secondPlaceCount: overrides.secondPlaceCount ?? 0,
      thirdPlaceCount: overrides.thirdPlaceCount ?? 0,
      lastPlaceCount: overrides.lastPlaceCount ?? 0,
      winRate: overrides.winRate ?? 20,
      averageRank: overrides.averageRank ?? 2.5,
    },
  };
}

describe("MVP formula and leaderboard QA", () => {
  it("caps KDR and activity bonuses exactly at configured limits", () => {
    const result = calculateMvpScoreBreakdown(
      {
        matchesPlayed: 100,
        totalKills: 500,
        totalDeaths: 1,
        kdr: 500,
        firstPlaceCount: 20,
        secondPlaceCount: 0,
        thirdPlaceCount: 0,
      },
      config,
    );

    expect(result.kdrBonus).toBe(20);
    expect(result.activityAdjustment).toBe(10);
    expect(Number.isFinite(result.totalScore)).toBe(true);
  });

  it("keeps a heavily penalized MVP score finite and reproducible", () => {
    const first = calculateMvpScoreBreakdown(
      {
        matchesPlayed: 3,
        totalKills: 0,
        totalDeaths: 300,
        kdr: 0,
        firstPlaceCount: 0,
        secondPlaceCount: 0,
        thirdPlaceCount: 0,
      },
      config,
    );
    const second = calculateMvpScoreBreakdown(first.inputs, config);

    expect(first.totalScore).toBe(-144);
    expect(second.totalScore).toBe(first.totalScore);
  });

  it("uses stable player ID ordering after all leaderboard tie-breakers", () => {
    const ranked = sortLeaderboardEntries(
      [entry("player-b"), entry("player-a")],
      "overall",
    );

    expect(ranked.map((item) => item.playerId)).toEqual(["player-a", "player-b"]);
  });

  it("ranks lower average placement ahead while preserving deterministic ties", () => {
    const ranked = sortLeaderboardEntries(
      [
        entry("player-c", { averageRank: 2 }),
        entry("player-a", { averageRank: 1.5 }),
        entry("player-b", { averageRank: 1.5 }),
      ],
      "average_rank",
    );

    expect(ranked.map((item) => item.playerId)).toEqual([
      "player-a",
      "player-b",
      "player-c",
    ]);
  });

  it("ranks periodic entries by score, kills, deaths, first places and stable ID", () => {
    const ranked = rankPeriodicEntries([
      entry("player-c", { performanceScore: 100, totalKills: 40, totalDeaths: 8 }),
      entry("player-b", { performanceScore: 100, totalKills: 40, totalDeaths: 7 }),
      entry("player-a", {
        performanceScore: 100,
        totalKills: 40,
        totalDeaths: 7,
        firstPlaceCount: 2,
      }),
    ]);

    expect(ranked.map((item) => item.playerId)).toEqual([
      "player-a",
      "player-b",
      "player-c",
    ]);
    expect(ranked.map((item) => item.rank)).toEqual([1, 2, 3]);
  });
});
