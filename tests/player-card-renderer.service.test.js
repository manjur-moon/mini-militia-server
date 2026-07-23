import { describe, expect, it } from "vitest";
import { renderPlayerCardSvg } from "../src/services/player-card-renderer.service.js";

const card = {
  player: { playerId: "MM001", name: "Ninja & Boss" },
  title: { name: "King Slayer" },
  ratings: {
    attack: 88.4,
    survival: 75.6,
    consistency: 71.2,
    activity: 93.9,
    overall: 84.7,
  },
  kdr: 2.3456,
  minimumMatchesMet: true,
  formulaVersion: "rating-v1",
};

describe("player-card SVG renderer", () => {
  it("renders a safe 1200x1500 card with verified rating values", () => {
    const svg = renderPlayerCardSvg(card);

    expect(svg).toContain('viewBox="0 0 1200 1500"');
    expect(svg).toContain("Ninja &amp; Boss");
    expect(svg).toContain("King Slayer");
    expect(svg).toContain(">85<");
    expect(svg).toContain(">2.35<");
    expect(svg).not.toContain("Ninja & Boss");
  });

  it("embeds a supplied data URI and clamps invalid ratings", () => {
    const svg = renderPlayerCardSvg(
      {
        ...card,
        ratings: { ...card.ratings, overall: Number.POSITIVE_INFINITY, attack: 150 },
      },
      { embeddedPhotoDataUri: "data:image/png;base64,Y2FyZA==" },
    );

    expect(svg).toContain("data:image/png;base64,Y2FyZA==");
    expect(svg).toContain(">0<");
    expect(svg).toContain(">100<");
  });
});
