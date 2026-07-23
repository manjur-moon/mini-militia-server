import { userManagementService } from "../services/user-management.service.js";
import { sendPaginatedSuccess, sendSuccess } from "../utils/api-response.js";

function requestMeta(request) {
  return {
    requestId: request.id,
    ipAddress: request.ip,
    userAgent: request.get("user-agent") ?? null,
  };
}

export async function listUsers(request, response) {
  const result = await userManagementService.listUsers(request.validated.query);
  return sendPaginatedSuccess(response, {
    message: "Users retrieved successfully.",
    data: result.users,
    pagination: result.pagination,
  });
}

export async function getUser(request, response) {
  return sendSuccess(response, {
    message: "User retrieved successfully.",
    data: await userManagementService.getUser(request.validated.params.userId),
  });
}

export async function updateUserRole(request, response) {
  const { role, reason } = request.validated.body;
  return sendSuccess(response, {
    message: "User role updated successfully. Existing sessions were revoked.",
    data: await userManagementService.changeRole({
      actor: request.auth.user,
      userId: request.validated.params.userId,
      role,
      reason,
      requestMeta: requestMeta(request),
    }),
  });
}

export async function updateUserStatus(request, response) {
  const { status, reason } = request.validated.body;
  return sendSuccess(response, {
    message:
      "User account status updated successfully. Existing sessions were revoked.",
    data: await userManagementService.changeStatus({
      actor: request.auth.user,
      userId: request.validated.params.userId,
      status,
      reason,
      requestMeta: requestMeta(request),
    }),
  });
}

export async function linkUserPlayer(request, response) {
  const { playerId, reason } = request.validated.body;
  return sendSuccess(response, {
    message: "User and player profile linked successfully.",
    data: await userManagementService.linkPlayer({
      actor: request.auth.user,
      userId: request.validated.params.userId,
      playerIdentifier: playerId,
      reason,
      requestMeta: requestMeta(request),
    }),
  });
}

export async function unlinkUserPlayer(request, response) {
  return sendSuccess(response, {
    message: "User and player profile unlinked successfully.",
    data: await userManagementService.unlinkPlayer({
      actor: request.auth.user,
      userId: request.validated.params.userId,
      reason: request.validated.body.reason,
      requestMeta: requestMeta(request),
    }),
  });
}
