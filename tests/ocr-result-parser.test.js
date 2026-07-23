import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  OCR_PARSER_PROFILES,
  parseOCRText,
} from "../src/services/ocr/ocr-result-parser.js";

const scoreboards = JSON.parse(
  readFileSync(
    new URL("./fixtures/mini-militia-scoreboards.json", import.meta.url),
    "utf8",
  ),
);

describe("Mini Militia final-score OCR parser", () => {
  it.each(scoreboards)("parses $source ground-truth rows", (fixture) => {
    const result = parseOCRText({
      rawText: fixture.rawText,
      profile: OCR_PARSER_PROFILES.MINI_MILITIA_FINAL_SCORE,
      averageConfidence: 0.91,
    });

    expect(result.parserVersion).toBe(OCR_PARSER_PROFILES.MINI_MILITIA_FINAL_SCORE);
    expect(result.rows).toHaveLength(fixture.rows.length);
    expect(result.rows).toEqual(
      fixture.rows.map((row) => expect.objectContaining({ ...row, confidence: 0.91 })),
    );
  });

  it("recovers common OCR glyph confusion in numeric columns only", () => {
    const result = parseOCRText({
      rawText: "Littleboy 3b 25 +11\nRAFAYEL 1b 25 -9",
      profile: OCR_PARSER_PROFILES.MINI_MILITIA_FINAL_SCORE,
    });

    expect(result.rows).toEqual([
      expect.objectContaining({
        playerName: "Littleboy",
        kills: 36,
        deaths: 25,
        scoreDifference: 11,
        placement: 1,
      }),
      expect.objectContaining({
        playerName: "RAFAYEL",
        kills: 16,
        deaths: 25,
        scoreDifference: -9,
        placement: 2,
      }),
    ]);
  });

  it("does not invent rows without three trailing score columns", () => {
    const result = parseOCRText({
      rawText: "FINAL GAME SCORES\nNinja NOT READY\nTOTAL BP: 5050",
      profile: OCR_PARSER_PROFILES.MINI_MILITIA_FINAL_SCORE,
    });

    expect(result.rows).toHaveLength(0);
  });
});

describe("generic OCR result parser", () => {
  it("parses configurable placement-name-kills-deaths rows", () => {
    const result = parseOCRText({
      rawText: "Rank Player Kills Deaths\n1 Alpha Soldier 12 3\n2 Bravo 8 5",
      profile: OCR_PARSER_PROFILES.GENERIC,
      columnOrder: ["placement", "name", "kills", "deaths"],
      averageConfidence: 0.91,
    });

    expect(result.rows).toEqual([
      expect.objectContaining({
        playerName: "Alpha Soldier",
        placement: 1,
        kills: 12,
        deaths: 3,
        confidence: 0.91,
      }),
      expect.objectContaining({
        playerName: "Bravo",
        placement: 2,
        kills: 8,
        deaths: 5,
      }),
    ]);
  });

  it("supports a different configured column order", () => {
    const result = parseOCRText({
      rawText: "Alpha Soldier 15 4 1",
      profile: OCR_PARSER_PROFILES.GENERIC,
      columnOrder: ["name", "kills", "deaths", "placement"],
      averageConfidence: 0.8,
    });

    expect(result.rows[0]).toMatchObject({
      playerName: "Alpha Soldier",
      kills: 15,
      deaths: 4,
      placement: 1,
    });
  });
});
