import { describe, expect, it } from "vitest";
import { deterministicInsightService } from "../src/services/ai/deterministic-insight.service.js";

const periodSource = {
  period: { label: "Week 30", key: "2026-W30" },
  totals: {
    verifiedMatches: 5,
    participatingPlayers: 4,
    totalKills: 120,
    totalDeaths: 80,
    firstPlaces: 5,
    leagueKdr: 1.5,
  },
  topPlayers: [
    { playerId: "MM001", name: "Alpha", performanceScore: 92.5, matchesPlayed: 5 },
  ],
  mostImproved: null,
};

describe("deterministicInsightService", () => {
  it("creates a reproducible period fallback", () => {
    const output = deterministicInsightService.period(periodSource);
    expect(output.headline).toContain("Alpha");
    expect(output.summary).toContain("5 verified matches");
    expect(output.topPerformerReasons[0].playerId).toBe("MM001");
  });

  it("does not need an external provider for empty periods", () => {
    const output = deterministicInsightService.period({
      ...periodSource,
      totals: { ...periodSource.totals, verifiedMatches: 0, totalKills: 0 },
      topPlayers: [],
    });
    expect(output.summary).toContain("No verified matches");
  });

  it("creates scoreboard-only match highlights", () => {
    const output = deterministicInsightService.match({
      match: { matchCode: "MATCH001" },
      results: [
        { playerId: "MM001", name: "Alpha", kills: 12, deaths: 4, placement: 1 },
        { playerId: "MM002", name: "Bravo", kills: 9, deaths: 5, placement: 2 },
      ],
    });
    expect(output.headline).toContain("Alpha");
    expect(output.highlights).toHaveLength(2);
  });
});
