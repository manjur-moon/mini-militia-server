import { describe, expect, it } from "vitest";
import { validateCorrectionRows } from "../src/services/match-revision.service.js";

const row = (resultId, playerId, placement) => ({
  resultId,
  playerId,
  placement,
  kills: 10,
  deaths: 5,
});

describe("verified match correction validation", () => {
  it("accepts a complete unique result snapshot", () => {
    expect(() =>
      validateCorrectionRows(
        [
          row("000000000000000000000001", "000000000000000000000011", 1),
          row("000000000000000000000002", "000000000000000000000012", 2),
        ],
        2,
      ),
    ).not.toThrow();
  });

  it("rejects duplicate players or result identifiers", () => {
    expect(() =>
      validateCorrectionRows(
        [
          row("000000000000000000000001", "000000000000000000000011", 1),
          row("000000000000000000000002", "000000000000000000000011", 2),
        ],
        2,
      ),
    ).toThrowError(expect.objectContaining({ code: "CORRECTION_INVALID" }));
  });

  it("rejects gaps in the official placement sequence", () => {
    expect(() =>
      validateCorrectionRows(
        [
          row("000000000000000000000001", "000000000000000000000011", 1),
          row("000000000000000000000002", "000000000000000000000012", 3),
        ],
        2,
      ),
    ).toThrowError(expect.objectContaining({ code: "PLACEMENT_SEQUENCE_INVALID" }));
  });
});
