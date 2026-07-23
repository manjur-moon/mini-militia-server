import { describe, expect, it } from "vitest";
import {
  renderAchievementShareSvg,
  renderPlayerProfileShareSvg,
  renderWeeklyMvpShareSvg,
} from "../src/services/social-card-renderer.service.js";

const player = { playerId: "MM001", name: "Ninja & Boss" };

describe("social-card renderer", () => {
  it("renders a safe 1200x630 public profile image", () => {
    const svg = renderPlayerProfileShareSvg({
      title: "Ninja & Boss — Profile",
      description: "Verified profile",
      player,
      statistics: {
        matchesPlayed: 10,
        totalKills: 120,
        kdr: 2.5,
        firstPlaceCount: 3,
        globalRank: 2,
      },
    });

    expect(svg).toContain('viewBox="0 0 1200 630"');
    expect(svg).toContain("Ninja &amp; Boss");
    expect(svg).toContain(">120<");
    expect(svg).not.toContain("Ninja & Boss");
  });

  it("renders achievement and weekly MVP artwork", () => {
    const achievementSvg = renderAchievementShareSvg({
      title: "Achievement unlocked",
      description: "Reach 100 kills",
      player,
      achievement: {
        name: "100 Kills Club",
        description: "Reach 100 kills",
        category: "kills",
        targetValue: 100,
        version: "v1",
      },
      unlockedAt: "2026-07-20T00:00:00.000Z",
    });
    const mvpSvg = renderWeeklyMvpShareSvg({
      period: { label: "Week of July 20" },
      award: {
        player,
        score: 87.25,
        formulaVersion: "mvp-v1",
        scoreBreakdown: { killScore: 50, placementBonus: 25 },
      },
    });

    expect(achievementSvg).toContain("100 Kills Club");
    expect(achievementSvg).toContain("2026-07-20");
    expect(mvpSvg).toContain("Weekly MVP");
    expect(mvpSvg).toContain("87.25");
  });
});
