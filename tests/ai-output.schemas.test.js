import { describe, expect, it } from "vitest";
import {
  matchNarrativeSchema,
  periodNarrativeSchema,
  playerNarrativeSchema,
  validateNarrativeSafety,
} from "../src/services/ai/ai-output.schemas.js";

describe("AI output schemas", () => {
  it("accepts a bounded period narrative", () => {
    const result = periodNarrativeSchema.safeParse({
      headline: "Alpha leads the verified week",
      summary: "The supplied verified statistics show a competitive weekly period.",
      highlights: ["Three verified matches were included."],
      watchNext: ["Monitor whether the current leader maintains form."],
      topPerformerReasons: [{ playerId: "MM001", reason: "Led the supplied table." }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown player references during safety validation", () => {
    expect(
      validateNarrativeSafety(
        { topPerformerReasons: [{ playerId: "MM999", reason: "Unknown." }] },
        ["MM001"],
      ),
    ).toContain("AI output referenced unknown player MM999.");
  });

  it("detects URL and email-like output", () => {
    const warnings = validateNarrativeSafety({ summary: "Visit https://example.com" });
    expect(warnings).toHaveLength(1);
  });

  it("requires a controlled player trend classification", () => {
    const result = playerNarrativeSchema.safeParse({
      headline: "Player review",
      summary: "The verified sample supports a focused performance review.",
      trendAssessment: "unstoppable",
      strengths: [],
      improvements: [],
      trainingFocus: [],
    });
    expect(result.success).toBe(false);
  });

  it("accepts scoreboard-only match insight fields", () => {
    const result = matchNarrativeSchema.safeParse({
      headline: "Alpha wins the verified match",
      summary: "Alpha finished first in the supplied verified scoreboard.",
      turningPoints: ["Alpha recorded the best placement."],
      standoutReasons: [{ playerId: "MM001", reason: "Finished first." }],
      highlights: ["MM001 recorded 10 kills."],
    });
    expect(result.success).toBe(true);
  });
});
