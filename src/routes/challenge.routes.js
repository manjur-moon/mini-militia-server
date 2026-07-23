import { USER_ROLES } from "@mini-militia/shared";
import { Router } from "express";
import {
  changeChallengeStatus,
  createChallenge,
  getChallenge,
  getPlayerChallenges,
  listAdminChallenges,
  listPublicChallenges,
  updateChallenge,
} from "../controllers/challenge.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/authorize.middleware.js";
import { validateRequest } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  changeChallengeStatusSchema,
  createChallengeSchema,
  getChallengeSchema,
  getPlayerChallengesSchema,
  listAdminChallengesSchema,
  listPublicChallengesSchema,
  updateChallengeSchema,
} from "../validators/challenge.validation.js";

export const challengeRouter = Router();

challengeRouter.get(
  "/admin/manage/list",
  requireAuth,
  authorizeRoles(USER_ROLES.ADMIN),
  validateRequest(listAdminChallengesSchema),
  asyncHandler(listAdminChallenges),
);
challengeRouter.post(
  "/admin/manage",
  requireAuth,
  authorizeRoles(USER_ROLES.ADMIN),
  validateRequest(createChallengeSchema),
  asyncHandler(createChallenge),
);
challengeRouter.patch(
  "/admin/manage/:challengeId",
  requireAuth,
  authorizeRoles(USER_ROLES.ADMIN),
  validateRequest(updateChallengeSchema),
  asyncHandler(updateChallenge),
);
challengeRouter.post(
  "/admin/manage/:challengeId/status",
  requireAuth,
  authorizeRoles(USER_ROLES.ADMIN),
  validateRequest(changeChallengeStatusSchema),
  asyncHandler(changeChallengeStatus),
);
challengeRouter.get(
  "/",
  validateRequest(listPublicChallengesSchema),
  asyncHandler(listPublicChallenges),
);
challengeRouter.get(
  "/players/:playerId",
  validateRequest(getPlayerChallengesSchema),
  asyncHandler(getPlayerChallenges),
);
challengeRouter.get(
  "/:identifier",
  validateRequest(getChallengeSchema),
  asyncHandler(getChallenge),
);
