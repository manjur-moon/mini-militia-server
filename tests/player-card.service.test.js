import { describe, expect, it, vi } from "vitest";
import { createPlayerCardService } from "../src/services/player-card.service.js";

class Query {
  constructor(value) {
    this.value = value;
  }
  select() {
    return this;
  }
  populate() {
    return this;
  }
  lean() {
    return Promise.resolve(this.value);
  }
}

function buildService({ title = null, fetchImpl } = {}) {
  const player = {
    _id: "507f1f77bcf86cd799439011",
    playerId: "MM001",
    name: "Ninja",
    profileImage: {
      secureUrl: "https://res.cloudinary.com/demo/image/upload/ninja.webp",
      publicId: "players/ninja",
    },
    status: "active",
    joinDate: new Date("2026-01-01T00:00:00.000Z"),
  };

  return createPlayerCardService({
    PlayerModel: { findOne: vi.fn(() => new Query(player)) },
    PlayerStatisticsModel: {
      findOne: vi.fn(() => new Query({ metrics: { kdr: 1.75 } })),
    },
    PlayerTitleModel: { findOne: vi.fn(() => new Query(title)) },
    ratings: {
      getPlayerRating: vi.fn(async () => ({
        period: { type: "all_time", key: "all-time", label: "All time" },
        formulaVersion: "rating-v1",
        rating: {
          ratings: {
            attack: 80,
            survival: 70,
            consistency: 75,
            activity: 90,
            overall: 79,
          },
          rank: 2,
          sampleSize: 12,
          minimumMatchesMet: true,
          confidenceFactor: 1,
        },
      })),
    },
    fetchImpl,
  });
}

describe("player-card service", () => {
  it("combines player, rating, KDR, title and public URLs", async () => {
    const service = buildService({
      title: {
        titleId: { code: "KING_SLAYER", name: "King Slayer", icon: "crown" },
      },
    });

    const card = await service.getCard({ playerCode: "MM001" });

    expect(card.player.playerId).toBe("MM001");
    expect(card.title).toMatchObject({ code: "KING_SLAYER", name: "King Slayer" });
    expect(card.ratings.overall).toBe(79);
    expect(card.kdr).toBe(1.75);
    expect(card.urls.shareUrl).toContain("/share/players/MM001/card");
    expect(card.urls.imageUrl).toContain("/card/image.png");
    expect(card.urls.svgUrl).toContain("/card/image.svg");
  });

  it("uses the documented fallback title before dynamic titles are awarded", async () => {
    const card = await buildService().getCard({ playerCode: "MM001" });
    expect(card.title).toMatchObject({
      code: "LEAGUE_COMPETITOR",
      name: "League Competitor",
      source: "fallback",
    });
  });

  it("embeds only supported HTTPS images within the size limit", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      headers: new Headers({
        "content-type": "image/webp",
        "content-length": "4",
      }),
      arrayBuffer: async () => Uint8Array.from([1, 2, 3, 4]).buffer,
    }));
    const service = buildService({ fetchImpl });

    await expect(
      service.fetchEmbeddedPhotoDataUri(
        "https://res.cloudinary.com/demo/image/upload/ninja.webp",
      ),
    ).resolves.toBe("data:image/webp;base64,AQIDBA==");
    await expect(
      service.fetchEmbeddedPhotoDataUri(
        "http://res.cloudinary.com/demo/image/upload/ninja.webp",
      ),
    ).resolves.toBeNull();
  });
});
