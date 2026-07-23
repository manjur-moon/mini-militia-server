import { challengeService } from "../services/challenge.service.js";
import { sendPaginatedSuccess, sendSuccess } from "../utils/api-response.js";

function requestMeta(request) {
  return {
    requestId: request.id,
    ipAddress: request.ip,
    userAgent: request.get("user-agent") ?? null,
  };
}

export async function listPublicChallenges(request, response) {
  return sendSuccess(response, {
    message: "Challenges retrieved successfully.",
    data: await challengeService.listPublic(request.validated.query),
  });
}

export async function getChallenge(request, response) {
  return sendSuccess(response, {
    message: "Challenge details retrieved successfully.",
    data: await challengeService.getPublic(request.validated.params.identifier),
  });
}

export async function getPlayerChallenges(request, response) {
  return sendSuccess(response, {
    message: "Player challenges retrieved successfully.",
    data: await challengeService.getPlayerChallenges(
      request.validated.params.playerId,
      request.validated.query,
    ),
  });
}

export async function listAdminChallenges(request, response) {
  const result = await challengeService.listAdmin(request.validated.query);
  return sendPaginatedSuccess(response, {
    message: "Challenge management list retrieved successfully.",
    data: result.items,
    pagination: result.pagination,
  });
}

export async function createChallenge(request, response) {
  return sendSuccess(response, {
    statusCode: 201,
    message: "Challenge created successfully.",
    data: await challengeService.create(
      request.validated.body,
      request.auth.user,
      requestMeta(request),
    ),
  });
}

export async function updateChallenge(request, response) {
  return sendSuccess(response, {
    message: "Challenge updated successfully.",
    data: await challengeService.update(
      request.validated.params.challengeId,
      request.validated.body,
      request.auth.user,
      requestMeta(request),
    ),
  });
}

export async function changeChallengeStatus(request, response) {
  return sendSuccess(response, {
    message: "Challenge status updated successfully.",
    data: await challengeService.changeStatus(
      request.validated.params.challengeId,
      request.validated.body,
      request.auth.user,
      requestMeta(request),
    ),
  });
}

export async function recalculateChallenges(request, response) {
  const { playerId, ...input } = request.validated.body;
  return sendSuccess(response, {
    message: "Challenge progress recalculated successfully.",
    data: await challengeService.evaluate(
      { ...input, playerCode: playerId },
      request.auth.user,
      requestMeta(request),
    ),
  });
}
