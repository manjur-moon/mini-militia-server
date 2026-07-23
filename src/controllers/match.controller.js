import { matchReadService } from "../services/match-read.service.js";
import { matchService } from "../services/match.service.js";
import { sendPaginatedSuccess, sendSuccess } from "../utils/api-response.js";

function meta(request) {
  return {
    requestId: request.id,
    ipAddress: request.ip,
    userAgent: request.get("user-agent") ?? null,
  };
}

export async function uploadMatch(request, response) {
  return sendSuccess(response, {
    statusCode: 202,
    message: "Screenshot uploaded. OCR processing has been queued.",
    data: await matchService.upload({
      actor: request.auth.user,
      input: request.validated.body,
      file: request.file,
      requestMeta: meta(request),
    }),
  });
}

export async function listMatches(request, response) {
  const result = await matchReadService.list({
    query: request.validated.query,
    actor: request.auth?.user ?? null,
  });
  return sendPaginatedSuccess(response, {
    message: "Matches retrieved successfully.",
    data: result.items,
    pagination: result.pagination,
  });
}

export async function getMatch(request, response) {
  return sendSuccess(response, {
    message: "Match retrieved successfully.",
    data: await matchReadService.get({
      matchId: request.validated.params.matchId,
      actor: request.auth?.user ?? null,
    }),
  });
}

export async function getOCRJob(request, response) {
  return sendSuccess(response, {
    message: "OCR job retrieved successfully.",
    data: await matchService.getOCRJob(request.validated.params.jobId),
  });
}

export async function retryOCR(request, response) {
  return sendSuccess(response, {
    statusCode: 202,
    message: "OCR retry has been queued.",
    data: await matchService.retryOCR({
      actor: request.auth.user,
      jobId: request.validated.params.jobId,
      requestMeta: meta(request),
    }),
  });
}

export async function reviewMatch(request, response) {
  return sendSuccess(response, {
    message: "Match review saved successfully.",
    data: await matchService.saveReview({
      actor: request.auth.user,
      matchId: request.validated.params.matchId,
      input: request.validated.body,
      requestMeta: meta(request),
    }),
  });
}

export async function verifyMatch(request, response) {
  return sendSuccess(response, {
    message: "Match verified successfully.",
    data: await matchService.verify({
      actor: request.auth.user,
      matchId: request.validated.params.matchId,
      reason: request.validated.body.reason,
      requestMeta: meta(request),
    }),
  });
}

export async function rejectMatch(request, response) {
  return sendSuccess(response, {
    message: "Match rejected successfully.",
    data: await matchService.reject({
      actor: request.auth.user,
      matchId: request.validated.params.matchId,
      reason: request.validated.body.reason,
      requestMeta: meta(request),
    }),
  });
}
