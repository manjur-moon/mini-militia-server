import { describe, expect, it } from "vitest";
import { evaluateAchievementDefinition } from "../src/services/achievement-rule.service.js";

const entry = {
  metrics: {
    matchesPlayed: 12,
    totalKills: 140,
    totalDeaths: 80,
    firstPlaceCount: 4,
    mvpCount: 1,
  },
  records: {
    highestKillsInMatch: 26,
    longestFirstPlaceStreak: 3,
  },
};

describe("achievement rule evaluation", () => {
  it("unlocks an all-condition achievement when the sample and rules pass", () => {
    const result = evaluateAchievementDefinition(
      {
        minimumMatches: 5,
        progressMetric: "totalKills",
        targetValue: 100,
        criteria: {
          combinator: "all",
          conditions: [
            { metric: "totalKills", operator: "gte", value: 100 },
            { metric: "firstPlaceCount", operator: "gte", value: 3 },
          ],
        },
      },
      entry,
    );
    expect(result.unlocked).toBe(true);
    expect(result.progress).toMatchObject({
      current: 140,
      target: 100,
      percentage: 100,
    });
  });

  it("keeps progress below 100 when a required rule is incomplete", () => {
    const result = evaluateAchievementDefinition(
      {
        minimumMatches: 5,
        progressMetric: "mvpCount",
        targetValue: 5,
        criteria: {
          combinator: "all",
          conditions: [{ metric: "mvpCount", operator: "gte", value: 5 }],
        },
      },
      entry,
    );
    expect(result.unlocked).toBe(false);
    expect(result.progress.percentage).toBe(20);
  });

  it("reads record metrics for streak achievements", () => {
    const result = evaluateAchievementDefinition(
      {
        minimumMatches: 1,
        progressMetric: "highestKillsInMatch",
        targetValue: 20,
        criteria: {
          combinator: "all",
          conditions: [{ metric: "highestKillsInMatch", operator: "gte", value: 20 }],
        },
      },
      entry,
    );
    expect(result.unlocked).toBe(true);
  });

  it("does not unlock when minimum-match handling fails", () => {
    const result = evaluateAchievementDefinition(
      {
        minimumMatches: 20,
        progressMetric: "totalKills",
        targetValue: 100,
        criteria: {
          combinator: "all",
          conditions: [{ metric: "totalKills", operator: "gte", value: 100 }],
        },
      },
      entry,
    );
    expect(result).toMatchObject({ unlocked: false, minimumMatchesMet: false });
  });
});
