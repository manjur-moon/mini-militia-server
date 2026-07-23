import { mvpConfigService } from "../services/mvp-config.service.js";
import { mvpService } from "../services/mvp.service.js";
import { sendPaginatedSuccess, sendSuccess } from "../utils/api-response.js";

function requestMeta(request) {
  return {
    requestId: request.id,
    ipAddress: request.ip,
    userAgent: request.get("user-agent") ?? null,
  };
}

export async function getCurrentMvp(request, response) {
  return sendSuccess(response, {
    message: "Current MVP award retrieved successfully.",
    data: await mvpService.getCurrentAward({
      periodType: request.validated.query.awardType,
      date: request.validated.query.date,
      seasonId: request.validated.query.seasonId,
    }),
  });
}

export async function listMvpAwards(request, response) {
  const result = await mvpService.listAwards(request.validated.query);
  return sendPaginatedSuccess(response, {
    message: "MVP award history retrieved successfully.",
    data: result.items,
    pagination: result.pagination,
  });
}

export async function getActiveMvpConfig(_request, response) {
  return sendSuccess(response, {
    message: "Active MVP formula retrieved successfully.",
    data: await mvpConfigService.getPublicConfig(),
  });
}

export async function listMvpConfigs(_request, response) {
  return sendSuccess(response, {
    message: "MVP configurations retrieved successfully.",
    data: await mvpConfigService.listConfigs(),
  });
}

export async function createMvpConfig(request, response) {
  return sendSuccess(response, {
    statusCode: 201,
    message: "MVP configuration created successfully.",
    data: await mvpConfigService.createConfig(
      request.validated.body,
      request.auth.user,
      requestMeta(request),
    ),
  });
}

export async function activateMvpConfig(request, response) {
  return sendSuccess(response, {
    message: "MVP configuration activated successfully.",
    data: await mvpConfigService.activateConfig(
      request.validated.params.configId,
      request.validated.body,
      request.auth.user,
      requestMeta(request),
    ),
  });
}

export async function recalculateMvp(request, response) {
  return sendSuccess(response, {
    message: "MVP award recalculated successfully.",
    data: await mvpService.recalculateAward(
      {
        periodType: request.validated.body.awardType,
        date: request.validated.body.date,
        seasonId: request.validated.body.seasonId,
        reason: request.validated.body.reason,
      },
      request.auth.user,
      requestMeta(request),
    ),
  });
}
