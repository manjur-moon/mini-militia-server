import { describe, expect, it } from "vitest";
import { createPlayerMatcher } from "../src/services/ocr/player-matcher.service.js";

class FakeQuery {
  constructor(values) {
    this.values = values;
  }
  select() {
    return this;
  }
  lean() {
    return Promise.resolve(this.values);
  }
}

const players = [
  {
    _id: "1",
    playerId: "MM001",
    name: "Alpha Soldier",
    normalizedName: "alpha soldier",
    aliases: ["alpha"],
  },
  {
    _id: "2",
    playerId: "MM002",
    name: "Bravo King",
    normalizedName: "bravo king",
    aliases: ["bravo"],
  },
];

const PlayerModel = { find: () => new FakeQuery(players) };

describe("OCR player matcher", () => {
  it("returns exact and alias suggestions without confirming them", async () => {
    const matcher = createPlayerMatcher({ PlayerModel });
    const [exact, alias] = await matcher.matchNames(["Alpha Soldier", "bravo"]);

    expect(exact).toMatchObject({ status: "exact", suggestedPlayerId: "1" });
    expect(alias).toMatchObject({ status: "alias", suggestedPlayerId: "2" });
    expect(exact.status).not.toBe("confirmed");
  });

  it("returns none when the extracted name is not sufficiently similar", async () => {
    const matcher = createPlayerMatcher({ PlayerModel });
    const [result] = await matcher.matchNames(["Unknown Combatant"]);

    expect(result.status).toBe("none");
    expect(result.suggestedPlayerId).toBeNull();
  });
});
