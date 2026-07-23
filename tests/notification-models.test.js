import { describe, expect, it } from "vitest";
import { Notification } from "../src/models/notification.model.js";

function baseNotification(overrides = {}) {
  return {
    userId: "user-1",
    type: "match_verified",
    title: "Match verified",
    message: "Your match result is now official.",
    relatedEntity: {
      entityType: "match",
      entityId: "64b64c6f2f5d4e1a2b3c4d5e",
    },
    ...overrides,
  };
}

describe("Notification model", () => {
  it("defaults to an unread system notification", async () => {
    const notification = new Notification(baseNotification());
    await expect(notification.validate()).resolves.toBeUndefined();
    expect(notification.isRead).toBe(false);
    expect(notification.readAt).toBeNull();
    expect(notification.source).toBe("system");
  });

  it("sets readAt when a notification is created as read", async () => {
    const notification = new Notification(baseNotification({ isRead: true }));
    await notification.validate();
    expect(notification.readAt).toBeInstanceOf(Date);
  });

  it("rejects external action URLs", async () => {
    await expect(
      new Notification(
        baseNotification({ actionUrl: "https://malicious.example/redirect" }),
      ).validate(),
    ).rejects.toThrow("actionUrl");
  });

  it("defines a unique partial deduplication index", () => {
    const index = Notification.schema
      .indexes()
      .find(([fields]) => fields.deduplicationKey === 1);
    expect(index?.[1]?.unique).toBe(true);
    expect(index?.[1]?.partialFilterExpression).toEqual({
      deduplicationKey: { $type: "string" },
    });
  });
});
