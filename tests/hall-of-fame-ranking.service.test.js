import { describe, expect, it } from "vitest";
import {
  selectAllTimeLegend,
  selectBestKdr,
  selectLongestWinningStreak,
  selectMostKills,
  selectMostMvpAwards,
  selectSeasonChampion,
} from "../src/services/hall-of-fame-ranking.service.js";

function entry(playerId, overrides = {}) {
  const { metrics = {}, records = {}, ...rest } = overrides;
  return {
    playerId,
    player: { playerId, name: playerId },
    rank: null,
    performanceScore: 0,
    minimumMatchesMet: true,
    metrics: {
      matchesPlayed: 10,
      totalKills: 0,
      totalDeaths: 0,
      kdr: 0,
      firstPlaceCount: 0,
      ...metrics,
    },
    records: {
      longestFirstPlaceStreak: 0,
      ...records,
    },
    ...rest,
  };
}

describe("Hall of Fame deterministic ranking", () => {
  it("selects most kills with documented tie-breakers", () => {
    const winner = selectMostKills([
      entry("MM002", {
        metrics: { totalKills: 100, firstPlaceCount: 4, totalDeaths: 20 },
      }),
      entry("MM001", {
        metrics: { totalKills: 100, firstPlaceCount: 5, totalDeaths: 40 },
      }),
    ]);
    expect(winner.player.playerId).toBe("MM001");
  });

  it("applies the minimum-match rule to best KDR", () => {
    const winner = selectBestKdr(
      [
        entry("MM001", { metrics: { matchesPlayed: 1, kdr: 9, totalKills: 9 } }),
        entry("MM002", { metrics: { matchesPlayed: 5, kdr: 3, totalKills: 30 } }),
      ],
      3,
    );
    expect(winner.player.playerId).toBe("MM002");
  });

  it("selects the longest verified first-place streak", () => {
    const winner = selectLongestWinningStreak([
      entry("MM001", { records: { longestFirstPlaceStreak: 4 } }),
      entry("MM002", { records: { longestFirstPlaceStreak: 6 } }),
    ]);
    expect(winner.player.playerId).toBe("MM002");
  });

  it("uses official rank for all-time legend and season champion", () => {
    const entries = [
      entry("MM001", { rank: 2, performanceScore: 100 }),
      entry("MM002", { rank: 1, performanceScore: 90 }),
    ];
    expect(selectAllTimeLegend(entries).player.playerId).toBe("MM002");
    expect(selectSeasonChampion(entries).player.playerId).toBe("MM002");
  });

  it("selects most MVP awards before score tie-breakers", () => {
    const winner = selectMostMvpAwards([
      { player: { playerId: "MM001" }, awardCount: 4, totalScore: 90 },
      { player: { playerId: "MM002" }, awardCount: 5, totalScore: 70 },
    ]);
    expect(winner.player.playerId).toBe("MM002");
  });
});
