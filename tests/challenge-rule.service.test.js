import { describe, expect, it } from "vitest";
import {
  evaluateChallengeEligibility,
  evaluateChallengeProgress,
} from "../src/services/challenge-rule.service.js";

describe("challenge rule service", () => {
  it("completes a cumulative challenge when the target is reached", () => {
    const result = evaluateChallengeProgress(
      {
        metric: "totalKills",
        targetOperator: "gte",
        targetValue: 100,
        minimumMatches: 1,
      },
      { totalKills: 112, matchesPlayed: 8 },
    );
    expect(result.completed).toBe(true);
    expect(result.progressPercentage).toBe(100);
  });

  it("does not complete KDR challenge before the minimum sample", () => {
    const result = evaluateChallengeProgress(
      {
        metric: "kdr",
        targetOperator: "gt",
        targetValue: 2,
        minimumMatches: 3,
      },
      { kdr: 4.5, matchesPlayed: 1 },
    );
    expect(result.targetMet).toBe(true);
    expect(result.eligibility.eligible).toBe(false);
    expect(result.completed).toBe(false);
  });

  it("supports compound eligibility rules", () => {
    const result = evaluateChallengeEligibility(
      {
        minimumMatches: 5,
        minimumEligibility: {
          combinator: "all",
          conditions: [
            { metric: "totalKills", operator: "gte", value: 50 },
            { metric: "kdr", operator: "gt", value: 1.5 },
          ],
        },
      },
      { matchesPlayed: 7, totalKills: 80, kdr: 1.8 },
    );
    expect(result.eligible).toBe(true);
    expect(result.conditions.every((condition) => condition.passed)).toBe(true);
  });
});
