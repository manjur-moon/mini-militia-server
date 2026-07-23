import { describe, expect, it } from "vitest";
import { resolveNotificationActionUrl } from "../src/services/notification.service.js";

describe("Notification action routing", () => {
  it("prefers a validated explicit internal route", () => {
    expect(
      resolveNotificationActionUrl({
        type: "system_announcement",
        actionUrl: "/seasons/season-one",
      }),
    ).toBe("/seasons/season-one");
  });

  it("derives match routes from event data", () => {
    expect(
      resolveNotificationActionUrl({
        type: "match_verified",
        data: { matchId: "match-1" },
      }),
    ).toBe("/matches/match-1");
  });

  it("ignores unsafe protocol-relative routes", () => {
    expect(
      resolveNotificationActionUrl({
        type: "system_announcement",
        actionUrl: "//malicious.example/path",
      }),
    ).toBeNull();
  });

  it("routes season events to the public season page", () => {
    expect(
      resolveNotificationActionUrl({
        type: "season_started",
        data: { slug: "season-one" },
      }),
    ).toBe("/seasons/season-one");
  });
});
