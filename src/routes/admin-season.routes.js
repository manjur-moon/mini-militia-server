import { USER_ROLES } from "@mini-militia/shared";
import { Router } from "express";
import {
  backfillSeasonMatches,
  changeSeasonStatus,
  listAdminSeasons,
  createSeason,
  recalculateSeason,
  updateSeason,
} from "../controllers/season.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/authorize.middleware.js";
import { validateRequest } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  changeSeasonStatusSchema,
  createSeasonSchema,
  listAdminSeasonsSchema,
  recalculateSeasonSchema,
  updateSeasonSchema,
} from "../validators/season.validation.js";

export const adminSeasonRouter = Router();
adminSeasonRouter.use(requireAuth, authorizeRoles(USER_ROLES.ADMIN));

adminSeasonRouter.get(
  "/",
  validateRequest(listAdminSeasonsSchema),
  asyncHandler(listAdminSeasons),
);
adminSeasonRouter.post(
  "/",
  validateRequest(createSeasonSchema),
  asyncHandler(createSeason),
);
adminSeasonRouter.patch(
  "/:seasonId",
  validateRequest(updateSeasonSchema),
  asyncHandler(updateSeason),
);
adminSeasonRouter.post(
  "/:seasonId/status",
  validateRequest(changeSeasonStatusSchema),
  asyncHandler(changeSeasonStatus),
);
adminSeasonRouter.post(
  "/:seasonId/recalculate",
  validateRequest(recalculateSeasonSchema),
  asyncHandler(recalculateSeason),
);
adminSeasonRouter.post(
  "/:seasonId/backfill-matches",
  validateRequest(recalculateSeasonSchema),
  asyncHandler(backfillSeasonMatches),
);
