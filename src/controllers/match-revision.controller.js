import { matchRevisionService } from "../services/match-revision.service.js";
import { sendPaginatedSuccess, sendSuccess } from "../utils/api-response.js";

function meta(request) {
  return {
    requestId: request.id,
    ipAddress: request.ip,
    userAgent: request.get("user-agent") ?? null,
  };
}

export async function listMatchRevisions(request, response) {
  const result = await matchRevisionService.list(
    request.validated.params.matchId,
    request.validated.query,
  );
  return sendPaginatedSuccess(response, {
    message: "Match revisions retrieved successfully.",
    data: result.items,
    pagination: result.pagination,
  });
}

export async function getMatchRevision(request, response) {
  return sendSuccess(response, {
    message: "Match revision retrieved successfully.",
    data: await matchRevisionService.get(
      request.validated.params.matchId,
      request.validated.params.revisionNumber,
    ),
  });
}

export async function proposeMatchRevision(request, response) {
  return sendSuccess(response, {
    statusCode: 201,
    message: "Verified-match correction proposed successfully.",
    data: await matchRevisionService.propose({
      actor: request.auth.user,
      matchId: request.validated.params.matchId,
      input: request.validated.body,
      requestMeta: meta(request),
    }),
  });
}

export async function approveMatchRevision(request, response) {
  return sendSuccess(response, {
    message: "Verified-match correction approved and recalculation triggered.",
    data: await matchRevisionService.approve({
      actor: request.auth.user,
      matchId: request.validated.params.matchId,
      revisionNumber: request.validated.params.revisionNumber,
      input: request.validated.body,
      requestMeta: meta(request),
    }),
  });
}

export async function rejectMatchRevision(request, response) {
  return sendSuccess(response, {
    message: "Verified-match correction rejected successfully.",
    data: await matchRevisionService.reject({
      actor: request.auth.user,
      matchId: request.validated.params.matchId,
      revisionNumber: request.validated.params.revisionNumber,
      reason: request.validated.body.reason,
      requestMeta: meta(request),
    }),
  });
}
