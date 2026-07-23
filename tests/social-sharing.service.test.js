import { describe, expect, it, vi } from "vitest";
import { createSocialSharingService } from "../src/services/social-sharing.service.js";

class Query {
  constructor(value) {
    this.value = value;
  }
  select() {
    return this;
  }
  lean() {
    return Promise.resolve(this.value);
  }
}

const player = {
  _id: "507f1f77bcf86cd799439011",
  playerId: "MM001",
  name: "Ninja",
  status: "active",
  joinDate: new Date("2026-01-01T00:00:00.000Z"),
  profileImage: { secureUrl: "https://res.cloudinary.com/demo/ninja.webp" },
};

function buildService({ achievement = null, award = null } = {}) {
  return createSocialSharingService({
    PlayerModel: { findOne: vi.fn(() => new Query(player)) },
    PlayerStatisticsModel: {
      findOne: vi.fn(
        () =>
          new Query({
            metrics: {
              matchesPlayed: 12,
              totalKills: 144,
              totalDeaths: 60,
              kdr: 2.4,
              firstPlaceCount: 4,
              winRate: 33.33,
            },
            globalRank: 2,
          }),
      ),
    },
    PlayerAchievementModel: {
      findOne: vi.fn(() => new Query(achievement)),
    },
    mvp: {
      getCurrentAward: vi.fn(async () => ({
        period: { label: "Week 29", key: "2026-W29" },
        award,
      })),
    },
  });
}

describe("social-sharing service", () => {
  it("returns a private-data-safe player profile share payload", async () => {
    const data = await buildService().getPlayerProfile("MM001");

    expect(data.player).toMatchObject({ playerId: "MM001", name: "Ninja" });
    expect(data.statistics).toMatchObject({ totalKills: 144, globalRank: 2 });
    expect(data.urls.shareUrl).toContain("/share/players/MM001/profile");
    expect(data.player).not.toHaveProperty("linkedUserId");
  });

  it("shares only unlocked achievements", async () => {
    const data = await buildService({
      achievement: {
        achievementSnapshot: {
          code: "KILLS_CLUB_100",
          version: "v1",
          name: "100 Kills Club",
          description: "Reach 100 kills.",
          category: "kills",
          targetValue: 100,
        },
        unlockedAt: new Date("2026-07-20T00:00:00.000Z"),
      },
    }).getAchievement("MM001", "KILLS_CLUB_100");

    expect(data.achievement.code).toBe("KILLS_CLUB_100");
    expect(data.urls.imageUrl).toContain("KILLS_CLUB_100/image.png");
  });

  it("returns weekly MVP metadata from the centralized MVP service", async () => {
    const data = await buildService({
      award: {
        player,
        score: 88.5,
        formulaVersion: "mvp-v1",
        scoreBreakdown: {},
      },
    }).getWeeklyMvp();

    expect(data.type).toBe("weekly_mvp");
    expect(data.title).toContain("Ninja");
    expect(data.urls.shareUrl).toContain("/share/mvp/weekly");
  });
});
