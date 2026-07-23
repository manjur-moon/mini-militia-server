import { matchManagementService } from "../services/match-management.service.js";
import { sendSuccess } from "../utils/api-response.js";

function meta(request) {
  return {
    requestId: request.id,
    ipAddress: request.ip,
    userAgent: request.get("user-agent") ?? null,
  };
}

export async function updateMatchMetadata(request, response) {
  return sendSuccess(response, {
    message: "Pending match metadata updated successfully.",
    data: await matchManagementService.updateMetadata({
      actor: request.auth.user,
      matchId: request.validated.params.matchId,
      input: request.validated.body,
      requestMeta: meta(request),
    }),
  });
}

export async function addMatchResult(request, response) {
  return sendSuccess(response, {
    statusCode: 201,
    message: "Manual match result added successfully.",
    data: await matchManagementService.addResult({
      actor: request.auth.user,
      matchId: request.validated.params.matchId,
      input: request.validated.body,
      requestMeta: meta(request),
    }),
  });
}

export async function updateMatchResult(request, response) {
  return sendSuccess(response, {
    message: "Pending match result corrected successfully.",
    data: await matchManagementService.updateResult({
      actor: request.auth.user,
      matchId: request.validated.params.matchId,
      resultId: request.validated.params.resultId,
      input: request.validated.body,
      requestMeta: meta(request),
    }),
  });
}

export async function removeMatchResult(request, response) {
  return sendSuccess(response, {
    message: "Pending match result removed successfully.",
    data: await matchManagementService.removeResult({
      actor: request.auth.user,
      matchId: request.validated.params.matchId,
      resultId: request.validated.params.resultId,
      reason: request.validated.body.reason,
      requestMeta: meta(request),
    }),
  });
}
