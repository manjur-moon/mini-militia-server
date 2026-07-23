import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { Season } from "../src/models/season.model.js";

function baseSeason(overrides = {}) {
  return {
    name: "Season One",
    slug: "season-one",
    description: "First competitive season.",
    startAt: new Date("2026-01-01T00:00:00.000Z"),
    endAt: new Date("2026-02-01T00:00:00.000Z"),
    timezone: "UTC",
    status: "draft",
    createdBy: "user-1",
    updatedBy: "user-1",
    ...overrides,
  };
}

describe("Season model", () => {
  it("validates a draft season", async () => {
    await expect(new Season(baseSeason()).validate()).resolves.toBeUndefined();
  });

  it("rejects an invalid date range", async () => {
    await expect(
      new Season(
        baseSeason({
          startAt: new Date("2026-02-01T00:00:00.000Z"),
          endAt: new Date("2026-01-01T00:00:00.000Z"),
        }),
      ).validate(),
    ).rejects.toThrow("endAt");
  });

  it("requires activatedAt for an active season", async () => {
    await expect(
      new Season(baseSeason({ status: "active" })).validate(),
    ).rejects.toThrow("activatedAt");
  });

  it("validates a completed season finalization state", async () => {
    await expect(
      new Season(
        baseSeason({
          status: "completed",
          completedAt: new Date("2026-02-01T00:00:00.000Z"),
          championPlayerId: new mongoose.Types.ObjectId(),
          finalization: {
            status: "completed",
            version: "season-finalization-v1",
            startedAt: new Date("2026-02-01T00:00:00.000Z"),
            completedAt: new Date("2026-02-01T00:01:00.000Z"),
            errorCode: null,
          },
        }),
      ).validate(),
    ).resolves.toBeUndefined();
  });

  it("requires archivedAt for archived seasons", async () => {
    await expect(
      new Season(
        baseSeason({
          status: "archived",
          completedAt: new Date("2026-02-01T00:00:00.000Z"),
        }),
      ).validate(),
    ).rejects.toThrow("archivedAt");
  });
});
