import { achievementService } from "../services/achievement.service.js";
import { sendPaginatedSuccess, sendSuccess } from "../utils/api-response.js";

function requestMeta(request) {
  return {
    requestId: request.id,
    ipAddress: request.ip,
    userAgent: request.get("user-agent") ?? null,
  };
}

export async function listPublicAchievements(request, response) {
  return sendSuccess(response, {
    message: "Achievements retrieved successfully.",
    data: await achievementService.listPublicDefinitions(request.validated.query),
  });
}

export async function getPublicAchievement(request, response) {
  return sendSuccess(response, {
    message: "Achievement details retrieved successfully.",
    data: await achievementService.getPublicDefinition(request.validated.params.code),
  });
}

export async function getPlayerAchievements(request, response) {
  return sendSuccess(response, {
    message: "Player achievements retrieved successfully.",
    data: await achievementService.getPlayerAchievements(
      request.validated.params.playerId,
      request.validated.query,
    ),
  });
}

export async function listAchievementDefinitions(request, response) {
  const result = await achievementService.listDefinitions(request.validated.query);
  return sendPaginatedSuccess(response, {
    message: "Achievement definitions retrieved successfully.",
    data: result.items,
    pagination: result.pagination,
  });
}

export async function createAchievementDefinition(request, response) {
  return sendSuccess(response, {
    statusCode: 201,
    message: "Achievement definition created successfully.",
    data: await achievementService.createDefinition(
      request.validated.body,
      request.auth.user,
      requestMeta(request),
    ),
  });
}

export async function createAchievementRevision(request, response) {
  return sendSuccess(response, {
    statusCode: 201,
    message: "Achievement revision created successfully.",
    data: await achievementService.createRevision(
      request.validated.params.achievementId,
      request.validated.body,
      request.auth.user,
      requestMeta(request),
    ),
  });
}

export async function activateAchievementDefinition(request, response) {
  return sendSuccess(response, {
    message: "Achievement definition activated successfully.",
    data: await achievementService.activateDefinition(
      request.validated.params.achievementId,
      request.validated.body,
      request.auth.user,
      requestMeta(request),
    ),
  });
}

export async function deactivateAchievementDefinition(request, response) {
  return sendSuccess(response, {
    message: "Achievement definition deactivated successfully.",
    data: await achievementService.deactivateDefinition(
      request.validated.params.achievementId,
      request.validated.body,
      request.auth.user,
      requestMeta(request),
    ),
  });
}

export async function recalculateAchievements(request, response) {
  const { playerId, ...input } = request.validated.body;
  return sendSuccess(response, {
    message: "Achievements recalculated successfully.",
    data: await achievementService.evaluate(
      { ...input, playerCode: playerId },
      request.auth.user,
      requestMeta(request),
    ),
  });
}
