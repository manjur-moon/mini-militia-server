import { Router } from "express";
import {
  getActiveSeason,
  getSeason,
  getSeasonLeaderboard,
  getSeasonStatistics,
  listSeasons,
} from "../controllers/season.controller.js";
import { validateRequest } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  getActiveSeasonSchema,
  getSeasonLeaderboardSchema,
  getSeasonSchema,
  listSeasonsSchema,
} from "../validators/season.validation.js";

export const seasonRouter = Router();

seasonRouter.get("/", validateRequest(listSeasonsSchema), asyncHandler(listSeasons));
seasonRouter.get(
  "/active",
  validateRequest(getActiveSeasonSchema),
  asyncHandler(getActiveSeason),
);
seasonRouter.get(
  "/:identifier/leaderboard",
  validateRequest(getSeasonLeaderboardSchema),
  asyncHandler(getSeasonLeaderboard),
);
seasonRouter.get(
  "/:identifier/statistics",
  validateRequest(getSeasonSchema),
  asyncHandler(getSeasonStatistics),
);
seasonRouter.get(
  "/:identifier",
  validateRequest(getSeasonSchema),
  asyncHandler(getSeason),
);
