import { ROLE_ACCESS, USER_ROLES } from "@mini-militia/shared";
import { Router } from "express";
import {
  getMatch,
  getOCRJob,
  listMatches,
  rejectMatch,
  retryOCR,
  reviewMatch,
  uploadMatch,
  verifyMatch,
} from "../controllers/match.controller.js";
import {
  addMatchResult,
  removeMatchResult,
  updateMatchMetadata,
  updateMatchResult,
} from "../controllers/match-management.controller.js";
import {
  approveMatchRevision,
  getMatchRevision,
  listMatchRevisions,
  proposeMatchRevision,
  rejectMatchRevision,
} from "../controllers/match-revision.controller.js";
import { optionalAuth, requireAuth } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/authorize.middleware.js";
import {
  requireValidMatchScreenshot,
  uploadMatchScreenshot,
} from "../middleware/match-screenshot-upload.middleware.js";
import { validateRequest } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  listMatchesSchema,
  matchDecisionSchema,
  matchIdSchema,
  ocrJobIdSchema,
  reviewMatchSchema,
  uploadMatchSchema,
} from "../validators/match.validation.js";
import {
  addMatchResultSchema,
  removeMatchResultSchema,
  updateMatchMetadataSchema,
  updateMatchResultSchema,
} from "../validators/match-management.validation.js";
import {
  approveMatchRevisionSchema,
  listMatchRevisionsSchema,
  matchRevisionIdSchema,
  proposeMatchRevisionSchema,
  rejectMatchRevisionSchema,
} from "../validators/match-revision.validation.js";

export const matchRouter = Router();

// Public requests are forced to verified-only projections. Moderator/Admin sessions
// receive protected archive fields through the same read endpoints.
matchRouter.get(
  "/",
  optionalAuth,
  validateRequest(listMatchesSchema),
  asyncHandler(listMatches),
);
matchRouter.get(
  "/:matchId",
  optionalAuth,
  validateRequest(matchIdSchema),
  asyncHandler(getMatch),
);

matchRouter.use(requireAuth, authorizeRoles(...ROLE_ACCESS.MODERATOR_AREA));

matchRouter.post(
  "/uploads",
  uploadMatchScreenshot,
  requireValidMatchScreenshot,
  validateRequest(uploadMatchSchema),
  asyncHandler(uploadMatch),
);
matchRouter.get(
  "/ocr/jobs/:jobId",
  validateRequest(ocrJobIdSchema),
  asyncHandler(getOCRJob),
);
matchRouter.post(
  "/ocr/jobs/:jobId/retry",
  validateRequest(ocrJobIdSchema),
  asyncHandler(retryOCR),
);
matchRouter.patch(
  "/:matchId",
  validateRequest(updateMatchMetadataSchema),
  asyncHandler(updateMatchMetadata),
);
matchRouter.post(
  "/:matchId/results",
  validateRequest(addMatchResultSchema),
  asyncHandler(addMatchResult),
);
matchRouter.patch(
  "/:matchId/results/:resultId",
  validateRequest(updateMatchResultSchema),
  asyncHandler(updateMatchResult),
);
matchRouter.delete(
  "/:matchId/results/:resultId",
  validateRequest(removeMatchResultSchema),
  asyncHandler(removeMatchResult),
);
matchRouter.patch(
  "/:matchId/review",
  validateRequest(reviewMatchSchema),
  asyncHandler(reviewMatch),
);
matchRouter.post(
  "/:matchId/verify",
  validateRequest(matchDecisionSchema),
  asyncHandler(verifyMatch),
);
matchRouter.post(
  "/:matchId/reject",
  validateRequest(matchDecisionSchema),
  asyncHandler(rejectMatch),
);

matchRouter.get(
  "/:matchId/revisions",
  validateRequest(listMatchRevisionsSchema),
  asyncHandler(listMatchRevisions),
);
matchRouter.get(
  "/:matchId/revisions/:revisionNumber",
  validateRequest(matchRevisionIdSchema),
  asyncHandler(getMatchRevision),
);
matchRouter.post(
  "/:matchId/revisions",
  authorizeRoles(USER_ROLES.ADMIN),
  validateRequest(proposeMatchRevisionSchema),
  asyncHandler(proposeMatchRevision),
);
matchRouter.post(
  "/:matchId/revisions/:revisionNumber/approve",
  authorizeRoles(USER_ROLES.ADMIN),
  validateRequest(approveMatchRevisionSchema),
  asyncHandler(approveMatchRevision),
);
matchRouter.post(
  "/:matchId/revisions/:revisionNumber/reject",
  authorizeRoles(USER_ROLES.ADMIN),
  validateRequest(rejectMatchRevisionSchema),
  asyncHandler(rejectMatchRevision),
);
