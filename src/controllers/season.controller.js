import { seasonService } from "../services/season.service.js";
import { sendPaginatedSuccess, sendSuccess } from "../utils/api-response.js";

function requestMeta(request) {
  return {
    requestId: request.id,
    ipAddress: request.ip,
    userAgent: request.get("user-agent") ?? null,
  };
}

export async function listSeasons(request, response) {
  const result = await seasonService.list(request.validated.query);
  return sendPaginatedSuccess(response, {
    message: "Seasons retrieved successfully.",
    data: result.items,
    pagination: result.pagination,
  });
}

export async function listAdminSeasons(request, response) {
  const result = await seasonService.list(request.validated.query, {
    includeDraft: true,
  });
  return sendPaginatedSuccess(response, {
    message: "Administrative season records retrieved successfully.",
    data: result.items,
    pagination: result.pagination,
  });
}

export async function getActiveSeason(_request, response) {
  return sendSuccess(response, {
    message: "Active season retrieved successfully.",
    data: await seasonService.getActive(),
  });
}

export async function getSeason(request, response) {
  return sendSuccess(response, {
    message: "Season retrieved successfully.",
    data: await seasonService.get(request.validated.params.identifier),
  });
}

export async function getSeasonLeaderboard(request, response) {
  const result = await seasonService.getLeaderboard(
    request.validated.params.identifier,
    request.validated.query,
  );
  return sendPaginatedSuccess(response, {
    message: "Season leaderboard retrieved successfully.",
    data: result.entries,
    pagination: result.pagination,
    meta: {
      season: result.season,
      period: result.period,
      metric: result.metric,
      minimumMatches: result.minimumMatches,
      cacheHit: result.cacheHit,
      generatedAt: result.generatedAt,
      calculationVersion: result.calculationVersion,
    },
  });
}

export async function getSeasonStatistics(request, response) {
  return sendSuccess(response, {
    message: "Season statistics retrieved successfully.",
    data: await seasonService.getStatistics(request.validated.params.identifier),
  });
}

export async function createSeason(request, response) {
  return sendSuccess(response, {
    statusCode: 201,
    message: "Season created successfully.",
    data: await seasonService.create({
      actor: request.auth.user,
      input: request.validated.body,
      requestMeta: requestMeta(request),
    }),
  });
}

export async function updateSeason(request, response) {
  return sendSuccess(response, {
    message: "Season updated successfully.",
    data: await seasonService.update({
      actor: request.auth.user,
      seasonId: request.validated.params.seasonId,
      input: request.validated.body,
      requestMeta: requestMeta(request),
    }),
  });
}

export async function changeSeasonStatus(request, response) {
  return sendSuccess(response, {
    message: "Season status updated successfully.",
    data: await seasonService.changeStatus({
      actor: request.auth.user,
      seasonId: request.validated.params.seasonId,
      status: request.validated.body.status,
      reason: request.validated.body.reason,
      requestMeta: requestMeta(request),
    }),
  });
}

export async function recalculateSeason(request, response) {
  return sendSuccess(response, {
    message: "Season analytics recalculated successfully.",
    data: await seasonService.recalculate({
      actor: request.auth.user,
      seasonId: request.validated.params.seasonId,
      reason: request.validated.body.reason,
      requestMeta: requestMeta(request),
    }),
  });
}

export async function backfillSeasonMatches(request, response) {
  return sendSuccess(response, {
    message: "Season match assignments backfilled successfully.",
    data: await seasonService.backfillMatchAssignments({
      actor: request.auth.user,
      seasonId: request.validated.params.seasonId,
      reason: request.validated.body.reason,
      requestMeta: requestMeta(request),
    }),
  });
}
