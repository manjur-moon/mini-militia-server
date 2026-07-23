import { aiInsightService } from "../services/ai-insight.service.js";
import { sendPaginatedSuccess, sendSuccess } from "../utils/api-response.js";

function requestMeta(request) {
  return {
    requestId: request.id,
    ipAddress: request.ip,
    userAgent: request.get("user-agent") ?? null,
  };
}

export async function getAIStatus(_request, response) {
  return sendSuccess(response, {
    message: "AI insight configuration retrieved successfully.",
    data: aiInsightService.getConfiguration(),
  });
}

export async function getPeriodSummary(request, response) {
  return sendSuccess(response, {
    message: "AI period summary retrieved successfully.",
    data: await aiInsightService.generatePeriodSummary({
      periodType: request.validated.params.periodType,
      date: request.validated.query.date,
    }),
  });
}

export async function getPeriodHighlight(request, response) {
  return sendSuccess(response, {
    message: "AI period highlight retrieved successfully.",
    data: await aiInsightService.generateHighlight({
      periodType: request.validated.params.periodType,
      date: request.validated.query.date,
    }),
  });
}

export async function getPlayerInsight(request, response) {
  return sendSuccess(response, {
    message: "AI player insight retrieved successfully.",
    data: await aiInsightService.generatePlayerInsight({
      playerCode: request.validated.params.playerId,
      range: request.validated.query.range,
    }),
  });
}

export async function getMatchInsight(request, response) {
  return sendSuccess(response, {
    message: "AI match insight retrieved successfully.",
    data: await aiInsightService.generateMatchInsight({
      matchId: request.validated.params.matchId,
    }),
  });
}

export async function listAISummaries(request, response) {
  const result = await aiInsightService.list(request.validated.query);
  return sendPaginatedSuccess(response, {
    message: "AI summary generation history retrieved successfully.",
    data: result.items,
    pagination: result.pagination,
  });
}

export async function regenerateAIInsight(request, response) {
  return sendSuccess(response, {
    message: "AI insight regenerated successfully.",
    data: await aiInsightService.regenerate(
      request.validated.body,
      request.auth.user,
      requestMeta(request),
    ),
  });
}
