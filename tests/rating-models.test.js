import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { PlayerRating } from "../src/models/player-rating.model.js";
import { RatingConfig } from "../src/models/rating-config.model.js";
import { DEFAULT_RATING_CONFIG } from "../src/services/rating-config.service.js";

function clone(value) {
  return structuredClone(value);
}

describe("rating models", () => {
  it("validates the documented default formula", async () => {
    const config = new RatingConfig(clone(DEFAULT_RATING_CONFIG));
    await expect(config.validate()).resolves.toBeUndefined();
  });

  it("rejects component metric weights that do not total one", async () => {
    const input = clone(DEFAULT_RATING_CONFIG);
    input.version = "rating-invalid";
    input.components[0].metrics[0].weight = 0.1;
    const config = new RatingConfig(input);
    await expect(config.validate()).rejects.toThrow(
      "Metric weights for attack must total 1.",
    );
  });

  it("validates a persisted finite player rating snapshot", async () => {
    const rating = new PlayerRating({
      playerId: new mongoose.Types.ObjectId(),
      periodType: "weekly",
      periodKey: "2026-07-20",
      startAt: new Date("2026-07-20T00:00:00.000Z"),
      endAt: new Date("2026-07-27T00:00:00.000Z"),
      timezone: "Asia/Dhaka",
      attack: 75,
      survival: 68,
      consistency: 80,
      activity: 60,
      overall: 72.65,
      rank: 1,
      sampleSize: 8,
      minimumMatchesMet: true,
      confidenceFactor: 1,
      formulaVersion: "rating-v1",
      sourceDataHash: "a".repeat(64),
      inputSnapshot: { inputs: { matchesPlayed: 8 } },
    });

    await expect(rating.validate()).resolves.toBeUndefined();
  });
});
