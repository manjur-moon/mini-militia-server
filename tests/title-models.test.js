import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { DynamicTitle } from "../src/models/dynamic-title.model.js";
import { PlayerTitle } from "../src/models/player-title.model.js";
import { DEFAULT_DYNAMIC_TITLES } from "../src/services/title.service.js";

describe("dynamic-title models", () => {
  it("validates every required default title definition", async () => {
    for (const title of DEFAULT_DYNAMIC_TITLES) {
      const document = new DynamicTitle({
        ...structuredClone(title),
        isActive: true,
        activatedAt: new Date(),
        createdBy: "system:test",
        updatedBy: "system:test",
        createdReason: "Validate the required default title definition.",
      });
      await expect(document.validate()).resolves.toBeUndefined();
    }
  });

  it("validates a historical award with an immutable title snapshot", async () => {
    const award = new PlayerTitle({
      playerId: new mongoose.Types.ObjectId(),
      titleId: new mongoose.Types.ObjectId(),
      titleCode: "KING_SLAYER",
      titleVersion: "v1",
      titleSnapshot: {
        code: "KING_SLAYER",
        version: "v1",
        name: "King Slayer",
        description: "Dominates the weekly arena.",
        icon: "♛",
        priority: 100,
        periodType: "weekly",
      },
      periodKey: "2026-07-20",
      periodStartAt: new Date("2026-07-20T00:00:00.000Z"),
      periodEndAt: new Date("2026-07-27T00:00:00.000Z"),
      expiresAt: new Date("2026-07-27T00:00:00.000Z"),
      isCurrent: true,
      status: "awarded",
      evaluationRunId: "run-1",
      evidence: { qualified: true },
    });
    await expect(award.validate()).resolves.toBeUndefined();
  });
});
