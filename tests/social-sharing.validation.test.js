import { describe, expect, it } from "vitest";
import {
  achievementShareSchema,
  playerProfileShareSchema,
  weeklyMvpShareSchema,
} from "../src/validators/social-sharing.validation.js";

describe("social-sharing validation", () => {
  it("normalizes public player and achievement identifiers", () => {
    const result = achievementShareSchema.parse({
      body: {},
      params: { playerId: "mm001", achievementCode: "kills_club_100" },
      query: {},
    });

    expect(result.params).toEqual({
      playerId: "MM001",
      achievementCode: "KILLS_CLUB_100",
    });
  });

  it("rejects invalid identifiers and invalid dates", () => {
    expect(() =>
      playerProfileShareSchema.parse({
        body: {},
        params: { playerId: "player-1" },
        query: {},
      }),
    ).toThrow();
    expect(() =>
      weeklyMvpShareSchema.parse({
        body: {},
        params: {},
        query: { date: "not-a-date" },
      }),
    ).toThrow();
  });
});
