import { USER_ROLES } from "@mini-militia/shared";
import { Router } from "express";
import {
  activateRatingConfig,
  createRatingConfig,
  getActiveRatingConfig,
  getPlayerRating,
  getPlayerRatingHistory,
  getRatingLeaderboard,
  listRatingConfigs,
} from "../controllers/rating.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/authorize.middleware.js";
import { validateRequest } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  activateRatingConfigSchema,
  createRatingConfigSchema,
  emptyRatingConfigSchema,
  listRatingConfigsSchema,
  playerRatingHistorySchema,
  playerRatingSchema,
  ratingLeaderboardSchema,
} from "../validators/rating.validation.js";

export const ratingRouter = Router();

ratingRouter.get(
  "/config",
  validateRequest(emptyRatingConfigSchema),
  asyncHandler(getActiveRatingConfig),
);
ratingRouter.get(
  "/leaderboard",
  validateRequest(ratingLeaderboardSchema),
  asyncHandler(getRatingLeaderboard),
);
ratingRouter.get(
  "/players/:playerId/history",
  validateRequest(playerRatingHistorySchema),
  asyncHandler(getPlayerRatingHistory),
);
ratingRouter.get(
  "/players/:playerId",
  validateRequest(playerRatingSchema),
  asyncHandler(getPlayerRating),
);

ratingRouter.use(requireAuth, authorizeRoles(USER_ROLES.ADMIN));
ratingRouter.get(
  "/configs",
  validateRequest(listRatingConfigsSchema),
  asyncHandler(listRatingConfigs),
);
ratingRouter.post(
  "/configs",
  validateRequest(createRatingConfigSchema),
  asyncHandler(createRatingConfig),
);
ratingRouter.post(
  "/configs/:configId/activate",
  validateRequest(activateRatingConfigSchema),
  asyncHandler(activateRatingConfig),
);
