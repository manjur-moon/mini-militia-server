import { analyticsService } from "../services/analytics.service.js";
import { sendPaginatedSuccess, sendSuccess } from "../utils/api-response.js";

function requestMeta(request) {
  return {
    requestId: request.id,
    ipAddress: request.ip,
    userAgent: request.get("user-agent") ?? null,
  };
}

export async function getLeaderboard(request, response) {
  const result = await analyticsService.getLeaderboard(request.validated.query);
  return sendPaginatedSuccess(response, {
    message: "Leaderboard retrieved successfully.",
    data: result.entries,
    pagination: result.pagination,
    meta: {
      period: result.period,
      metric: result.metric,
      minimumMatches: result.minimumMatches,
      cacheHit: result.cacheHit,
      generatedAt: result.generatedAt,
      calculationVersion: result.calculationVersion,
    },
  });
}

export async function getPeriodAnalytics(request, response) {
  return sendSuccess(response, {
    message: `${request.validated.params.periodType} analytics retrieved successfully.`,
    data: await analyticsService.getPeriodAnalytics({
      periodType: request.validated.params.periodType,
      date: request.validated.query.date,
    }),
  });
}

export async function getGlobalAnalytics(_request, response) {
  return sendSuccess(response, {
    message: "Global analytics retrieved successfully.",
    data: await analyticsService.getGlobalOverview(),
  });
}

export async function getMostImproved(request, response) {
  return sendSuccess(response, {
    message: "Most-improved players retrieved successfully.",
    data: await analyticsService.getMostImproved(request.validated.query),
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

export async function recalculateAnalytics(request, response) {
  const result = await analyticsService.recalculatePeriod(
    request.validated.body,
    request.auth.user,
    requestMeta(request),
  );
  return sendSuccess(response, {
    message: "Periodic analytics recalculated successfully.",
    data: { ...result, reason: request.validated.body.reason },
  });
}
