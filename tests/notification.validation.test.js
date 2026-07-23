import { describe, expect, it } from "vitest";
import {
  createAdminNotificationSchema,
  listAdminNotificationsSchema,
  listNotificationsSchema,
  markNotificationReadSchema,
} from "../src/validators/notification.validation.js";

const notificationId = "64b64c6f2f5d4e1a2b3c4d5e";

describe("Notification validation", () => {
  it("applies safe list defaults", () => {
    const result = listNotificationsSchema.safeParse({
      body: {},
      params: {},
      query: {},
    });
    expect(result.success).toBe(true);
    expect(result.data.query).toMatchObject({
      page: 1,
      limit: 20,
      readStatus: "all",
      sortOrder: "desc",
    });
  });

  it("accepts an owned notification read request", () => {
    const result = markNotificationReadSchema.safeParse({
      body: {},
      params: { notificationId },
      query: {},
    });
    expect(result.success).toBe(true);
  });

  it("rejects external admin action URLs", () => {
    const result = createAdminNotificationSchema.safeParse({
      body: {
        userIdentifier: "player@example.com",
        title: "League notice",
        message: "A new match schedule is available.",
        actionUrl: "https://example.com",
        reason: "Send the approved league notice.",
      },
      params: {},
      query: {},
    });
    expect(result.success).toBe(false);
  });

  it("validates admin date-filter ordering", () => {
    const result = listAdminNotificationsSchema.safeParse({
      body: {},
      params: {},
      query: {
        dateFrom: "2026-07-21T12:00:00.000Z",
        dateTo: "2026-07-20T12:00:00.000Z",
      },
    });
    expect(result.success).toBe(false);
  });
});
