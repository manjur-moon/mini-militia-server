import { describe, expect, it } from "vitest";
import { createPlayerSchema } from "../src/validators/player.validation.js";
import {
  matchDecisionSchema,
  reviewMatchSchema,
  uploadMatchSchema,
} from "../src/validators/match.validation.js";
import { createMvpConfigSchema } from "../src/validators/mvp.validation.js";
import { updateRoleSchema } from "../src/validators/user.validation.js";

const objectId = "64b64c1f4f0f4f0f4f0f4f0f";

function requestShape(body, params = {}, query = {}) {
  return { body, params, query };
}

describe("critical request validation hardening", () => {
  it("prevents clients from supplying a player ID or ownership fields", () => {
    const result = createPlayerSchema.safeParse(
      requestShape({
        playerId: "MM999",
        name: "Alpha Soldier",
        aliases: [],
        joinDate: "2026-07-20T00:00:00.000Z",
        status: "active",
        createdBy: "attacker",
      }),
    );

    expect(result.success).toBe(false);
    expect(
      result.error.issues.some((issue) => issue.code === "unrecognized_keys"),
    ).toBe(true);
  });

  it("rejects unsupported upload fields and unsafe participant counts", () => {
    const unsupported = uploadMatchSchema.safeParse(
      requestShape({
        matchDate: "2026-07-20T00:00:00.000Z",
        timezone: "Asia/Dhaka",
        participantCount: 4,
        status: "verified",
      }),
    );
    const invalidCount = uploadMatchSchema.safeParse(
      requestShape({
        matchDate: "2026-07-20T00:00:00.000Z",
        timezone: "Asia/Dhaka",
        participantCount: 1,
      }),
    );

    expect(unsupported.success).toBe(false);
    expect(invalidCount.success).toBe(false);
  });

  it("rejects negative scores and duplicate-looking client-calculated fields", () => {
    const result = reviewMatchSchema.safeParse(
      requestShape(
        {
          matchDate: "2026-07-20T00:00:00.000Z",
          timezone: "Asia/Dhaka",
          participantCount: 2,
          reason: "Moderator review",
          rows: [
            {
              playerId: objectId,
              kills: -1,
              deaths: 2,
              placement: 1,
              kdr: 999,
            },
            {
              playerId: "74b64c1f4f0f4f0f4f0f4f0f",
              kills: 5,
              deaths: 4,
              placement: 2,
            },
          ],
        },
        { matchId: objectId },
      ),
    );

    expect(result.success).toBe(false);
  });

  it("requires an auditable reason for verification and rejection", () => {
    const result = matchDecisionSchema.safeParse(
      requestShape({ reason: "" }, { matchId: objectId }),
    );

    expect(result.success).toBe(false);
  });

  it("does not allow a role-change payload to include status or linked player data", () => {
    const result = updateRoleSchema.safeParse(
      requestShape(
        {
          role: "admin",
          reason: "Approved role change",
          status: "active",
          linkedPlayerId: objectId,
        },
        { userId: "user-1" },
      ),
    );

    expect(result.success).toBe(false);
  });

  it("bounds MVP weights and rejects hidden formula fields", () => {
    const result = createMvpConfigSchema.safeParse(
      requestShape({
        version: "mvp-v2",
        name: "Unsafe formula",
        description: "QA validation",
        minimumMatches: 3,
        weights: {
          killWeight: 1,
          deathPenalty: 0.3,
          firstPlaceBonus: 15,
          secondPlaceBonus: 8,
          thirdPlaceBonus: 4,
          kdrBonusWeight: 5,
          maximumKdrBonus: 20,
          activityWeight: 1,
          maximumActivityBonus: 10,
          arbitraryExecutionWeight: 1,
        },
        reason: "Test formula validation",
      }),
    );

    expect(result.success).toBe(false);
  });
});
