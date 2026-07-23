import { hallOfFameService } from "../services/hall-of-fame.service.js";
import { sendSuccess } from "../utils/api-response.js";

function requestMeta(request) {
  return {
    requestId: request.id,
    ipAddress: request.ip,
    userAgent: request.get("user-agent") ?? null,
  };
}

export async function listHallOfFame(request, response) {
  return sendSuccess(response, {
    message: "Hall of Fame records retrieved successfully.",
    data: await hallOfFameService.list(request.validated.query),
  });
}

export async function getHallOfFameCategory(request, response) {
  return sendSuccess(response, {
    message: "Hall of Fame category retrieved successfully.",
    data: await hallOfFameService.getCategory(
      request.validated.params.category,
      request.validated.query,
    ),
  });
}

export async function getPlayerHallOfFame(request, response) {
  return sendSuccess(response, {
    message: "Player Hall of Fame history retrieved successfully.",
    data: await hallOfFameService.getPlayerHistory(
      request.validated.params.playerId,
      request.validated.query,
    ),
  });
}

export async function recalculateHallOfFame(request, response) {
  return sendSuccess(response, {
    message: "Hall of Fame records recalculated successfully.",
    data: await hallOfFameService.recalculate(
      request.validated.body,
      request.auth.user,
      requestMeta(request),
    ),
  });
}
