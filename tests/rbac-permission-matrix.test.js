import { describe, expect, it } from "vitest";
import {
  ROLE_PERMISSIONS,
  roleHasPermission,
} from "../src/constants/rbac.constants.js";

const expectations = [
  ["player", "profile:read:self", true],
  ["player", "matches:upload", false],
  ["player", "matches:verify", false],
  ["player", "users:manage-role", false],
  ["moderator", "matches:upload", true],
  ["moderator", "matches:review", true],
  ["moderator", "matches:verify", true],
  ["moderator", "users:manage-role", false],
  ["moderator", "users:manage-status", false],
  ["admin", "matches:verify", true],
  ["admin", "users:manage-role", true],
  ["admin", "users:link-player", true],
];

describe("RBAC permission matrix", () => {
  it.each(expectations)(
    "%s permission %s resolves to %s",
    (role, permission, expected) => {
      expect(roleHasPermission(role, permission)).toBe(expected);
    },
  );

  it("defaults unknown roles to no permissions", () => {
    expect(roleHasPermission("unknown", "matches:verify")).toBe(false);
  });

  it("keeps player and moderator permissions free from wildcard access", () => {
    expect(ROLE_PERMISSIONS.player).not.toContain("*");
    expect(ROLE_PERMISSIONS.moderator).not.toContain("*");
    expect(ROLE_PERMISSIONS.admin).toContain("*");
  });
});
