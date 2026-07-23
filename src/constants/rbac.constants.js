import { USER_ROLES } from "@mini-militia/shared";

export const ROLE_VALUES = Object.freeze(Object.values(USER_ROLES));

export const ROLE_PERMISSIONS = Object.freeze({
  [USER_ROLES.PLAYER]: Object.freeze([
    "profile:read:self",
    "statistics:read:self",
    "matches:read:self",
  ]),
  [USER_ROLES.MODERATOR]: Object.freeze([
    "profile:read:self",
    "statistics:read:self",
    "matches:read:self",
    "matches:upload",
    "matches:review",
    "matches:verify",
    "ocr:retry",
  ]),
  [USER_ROLES.ADMIN]: Object.freeze([
    "*",
    "users:read",
    "users:manage-role",
    "users:manage-status",
    "users:link-player",
  ]),
});

export function roleHasPermission(role, permission) {
  const permissions = ROLE_PERMISSIONS[role] ?? [];
  return permissions.includes("*") || permissions.includes(permission);
}
