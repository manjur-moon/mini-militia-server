import { analyticsService } from "../services/analytics.service.js";
import { playerMatchHistoryService } from "../services/player-match-history.service.js";
import { statisticsService } from "../services/statistics.service.js";
import { sendPaginatedSuccess, sendSuccess } from "../utils/api-response.js";

export async function getLinkedPlayerMatches(request, response) {
  const result = await playerMatchHistoryService.listLinked(
    request.auth.user,
    request.validated.query,
  );
  return sendPaginatedSuccess(response, {
    message: "Linked player match history retrieved successfully.",
    data: result.items,
    pagination: result.pagination,
    meta: { player: result.player },
  });
}

export async function getPlayerMatches(request, response) {
  const result = await playerMatchHistoryService.list(
    request.validated.params.playerId,
    request.validated.query,
  );
  return sendPaginatedSuccess(response, {
    message: "Player verified match history retrieved successfully.",
    data: result.items,
    pagination: result.pagination,
    meta: { player: result.player },
  });
}

export async function getPlayerStatistics(request, response) {
  return sendSuccess(response, {
    message: "Player statistics retrieved successfully.",
    data: await statisticsService.getPlayerStatisticsByCode(
      request.validated.params.playerId,
    ),
  });
}

export async function getPlayerRecords(request, response) {
  const result = await statisticsService.getPlayerStatisticsByCode(
    request.validated.params.playerId,
  );
  return sendSuccess(response, {
    message: "Player records retrieved successfully.",
    data: {
      player: result.player,
      records: result.statistics?.records ?? null,
      calculationVersion: result.statistics?.calculationVersion ?? null,
      recalculatedAt: result.statistics?.recalculatedAt ?? null,
    },
  });
}

export async function getPlayerPerformance(request, response) {
  return sendSuccess(response, {
    message: "Player performance trend retrieved successfully.",
    data: await analyticsService.getPlayerPerformance(
      request.validated.params.playerId,
      request.validated.query,
    ),
  });
}

export async function getPlayerAdvancedAnalytics(request, response) {
  return sendSuccess(response, {
    message: "Player advanced analytics retrieved successfully.",
    data: await analyticsService.getAdvancedPlayerAnalytics(
      request.validated.params.playerId,
    ),
  });
}
