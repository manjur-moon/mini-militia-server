import { describe, expect, it, vi } from "vitest";
import { createMatchReadService } from "../src/services/match-read.service.js";

class Query {
  constructor(value) {
    this.value = value;
  }
  sort() {
    return this;
  }
  skip() {
    return this;
  }
  limit() {
    return this;
  }
  select() {
    return this;
  }
  lean() {
    return Promise.resolve(this.value);
  }
}

const verifiedMatch = {
  _id: "000000000000000000000001",
  matchCode: "MT-20260720-00000001",
  status: "verified",
  screenshot: {
    publicId: "private-public-id",
    secureUrl: "https://example.com/match.jpg",
    format: "jpg",
    width: 1920,
    height: 1080,
    bytes: 1000,
    sha256: "private-checksum",
  },
  matchDate: new Date("2026-07-20T12:00:00.000Z"),
  timezone: "Asia/Dhaka",
  seasonId: null,
  participantCount: 2,
  verifiedResultCount: 2,
  currentRevision: 1,
  statisticsRecalculation: { status: "completed" },
  verification: { verifiedAt: new Date("2026-07-20T12:05:00.000Z") },
  uploadedBy: "private-uploader",
  createdAt: new Date("2026-07-20T12:00:00.000Z"),
};

describe("match read service", () => {
  it("forces unauthenticated match lists to verified status and public fields", async () => {
    const MatchModel = {
      find: vi.fn(() => new Query([verifiedMatch])),
      countDocuments: vi.fn(async () => 1),
    };
    const service = createMatchReadService({ MatchModel });
    const result = await service.list({
      actor: null,
      query: {
        page: 1,
        limit: 10,
        status: "rejected",
        sortBy: "matchDate",
        sortOrder: "desc",
      },
    });

    expect(MatchModel.find).toHaveBeenCalledWith({ status: "verified" });
    expect(result.items[0].uploadedBy).toBeUndefined();
    expect(result.items[0].screenshot.publicId).toBeUndefined();
    expect(result.items[0].screenshot.sha256).toBeUndefined();
  });

  it("allows moderators to use protected archive filters", async () => {
    const MatchModel = {
      find: vi.fn(() => new Query([{ ...verifiedMatch, status: "rejected" }])),
      countDocuments: vi.fn(async () => 1),
    };
    const service = createMatchReadService({ MatchModel });
    const result = await service.list({
      actor: { role: "moderator" },
      query: {
        page: 1,
        limit: 10,
        status: "rejected",
        sortBy: "createdAt",
        sortOrder: "desc",
      },
    });

    expect(MatchModel.find).toHaveBeenCalledWith({ status: "rejected" });
    expect(result.items[0].uploadedBy).toBe("private-uploader");
  });

  it("does not expose pending matches to public visitors", async () => {
    const MatchModel = {
      findById: vi.fn(() => new Query({ ...verifiedMatch, status: "needs_review" })),
    };
    const service = createMatchReadService({ MatchModel });
    await expect(
      service.get({ matchId: verifiedMatch._id, actor: null }),
    ).rejects.toMatchObject({ statusCode: 404, code: "MATCH_NOT_FOUND" });
  });

  it("returns only official result rows for public verified match details", async () => {
    const MatchModel = {
      findById: vi.fn(() => new Query(verifiedMatch)),
    };
    const MatchResultModel = {
      find: vi.fn(
        () =>
          new Query([
            {
              official: {
                playerId: "000000000000000000000011",
                playerName: "Ninja",
                kills: 20,
                deaths: 5,
                placement: 1,
              },
              extracted: { rawText: "private OCR" },
            },
          ]),
      ),
    };
    const PlayerModel = {
      find: vi.fn(
        () =>
          new Query([
            {
              _id: "000000000000000000000011",
              playerId: "MM001",
              name: "Ninja",
              profileImage: null,
              status: "active",
            },
          ]),
      ),
    };
    const service = createMatchReadService({
      MatchModel,
      MatchResultModel,
      PlayerModel,
    });
    const result = await service.get({ matchId: verifiedMatch._id, actor: null });

    expect(result.results[0]).toEqual({
      player: {
        id: "000000000000000000000011",
        playerId: "MM001",
        name: "Ninja",
        profileImage: null,
        status: "active",
      },
      kills: 20,
      deaths: 5,
      kdr: 4,
      placement: 1,
    });
    expect(result.results[0].extracted).toBeUndefined();
  });
});
