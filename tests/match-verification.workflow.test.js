import mongoose from "mongoose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMatchService } from "../src/services/match.service.js";

const matchId = "64b64c1f4f0f4f0f4f0f4f0f";
const actor = { id: "moderator-user" };
const requestMeta = {
  requestId: "qa-verification-request",
  ipAddress: "127.0.0.1",
  userAgent: "vitest",
};

function queryWithSession(value) {
  return {
    session: vi.fn(async () => value),
  };
}

function createFixture({
  placements = [1, 2],
  status = "needs_review",
  statsFail = false,
} = {}) {
  const match = {
    _id: matchId,
    matchCode: "MT-20260720-4F0F4F0F",
    status,
    participantCount: 2,
    resultCount: 2,
    matchDate: new Date("2026-07-20T12:00:00.000Z"),
    seasonId: null,
    verification: {},
    currentRevision: 0,
    statisticsRecalculation: {},
    save: vi.fn(async () => match),
  };
  const results = placements.map((placement, index) => ({
    _id: `74b64c1f4f0f4f0f4f0f4f0${index}`.slice(0, 24),
    corrected: {
      playerId: `84b64c1f4f0f4f0f4f0f4f0${index}`.slice(0, 24),
      playerName: `Player ${index + 1}`,
      kills: 10 - index,
      deaths: 2 + index,
      placement,
    },
  }));

  const MatchModel = {
    findById: vi.fn(() => queryWithSession(match)),
    updateOne: vi.fn(async () => ({ matchedCount: 1 })),
  };
  const MatchResultModel = {
    find: vi.fn(() => queryWithSession(results)),
    bulkWrite: vi.fn(async () => ({ modifiedCount: results.length })),
  };
  const AuditLogModel = { create: vi.fn(async () => []) };
  const statsService = {
    recalculateForPlayerIds: statsFail
      ? vi.fn(async () => {
          throw new Error("simulated statistics failure");
        })
      : vi.fn(async () => ({ status: "completed", updatedPlayers: 2 })),
  };
  const achievementEvaluator = {
    evaluatePlayerIds: vi.fn(async () => ({ newlyUnlocked: 1 })),
  };
  const rivalryUpdater = {
    refreshAfterMatch: vi.fn(async () => ({ pairsUpdated: 1 })),
  };
  const challengeEvaluator = {
    evaluatePlayerIds: vi.fn(async () => ({ newlyCompleted: 1 })),
  };
  const hallOfFameUpdater = {
    refreshAfterVerifiedData: vi.fn(async () => ({ recordsUpdated: 1 })),
  };
  const seasonManager = {
    resolveForMatch: vi.fn(async () => ({ _id: "94b64c1f4f0f4f0f4f0f4f0f" })),
  };
  const notificationDelivery = {
    createForLinkedPlayers: vi.fn(async () => ({ created: 2 })),
  };

  return {
    match,
    results,
    MatchModel,
    MatchResultModel,
    AuditLogModel,
    statsService,
    achievementEvaluator,
    rivalryUpdater,
    challengeEvaluator,
    hallOfFameUpdater,
    seasonManager,
    notificationDelivery,
    service: createMatchService({
      MatchModel,
      MatchResultModel,
      OCRJobModel: {},
      PlayerModel: {},
      AuditLogModel,
      imageService: {},
      processingService: {},
      statsService,
      achievementEvaluator,
      rivalryUpdater,
      challengeEvaluator,
      hallOfFameUpdater,
      seasonManager,
      notificationDelivery,
    }),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("verified match critical workflow", () => {
  it("commits official rows before recalculating dependent systems", async () => {
    const fixture = createFixture();
    const endSession = vi.fn();
    vi.spyOn(mongoose, "startSession").mockResolvedValue({
      withTransaction: async (callback) => callback(),
      endSession,
    });

    const result = await fixture.service.verify({
      actor,
      matchId,
      reason: "Screenshot and all rows verified",
      requestMeta,
    });

    expect(fixture.MatchResultModel.bulkWrite).toHaveBeenCalledOnce();
    const operations = fixture.MatchResultModel.bulkWrite.mock.calls[0][0];
    expect(operations).toHaveLength(2);
    expect(operations[0].updateOne.update.$set.status).toBe("verified");
    expect(operations[0].updateOne.update.$set.official).toMatchObject({
      playerName: "Player 1",
      kills: 10,
      deaths: 2,
      placement: 1,
      verifiedBy: actor.id,
    });
    expect(fixture.match.status).toBe("verified");
    expect(fixture.match.verifiedResultCount).toBe(2);
    expect(fixture.statsService.recalculateForPlayerIds).toHaveBeenCalledWith(
      fixture.results.map((row) => String(row.corrected.playerId)),
    );
    expect(fixture.achievementEvaluator.evaluatePlayerIds).toHaveBeenCalledOnce();
    expect(fixture.rivalryUpdater.refreshAfterMatch).toHaveBeenCalledOnce();
    expect(fixture.challengeEvaluator.evaluatePlayerIds).toHaveBeenCalledOnce();
    expect(fixture.hallOfFameUpdater.refreshAfterVerifiedData).toHaveBeenCalledOnce();
    expect(fixture.notificationDelivery.createForLinkedPlayers).toHaveBeenCalledOnce();
    expect(result.recalculation.status).toBe("completed");
    expect(endSession).toHaveBeenCalledOnce();
  });

  it("rejects duplicate or non-sequential placements before any official write", async () => {
    const fixture = createFixture({ placements: [1, 1] });
    vi.spyOn(mongoose, "startSession").mockResolvedValue({
      withTransaction: async (callback) => callback(),
      endSession: vi.fn(),
    });

    await expect(
      fixture.service.verify({
        actor,
        matchId,
        reason: "Attempt invalid verification",
        requestMeta,
      }),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: "DUPLICATE_MATCH_RESULT",
    });

    expect(fixture.MatchResultModel.bulkWrite).not.toHaveBeenCalled();
    expect(fixture.statsService.recalculateForPlayerIds).not.toHaveBeenCalled();
    expect(fixture.match.status).toBe("needs_review");
  });

  it("preserves the verified source of truth and records a recoverable failure when recalculation fails", async () => {
    const fixture = createFixture({ statsFail: true });
    vi.spyOn(mongoose, "startSession").mockResolvedValue({
      withTransaction: async (callback) => callback(),
      endSession: vi.fn(),
    });

    const result = await fixture.service.verify({
      actor,
      matchId,
      reason: "Verified while testing recalculation recovery",
      requestMeta,
    });

    expect(fixture.match.status).toBe("verified");
    expect(result.recalculation).toMatchObject({
      status: "failed",
      errorCode: "STATISTICS_RECALCULATION_FAILED",
    });
    expect(fixture.MatchModel.updateOne).toHaveBeenCalledWith(
      { _id: matchId },
      expect.objectContaining({
        $set: expect.objectContaining({
          "statisticsRecalculation.status": "failed",
        }),
      }),
    );
    expect(fixture.achievementEvaluator.evaluatePlayerIds).not.toHaveBeenCalled();
    expect(fixture.challengeEvaluator.evaluatePlayerIds).not.toHaveBeenCalled();
  });
});
