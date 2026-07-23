import { rivalryService } from "../services/rivalry.service.js";
import { sendPaginatedSuccess, sendSuccess } from "../utils/api-response.js";

function requestMeta(request) {
  return {
    requestId: request.id,
    ipAddress: request.ip,
    userAgent: request.get("user-agent") ?? null,
  };
}

export async function listPlayerRivalries(request, response) {
  const result = await rivalryService.listForPlayer(
    request.validated.params.playerId,
    request.validated.query,
  );
  return sendPaginatedSuccess(response, {
    message: "Player rivalries retrieved successfully.",
    data: result.items,
    pagination: result.pagination,
    meta: { player: result.player, period: result.period },
  });
}

export async function getRivalryComparison(request, response) {
  return sendSuccess(response, {
    message: "Rivalry comparison retrieved successfully.",
    data: await rivalryService.getComparison(
      request.validated.params.playerId,
      request.validated.params.opponentId,
      request.validated.query,
    ),
  });
}

export async function getRivalryMatches(request, response) {
  const result = await rivalryService.getHeadToHeadMatches(
    request.validated.params.playerId,
    request.validated.params.opponentId,
    request.validated.query,
  );
  return sendPaginatedSuccess(response, {
    message: "Head-to-head matches retrieved successfully.",
    data: result.items,
    pagination: result.pagination,
    meta: {
      player: result.player,
      opponent: result.opponent,
      period: result.period,
    },
  });
}

export async function getRivalOfWeek(request, response) {
  return sendSuccess(response, {
    message: "Rival of the week retrieved successfully.",
    data: await rivalryService.getRivalOfWeek(request.validated.query),
  });
}

export async function recalculateRivalries(request, response) {
  return sendSuccess(response, {
    message: "Rivalry statistics recalculated successfully.",
    data: await rivalryService.recalculate(
      request.validated.body,
      request.auth.user,
      requestMeta(request),
    ),
  });
}
