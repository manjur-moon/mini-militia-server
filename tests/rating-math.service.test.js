import { describe, expect, it } from "vitest";
import { DEFAULT_RATING_CONFIG } from "../src/services/rating-config.service.js";
import {
  applySampleConfidence,
  calculateConfidenceFactor,
  calculatePlayerRating,
  deriveRatingInputs,
  normalizeRatingMetric,
} from "../src/services/rating-math.service.js";

const rows = [
  {
    matchDate: new Date("2026-07-18T12:00:00.000Z"),
    kills: 30,
    deaths: 20,
    placement: 1,
    participantCount: 5,
  },
  {
    matchDate: new Date("2026-07-19T12:00:00.000Z"),
    kills: 20,
    deaths: 25,
    placement: 3,
    participantCount: 5,
  },
  {
    matchDate: new Date("2026-07-19T15:00:00.000Z"),
    kills: 25,
    deaths: 25,
    placement: 2,
    participantCount: 5,
  },
  {
    matchDate: new Date("2026-07-20T12:00:00.000Z"),
    kills: 35,
    deaths: 20,
    placement: 1,
    participantCount: 5,
  },
  {
    matchDate: new Date("2026-07-20T15:00:00.000Z"),
    kills: 15,
    deaths: 30,
    placement: 5,
    participantCount: 5,
  },
];

describe("player rating calculations", () => {
  it("derives transparent verified-match inputs", () => {
    expect(deriveRatingInputs(rows, "Asia/Dhaka")).toMatchObject({
      matchesPlayed: 5,
      totalKills: 125,
      totalDeaths: 120,
      averageKills: 25,
      averageDeaths: 24,
      kdr: 1.041667,
      averageRank: 2.4,
      winRate: 40,
      lastPlaceRate: 20,
      activeDays: 3,
    });
  });

  it("supports documented target, inverse, min-max and percentile normalization", () => {
    expect(normalizeRatingMetric(25, { method: "target", target: 25 })).toBe(100);
    expect(normalizeRatingMetric(50, { method: "inverse_target", target: 25 })).toBe(
      50,
    );
    expect(
      normalizeRatingMetric(15, { method: "min_max", minimum: 10, maximum: 20 }),
    ).toBe(50);
    expect(normalizeRatingMetric(20, { method: "percentile" }, [10, 20, 20, 30])).toBe(
      50,
    );
  });

  it("shrinks small samples toward a neutral baseline", () => {
    expect(calculateConfidenceFactor(1, 5, 0.25)).toBe(0.4);
    expect(applySampleConfidence(100, 0.4)).toBe(70);
    expect(applySampleConfidence(0, 0.4)).toBe(30);
    expect(calculateConfidenceFactor(5, 5, 0.25)).toBe(1);
  });

  it("returns finite 0–100 component and overall ratings", () => {
    const result = calculatePlayerRating({
      rows,
      timezone: "Asia/Dhaka",
      config: DEFAULT_RATING_CONFIG,
    });

    expect(result.sampleSize).toBe(5);
    expect(result.minimumMatchesMet).toBe(true);
    expect(result.confidenceFactor).toBe(1);
    for (const key of ["attack", "survival", "consistency", "activity", "overall"]) {
      expect(Number.isFinite(result[key])).toBe(true);
      expect(result[key]).toBeGreaterThanOrEqual(0);
      expect(result[key]).toBeLessThanOrEqual(100);
    }
    expect(result.inputSnapshot.inputs.matchesPlayed).toBe(5);
    expect(result.inputSnapshot.normalizedMetrics.attack.averageKills.normalized).toBe(
      100,
    );
  });

  it("uses safe zero values when no verified matches exist", () => {
    expect(
      calculatePlayerRating({
        rows: [],
        timezone: "Asia/Dhaka",
        config: DEFAULT_RATING_CONFIG,
      }),
    ).toMatchObject({
      attack: 0,
      survival: 0,
      consistency: 0,
      activity: 0,
      overall: 0,
      sampleSize: 0,
      minimumMatchesMet: false,
      confidenceFactor: 0,
    });
  });
});
