import { describe, expect, it } from "vitest";
import {
  buildRivalriesFromMatches,
  calculateSafeKdr,
  compareHeadToHead,
  selectRivalOfPeriod,
} from "../src/services/rivalry-math.service.js";

describe("rivalry head-to-head rules", () => {
  it("uses better placement before kills", () => {
    expect(
      compareHeadToHead({ placement: 1, kills: 5 }, { placement: 2, kills: 20 }),
    ).toBe("left");
  });

  it("uses kills as the tie-breaker when placement is equal", () => {
    expect(
      compareHeadToHead({ placement: 2, kills: 12 }, { placement: 2, kills: 9 }),
    ).toBe("left");
  });

  it("records a draw when placement and kills are equal", () => {
    expect(
      compareHeadToHead({ placement: 3, kills: 8 }, { placement: 3, kills: 8 }),
    ).toBe("draw");
  });

  it("never produces Infinity for zero-death KDR", () => {
    expect(calculateSafeKdr(15, 0)).toBe(15);
    expect(calculateSafeKdr(0, 0)).toBe(0);
  });
});

describe("rivalry aggregation", () => {
  it("aggregates shared matches, wins, draws, kills and comparative KDR", () => {
    const [rivalry] = buildRivalriesFromMatches([
      {
        matchDate: new Date("2026-07-01T10:00:00.000Z"),
        results: [
          { playerId: "a", placement: 1, kills: 12, deaths: 3 },
          { playerId: "b", placement: 2, kills: 10, deaths: 5 },
        ],
      },
      {
        matchDate: new Date("2026-07-02T10:00:00.000Z"),
        results: [
          { playerId: "a", placement: 2, kills: 8, deaths: 4 },
          { playerId: "b", placement: 1, kills: 11, deaths: 2 },
        ],
      },
      {
        matchDate: new Date("2026-07-03T10:00:00.000Z"),
        results: [
          { playerId: "a", placement: 2, kills: 9, deaths: 3 },
          { playerId: "b", placement: 2, kills: 9, deaths: 3 },
        ],
      },
    ]);
    expect(rivalry).toMatchObject({
      sharedMatches: 3,
      draws: 1,
      combinedKills: 59,
      winDifference: 0,
    });
    expect(rivalry.playerA.headToHeadWins).toBe(1);
    expect(rivalry.playerB.headToHeadWins).toBe(1);
    expect(Number.isFinite(rivalry.competitivenessScore)).toBe(true);
  });

  it("selects rival of the period by activity then competitiveness", () => {
    const selected = selectRivalOfPeriod([
      {
        pairKey: "a:b",
        sharedMatches: 3,
        competitivenessScore: 70,
        combinedKills: 50,
        lastSharedMatchAt: new Date("2026-07-01"),
      },
      {
        pairKey: "a:c",
        sharedMatches: 4,
        competitivenessScore: 60,
        combinedKills: 40,
        lastSharedMatchAt: new Date("2026-07-02"),
      },
    ]);
    expect(selected.pairKey).toBe("a:c");
  });
});
