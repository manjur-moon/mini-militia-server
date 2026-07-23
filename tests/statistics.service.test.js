import { describe, expect, it } from "vitest";
import {
  calculateCoreMetrics,
  calculateKdr,
  calculateLongestMvpStreak,
  calculatePersonalRecords,
} from "../src/services/statistics.service.js";

const matchId = (suffix) => `00000000000000000000000${suffix}`;

function row({ id, date, kills, deaths, placement, participantCount = 4 }) {
  return {
    matchId: matchId(id),
    matchDate: new Date(date),
    kills,
    deaths,
    placement,
    participantCount,
  };
}

describe("core statistics calculations", () => {
  it("uses a finite documented fallback when deaths are zero", () => {
    expect(calculateKdr(0, 0)).toBe(0);
    expect(calculateKdr(12, 0)).toBe(12);
    expect(calculateKdr(12, 3)).toBe(4);
  });

  it("calculates official metrics from verified rows", () => {
    const metrics = calculateCoreMetrics([
      row({
        id: "1",
        date: "2026-07-01T10:00:00.000Z",
        kills: 10,
        deaths: 2,
        placement: 1,
      }),
      row({
        id: "2",
        date: "2026-07-02T10:00:00.000Z",
        kills: 5,
        deaths: 3,
        placement: 4,
      }),
    ]);

    expect(metrics).toEqual({
      matchesPlayed: 2,
      totalKills: 15,
      totalDeaths: 5,
      kdr: 3,
      averageKills: 7.5,
      averageDeaths: 2.5,
      averageRank: 2.5,
      winRate: 50,
      firstPlaceCount: 1,
      lastPlaceCount: 1,
      mvpCount: 0,
    });
  });

  it("returns safe zero values when no verified rows exist", () => {
    expect(calculateCoreMetrics([])).toEqual({
      matchesPlayed: 0,
      totalKills: 0,
      totalDeaths: 0,
      kdr: 0,
      averageKills: 0,
      averageDeaths: 0,
      averageRank: 0,
      winRate: 0,
      firstPlaceCount: 0,
      lastPlaceCount: 0,
      mvpCount: 0,
    });
  });

  it("calculates reproducible personal records and first-place streaks", () => {
    const rows = [
      row({
        id: "1",
        date: "2026-07-01T10:00:00.000Z",
        kills: 10,
        deaths: 2,
        placement: 1,
      }),
      row({
        id: "2",
        date: "2026-07-01T15:00:00.000Z",
        kills: 20,
        deaths: 0,
        placement: 1,
      }),
      row({
        id: "3",
        date: "2026-07-02T10:00:00.000Z",
        kills: 8,
        deaths: 9,
        placement: 2,
      }),
      row({
        id: "4",
        date: "2026-07-03T10:00:00.000Z",
        kills: 4,
        deaths: 12,
        placement: 1,
      }),
    ];

    const records = calculatePersonalRecords(rows, "Asia/Dhaka");
    expect(records.highestKills.value).toBe(20);
    expect(String(records.highestKills.matchId)).toBe(matchId("2"));
    expect(records.highestDeaths.value).toBe(12);
    expect(records.bestKdr.value).toBe(20);
    expect(records.longestFirstPlaceStreak).toBe(2);
    expect(records.mostMatchesInOneDay.value).toBe(2);
  });
  it("calculates consecutive weekly MVP streaks from current awards", () => {
    const streak = calculateLongestMvpStreak(
      [
        { awardType: "weekly", startAt: new Date("2026-07-05T18:00:00.000Z") },
        { awardType: "weekly", startAt: new Date("2026-07-12T18:00:00.000Z") },
        { awardType: "weekly", startAt: new Date("2026-07-19T18:00:00.000Z") },
        { awardType: "monthly", startAt: new Date("2026-07-01T00:00:00.000Z") },
      ],
      "Asia/Dhaka",
    );
    expect(streak).toBe(3);
  });
});
