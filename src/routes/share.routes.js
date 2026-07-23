import { Router } from "express";
import { getPlayerCardSharePage } from "../controllers/player-card.controller.js";
import {
  getAchievementSharePage,
  getPlayerProfileSharePage,
  getWeeklyMvpSharePage,
} from "../controllers/social-sharing.controller.js";
import { validateRequest } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import { playerCardSchema } from "../validators/player-card.validation.js";
import {
  achievementShareSchema,
  playerProfileShareSchema,
  weeklyMvpShareSchema,
} from "../validators/social-sharing.validation.js";

export const shareRouter = Router();

shareRouter.get(
  "/share/players/:playerId/card",
  validateRequest(playerCardSchema),
  asyncHandler(getPlayerCardSharePage),
);
shareRouter.get(
  "/share/players/:playerId/profile",
  validateRequest(playerProfileShareSchema),
  asyncHandler(getPlayerProfileSharePage),
);
shareRouter.get(
  "/share/players/:playerId/achievements/:achievementCode",
  validateRequest(achievementShareSchema),
  asyncHandler(getAchievementSharePage),
);
shareRouter.get(
  "/share/mvp/weekly",
  validateRequest(weeklyMvpShareSchema),
  asyncHandler(getWeeklyMvpSharePage),
);
