import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { Challenge } from "../src/models/challenge.model.js";
import { PlayerChallenge } from "../src/models/player-challenge.model.js";

function challengeInput(overrides = {}) {
  return {
    code: "WEEKLY_TEST_2026_W29",
    version: "1.0.0",
    name: "Test Challenge",
    description: "A valid challenge used by schema tests.",
    icon: "🎯",
    type: "weekly",
    status: "active",
    startAt: new Date("2026-07-13T00:00:00.000Z"),
    endAt: new Date("2026-07-20T00:00:00.000Z"),
    timezone: "UTC",
    metric: "totalKills",
    targetOperator: "gte",
    targetValue: 100,
    minimumMatches: 1,
    minimumEligibility: null,
    reward: { name: "Test Badge", badgeIcon: "🎯", description: "Test reward" },
    isSystemDefault: false,
    createdBy: "user-1",
    updatedBy: "user-1",
    ...overrides,
  };
}

describe("challenge models", () => {
  it("validates a challenge", async () => {
    await expect(new Challenge(challengeInput()).validate()).resolves.toBeUndefined();
  });

  it("rejects inverted challenge dates", async () => {
    await expect(
      new Challenge(
        challengeInput({
          startAt: new Date("2026-07-20T00:00:00.000Z"),
          endAt: new Date("2026-07-13T00:00:00.000Z"),
        }),
      ).validate(),
    ).rejects.toThrow("endAt");
  });

  it("validates a historical player challenge snapshot", async () => {
    const challengeId = new mongoose.Types.ObjectId();
    const playerId = new mongoose.Types.ObjectId();
    const challenge = challengeInput();
    await expect(
      new PlayerChallenge({
        playerId,
        challengeId,
        challengeCode: challenge.code,
        challengeVersion: challenge.version,
        challengeSnapshot: {
          code: challenge.code,
          version: challenge.version,
          name: challenge.name,
          description: challenge.description,
          icon: challenge.icon,
          type: challenge.type,
          metric: challenge.metric,
          targetOperator: challenge.targetOperator,
          targetValue: challenge.targetValue,
          startAt: challenge.startAt,
          endAt: challenge.endAt,
          timezone: challenge.timezone,
          reward: challenge.reward,
        },
        isEligible: true,
        currentValue: 100,
        targetValue: 100,
        progressPercentage: 100,
        status: "completed",
        completedAt: new Date(),
        evidence: { matchesPlayed: 8 },
        evaluationRunId: "run-1",
      }).validate(),
    ).resolves.toBeUndefined();
  });
});
