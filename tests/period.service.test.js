import { describe, expect, it } from "vitest";
import {
  resolveMonthlyPeriod,
  resolveWeeklyPeriod,
} from "../src/services/period.service.js";

describe("league period boundaries", () => {
  it("resolves Monday-start weeks in the league timezone with an exclusive end", () => {
    const period = resolveWeeklyPeriod({
      date: "2026-07-19T18:30:00.000Z",
      timezone: "Asia/Dhaka",
      weekStartsOn: 1,
    });

    expect(period.key).toBe("2026-07-20");
    expect(period.startAt.toISOString()).toBe("2026-07-19T18:00:00.000Z");
    expect(period.endAt.toISOString()).toBe("2026-07-26T18:00:00.000Z");
  });

  it("supports a configurable Sunday week start", () => {
    const period = resolveWeeklyPeriod({
      date: "2026-07-20T12:00:00.000Z",
      timezone: "Asia/Dhaka",
      weekStartsOn: 0,
    });

    expect(period.key).toBe("2026-07-19");
    expect(period.startAt.toISOString()).toBe("2026-07-18T18:00:00.000Z");
  });

  it("treats date-only input as a league-local calendar date", () => {
    const period = resolveWeeklyPeriod({
      date: "2026-07-20",
      timezone: "America/Los_Angeles",
      weekStartsOn: 1,
    });

    expect(period.key).toBe("2026-07-20");
    expect(period.startAt.toISOString()).toBe("2026-07-20T07:00:00.000Z");
  });

  it("resolves calendar months in the league timezone", () => {
    const period = resolveMonthlyPeriod({
      date: "2026-07-20T12:00:00.000Z",
      timezone: "Asia/Dhaka",
    });

    expect(period.key).toBe("2026-07");
    expect(period.startAt.toISOString()).toBe("2026-06-30T18:00:00.000Z");
    expect(period.endAt.toISOString()).toBe("2026-07-31T18:00:00.000Z");
  });
});
