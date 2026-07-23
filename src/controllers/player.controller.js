import { playerService } from "../services/player.service.js";
import { sendPaginatedSuccess, sendSuccess } from "../utils/api-response.js";

function requestMeta(request) {
  return {
    requestId: request.id,
    ipAddress: request.ip,
    userAgent: request.get("user-agent") ?? null,
  };
}

export async function listPlayers(request, response) {
  const result = await playerService.listPlayers(request.validated.query);
  return sendPaginatedSuccess(response, {
    message: "Players retrieved successfully.",
    data: result.players,
    pagination: result.pagination,
  });
}

export async function createPlayer(request, response) {
  return sendSuccess(response, {
    statusCode: 201,
    message: "Player created successfully.",
    data: await playerService.createPlayer({
      actor: request.auth.user,
      input: request.validated.body,
      requestMeta: requestMeta(request),
    }),
  });
}

export async function getPlayer(request, response) {
  return sendSuccess(response, {
    message: "Player retrieved successfully.",
    data: await playerService.getPlayer(request.validated.params.playerId),
  });
}

export async function getLinkedPlayerProfile(request, response) {
  return sendSuccess(response, {
    message: "Linked player profile retrieved successfully.",
    data: await playerService.getLinkedProfile(request.auth.user),
  });
}

export async function getPlayerProfile(request, response) {
  return sendSuccess(response, {
    message: "Player profile retrieved successfully.",
    data: await playerService.getPublicProfile(request.validated.params.playerId),
  });
}

export async function updatePlayer(request, response) {
  return sendSuccess(response, {
    message: "Player updated successfully.",
    data: await playerService.updatePlayer({
      actor: request.auth.user,
      playerId: request.validated.params.playerId,
      input: request.validated.body,
      requestMeta: requestMeta(request),
    }),
  });
}

export async function updatePlayerStatus(request, response) {
  return sendSuccess(response, {
    message: "Player status updated successfully.",
    data: await playerService.updateStatus({
      actor: request.auth.user,
      playerId: request.validated.params.playerId,
      status: request.validated.body.status,
      reason: request.validated.body.reason,
      requestMeta: requestMeta(request),
    }),
  });
}

export async function uploadPlayerPhoto(request, response) {
  return sendSuccess(response, {
    message: "Player photo uploaded successfully.",
    data: await playerService.uploadPhoto({
      actor: request.auth.user,
      playerId: request.validated.params.playerId,
      file: request.file,
      requestMeta: requestMeta(request),
    }),
  });
}

export async function deletePlayerPhoto(request, response) {
  return sendSuccess(response, {
    message: "Player photo removed successfully.",
    data: await playerService.deletePhoto({
      actor: request.auth.user,
      playerId: request.validated.params.playerId,
      reason: request.validated.body.reason,
      requestMeta: requestMeta(request),
    }),
  });
}
