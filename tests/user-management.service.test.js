import { describe, expect, it, vi } from "vitest";
import { createUserManagementService } from "../src/services/user-management.service.js";

function createRepository(overrides = {}) {
  const insertOne = vi.fn().mockResolvedValue({ acknowledged: true });
  return {
    findById: vi.fn(),
    countActiveAdminsExcluding: vi.fn().mockResolvedValue(1),
    updateById: vi.fn(),
    revokeSessions: vi.fn().mockResolvedValue({ deletedCount: 1 }),
    audits: vi.fn(() => ({ insertOne })),
    list: vi.fn(),
    players: vi.fn(),
    ...overrides,
    insertOne,
  };
}

const actor = { id: "actor-admin", role: "admin" };
const requestMeta = { requestId: "request-1", ipAddress: "127.0.0.1" };

describe("user management safeguards", () => {
  it("prevents demoting the last active admin", async () => {
    const repository = createRepository({
      findById: vi.fn().mockResolvedValue({
        _id: "admin-1",
        role: "admin",
        status: "active",
      }),
      countActiveAdminsExcluding: vi.fn().mockResolvedValue(0),
    });
    const service = createUserManagementService({ repository });

    await expect(
      service.changeRole({
        actor,
        userId: "admin-1",
        role: "moderator",
        reason: "Role rotation",
        requestMeta,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "LAST_ACTIVE_ADMIN_PROTECTED",
    });

    expect(repository.updateById).not.toHaveBeenCalled();
  });

  it("prevents deactivating the last active admin", async () => {
    const repository = createRepository({
      findById: vi.fn().mockResolvedValue({
        _id: "admin-1",
        role: "admin",
        status: "active",
      }),
      countActiveAdminsExcluding: vi.fn().mockResolvedValue(0),
    });
    const service = createUserManagementService({ repository });

    await expect(
      service.changeStatus({
        actor,
        userId: "admin-1",
        status: "inactive",
        reason: "Account review",
        requestMeta,
      }),
    ).rejects.toMatchObject({ code: "LAST_ACTIVE_ADMIN_PROTECTED" });
  });

  it("updates a role, revokes sessions and writes an audit record", async () => {
    const current = {
      _id: "user-1",
      name: "League Moderator",
      email: "moderator@example.com",
      role: "moderator",
      status: "active",
    };
    const repository = createRepository({
      findById: vi.fn().mockResolvedValue(current),
      updateById: vi.fn().mockResolvedValue({ ...current, role: "admin" }),
    });
    const service = createUserManagementService({ repository });

    const result = await service.changeRole({
      actor,
      userId: "user-1",
      role: "admin",
      reason: "Promoted for league administration",
      requestMeta,
    });

    expect(result.role).toBe("admin");
    expect(repository.revokeSessions).toHaveBeenCalledWith("user-1");
    expect(repository.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "user.role_changed",
        actorUserId: "actor-admin",
        previousValue: { role: "moderator" },
        newValue: { role: "admin" },
      }),
    );
  });
});
