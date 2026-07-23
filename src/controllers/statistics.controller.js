import { statisticsService } from "../services/statistics.service.js";
import { sendSuccess } from "../utils/api-response.js";

function meta(request) {
  return {
    requestId: request.id,
    ipAddress: request.ip,
    userAgent: request.get("user-agent") ?? null,
  };
}

export async function getStatisticsOverview(_request, response) {
  return sendSuccess(response, {
    message: "League statistics overview retrieved successfully.",
    data: await statisticsService.getOverview(),
  });
}

export async function recalculateStatistics(request, response) {
  const { scope, playerId, matchId, reason } = request.validated.body;
  let data;
  if (scope === "all") {
    data = await statisticsService.recalculateAll({
      actor: request.auth.user,
      reason,
      requestMeta: meta(request),
    });
  } else if (scope === "player") {
    data = await statisticsService.recalculateForPlayer(playerId, {
      actor: request.auth.user,
      reason,
      requestMeta: meta(request),
    });
  } else {
    data = await statisticsService.recalculateForMatch(matchId, {
      actor: request.auth.user,
      reason,
      requestMeta: meta(request),
    });
  }
  return sendSuccess(response, {
    message: "Statistics recalculation completed successfully.",
    data: { ...data, scope, playerId: playerId ?? null, matchId: matchId ?? null },
  });
}
