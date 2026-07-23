import { describe, expect, it } from "vitest";
import {
  calculateTitleExpiration,
  chooseCurrentTitle,
  evaluateTitleDefinition,
} from "../src/services/title-rule.service.js";

const entry = {
  metrics: {
    matchesPlayed: 6,
    totalKills: 120,
    totalDeaths: 70,
    kdr: 1.714,
    averageKills: 20,
    averageDeaths: 11.667,
    averageRank: 2,
    winRate: 50,
    firstPlaceCount: 3,
    lastPlaceCount: 0,
  },
  improvementRate: 25,
};

describe("dynamic-title rule evaluation", () => {
  it("requires both the minimum sample and configured all-rule conditions", () => {
    const result = evaluateTitleDefinition(
      {
        minimumMatches: 5,
        rules: {
          combinator: "all",
          conditions: [
            { metric: "firstPlaceCount", operator: "gte", value: 3 },
            { metric: "winRate", operator: "gte", value: 40 },
          ],
        },
      },
      entry,
    );
    expect(result.qualified).toBe(true);
    expect(result.conditions.every((condition) => condition.passed)).toBe(true);
  });

  it("supports any-rule definitions and fails insufficient samples", () => {
    expect(
      evaluateTitleDefinition(
        {
          minimumMatches: 10,
          rules: {
            combinator: "any",
            conditions: [
              { metric: "totalKills", operator: "gte", value: 100 },
              { metric: "kdr", operator: "gte", value: 3 },
            ],
          },
        },
        entry,
      ),
    ).toMatchObject({ qualified: false, minimumMatchesMet: false });
  });

  it("caps a temporary title at the earlier duration or period end", () => {
    const expiration = calculateTitleExpiration({
      awardedAt: new Date("2026-07-20T00:00:00.000Z"),
      periodEndAt: new Date("2026-07-27T00:00:00.000Z"),
      durationDays: 3,
    });
    expect(expiration.toISOString()).toBe("2026-07-23T00:00:00.000Z");
  });

  it("selects exactly one current title by priority and deterministic tie-breaks", () => {
    const selected = chooseCurrentTitle([
      {
        awardedAt: new Date("2026-07-20T00:00:00.000Z"),
        titleSnapshot: { code: "TERMINATOR", priority: 90 },
      },
      {
        awardedAt: new Date("2026-07-19T00:00:00.000Z"),
        titleSnapshot: { code: "KING_SLAYER", priority: 100 },
      },
    ]);
    expect(selected.titleSnapshot.code).toBe("KING_SLAYER");
  });
});
