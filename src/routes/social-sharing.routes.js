import { Router } from "express";
import {
  getAchievementShare,
  getAchievementShareImage,
  getPlayerProfileShare,
  getPlayerProfileShareImage,
  getWeeklyMvpShare,
  getWeeklyMvpShareImage,
} from "../controllers/social-sharing.controller.js";
import { validateRequest } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  achievementShareSchema,
  playerProfileShareSchema,
  weeklyMvpShareSchema,
} from "../validators/social-sharing.validation.js";

export const socialSharingRouter = Router();

socialSharingRouter.get(
  "/players/:playerId",
  validateRequest(playerProfileShareSchema),
  asyncHandler(getPlayerProfileShare),
);
socialSharingRouter.get(
  "/players/:playerId/image.png",
  validateRequest(playerProfileShareSchema),
  asyncHandler(getPlayerProfileShareImage),
);
socialSharingRouter.get(
  "/players/:playerId/achievements/:achievementCode",
  validateRequest(achievementShareSchema),
  asyncHandler(getAchievementShare),
);
socialSharingRouter.get(
  "/players/:playerId/achievements/:achievementCode/image.png",
  validateRequest(achievementShareSchema),
  asyncHandler(getAchievementShareImage),
);
socialSharingRouter.get(
  "/mvp/weekly",
  validateRequest(weeklyMvpShareSchema),
  asyncHandler(getWeeklyMvpShare),
);
socialSharingRouter.get(
  "/mvp/weekly/image.png",
  validateRequest(weeklyMvpShareSchema),
  asyncHandler(getWeeklyMvpShareImage),
);
