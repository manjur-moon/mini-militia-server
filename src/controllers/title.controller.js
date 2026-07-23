import { titleService } from "../services/title.service.js";
import { sendPaginatedSuccess, sendSuccess } from "../utils/api-response.js";

function requestMeta(request) {
  return {
    requestId: request.id,
    ipAddress: request.ip,
    userAgent: request.get("user-agent") ?? null,
  };
}

export async function listPublicTitles(_request, response) {
  return sendSuccess(response, {
    message: "Dynamic titles retrieved successfully.",
    data: await titleService.listPublicDefinitions(),
  });
}

export async function getPublicTitle(request, response) {
  return sendSuccess(response, {
    message: "Dynamic-title details retrieved successfully.",
    data: await titleService.getPublicDefinition(request.validated.params.code),
  });
}

export async function getPlayerCurrentTitle(request, response) {
  return sendSuccess(response, {
    message: "Current player title retrieved successfully.",
    data: await titleService.getPlayerCurrent(request.validated.params.playerId),
  });
}

export async function getPlayerTitleHistory(request, response) {
  const result = await titleService.getPlayerHistory({
    playerCode: request.validated.params.playerId,
    ...request.validated.query,
  });
  return sendPaginatedSuccess(response, {
    message: "Player title history retrieved successfully.",
    data: result.items,
    pagination: result.pagination,
    meta: { player: result.player },
  });
}

export async function listTitleDefinitions(request, response) {
  const result = await titleService.listDefinitions(request.validated.query);
  return sendPaginatedSuccess(response, {
    message: "Dynamic-title definitions retrieved successfully.",
    data: result.items,
    pagination: result.pagination,
  });
}

export async function createTitleDefinition(request, response) {
  return sendSuccess(response, {
    statusCode: 201,
    message: "Dynamic-title definition created successfully.",
    data: await titleService.createDefinition(
      request.validated.body,
      request.auth.user,
      requestMeta(request),
    ),
  });
}

export async function createTitleRevision(request, response) {
  return sendSuccess(response, {
    statusCode: 201,
    message: "Dynamic-title revision created successfully.",
    data: await titleService.createRevision(
      request.validated.params.titleId,
      request.validated.body,
      request.auth.user,
      requestMeta(request),
    ),
  });
}

export async function activateTitleDefinition(request, response) {
  return sendSuccess(response, {
    message: "Dynamic-title definition activated successfully.",
    data: await titleService.activateDefinition(
      request.validated.params.titleId,
      request.validated.body,
      request.auth.user,
      requestMeta(request),
    ),
  });
}

export async function deactivateTitleDefinition(request, response) {
  return sendSuccess(response, {
    message: "Dynamic-title definition deactivated successfully.",
    data: await titleService.deactivateDefinition(
      request.validated.params.titleId,
      request.validated.body,
      request.auth.user,
      requestMeta(request),
    ),
  });
}

export async function recalculateTitles(request, response) {
  return sendSuccess(response, {
    message: "Dynamic titles recalculated successfully.",
    data: await titleService.recalculate(
      request.validated.body,
      request.auth.user,
      requestMeta(request),
    ),
  });
}
