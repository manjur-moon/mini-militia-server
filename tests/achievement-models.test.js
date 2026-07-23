import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { Achievement } from "../src/models/achievement.model.js";
import { PlayerAchievement } from "../src/models/player-achievement.model.js";
import { DEFAULT_ACHIEVEMENTS } from "../src/services/achievement.service.js";

describe("achievement models", () => {
  it("validates every required default achievement definition", async () => {
    for (const achievement of DEFAULT_ACHIEVEMENTS) {
      const document = new Achievement({
        ...structuredClone(achievement),
        isActive: true,
        activatedAt: new Date(),
        createdBy: "system:test",
        updatedBy: "system:test",
        createdReason: "Validate the required default achievement definition.",
      });
      await expect(document.validate()).resolves.toBeUndefined();
    }
  });

  it("validates unlocked progress with an immutable achievement snapshot", async () => {
    const progress = new PlayerAchievement({
      playerId: new mongoose.Types.ObjectId(),
      achievementId: new mongoose.Types.ObjectId(),
      achievementCode: "FIRST_BLOOD",
      achievementVersion: "v1",
      achievementSnapshot: {
        code: "FIRST_BLOOD",
        version: "v1",
        name: "First Blood",
        description: "Record the first official kill.",
        icon: "🩸",
        category: "milestone",
        periodType: "all_time",
        progressMetric: "totalKills",
        targetValue: 1,
      },
      progress: {
        current: 1,
        target: 1,
        percentage: 100,
        conditions: [
          {
            metric: "totalKills",
            operator: "gte",
            expected: 1,
            actual: 1,
            percentage: 100,
            passed: true,
          },
        ],
      },
      unlockedAt: new Date(),
      isUnlocked: true,
      evidence: { unlocked: true },
      evaluationRunId: "run-1",
    });
    await expect(progress.validate()).resolves.toBeUndefined();
  });
});
