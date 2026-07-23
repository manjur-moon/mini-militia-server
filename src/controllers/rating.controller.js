import { ratingConfigService } from "../services/rating-config.service.js";
import { ratingService } from "../services/rating.service.js";
import { sendPaginatedSuccess, sendSuccess } from "../utils/api-response.js";

function requestMeta(request) {
  return {
    requestId: request.id,
    ipAddress: request.ip,
    userAgent: request.get("user-agent") ?? null,
  };
}

export async function getActiveRatingConfig(_request, response) {
  return sendSuccess(response, {
    message: "Active player-rating formula retrieved successfully.",
    data: await ratingConfigService.getPublicConfig(),
  });
}

export async function getRatingLeaderboard(request, response) {
  const result = await ratingService.getLeaderboard(request.validated.query);
  return sendPaginatedSuccess(response, {
    message: "Player-rating leaderboard retrieved successfully.",
    data: result.items,
    pagination: result.pagination,
    meta: {
      period: result.period,
      formulaVersion: result.formulaVersion,
    },
  });
}

export async function getPlayerRating(request, response) {
  return sendSuccess(response, {
    message: "Player rating retrieved successfully.",
    data: await ratingService.getPlayerRating({
      playerCode: request.validated.params.playerId,
      ...request.validated.query,
    }),
  });
}

export async function getPlayerRatingHistory(request, response) {
  const result = await ratingService.getPlayerHistory({
    playerCode: request.validated.params.playerId,
    ...request.validated.query,
  });
  return sendPaginatedSuccess(response, {
    message: "Player rating history retrieved successfully.",
    data: result.items,
    pagination: result.pagination,
  });
}

export async function listRatingConfigs(request, response) {
  const result = await ratingConfigService.listConfigs(request.validated.query);
  return sendPaginatedSuccess(response, {
    message: "Player-rating configurations retrieved successfully.",
    data: result.items,
    pagination: result.pagination,
  });
}

export async function createRatingConfig(request, response) {
  return sendSuccess(response, {
    statusCode: 201,
    message: "Player-rating configuration created successfully.",
    data: await ratingConfigService.createConfig(
      request.validated.body,
      request.auth.user,
      requestMeta(request),
    ),
  });
}

export async function activateRatingConfig(request, response) {
  return sendSuccess(response, {
    message: "Player-rating configuration activated successfully.",
    data: await ratingConfigService.activateConfig(
      request.validated.params.configId,
      request.validated.body,
      request.auth.user,
      requestMeta(request),
    ),
  });
}

export async function recalculateRatings(request, response) {
  return sendSuccess(response, {
    message: "Player ratings recalculated successfully.",
    data: await ratingService.recalculate(
      request.validated.body,
      request.auth.user,
      requestMeta(request),
    ),
  });
}
