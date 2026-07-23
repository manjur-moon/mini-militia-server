import { ROLE_ACCESS, USER_ROLES } from "@mini-militia/shared";
import { Router } from "express";
import {
  createPlayer,
  deletePlayerPhoto,
  getPlayer,
  getPlayerProfile,
  getLinkedPlayerProfile,
  listPlayers,
  updatePlayer,
  updatePlayerStatus,
  uploadPlayerPhoto,
} from "../controllers/player.controller.js";
import { getPlayerRating } from "../controllers/rating.controller.js";
import {
  getPlayerCard,
  getPlayerCardImage,
  getPlayerCardPng,
} from "../controllers/player-card.controller.js";
import {
  getPlayerAdvancedAnalytics,
  getPlayerPerformance,
  getPlayerMatches,
  getLinkedPlayerMatches,
  getPlayerRecords,
  getPlayerStatistics,
} from "../controllers/player-statistics.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/authorize.middleware.js";
import {
  requireValidPlayerPhoto,
  uploadPlayerPhoto as playerPhotoUploadMiddleware,
} from "../middleware/player-photo-upload.middleware.js";
import { validateRequest } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  createPlayerSchema,
  deletePlayerPhotoSchema,
  listPlayersSchema,
  playerIdSchema,
  playerPhotoParamsSchema,
  updatePlayerSchema,
  updatePlayerStatusSchema,
} from "../validators/player.validation.js";
import { playerRatingSchema } from "../validators/rating.validation.js";
import { playerCardSchema } from "../validators/player-card.validation.js";
import {
  linkedPlayerMatchesSchema,
  linkedPlayerProfileSchema,
  playerMatchesSchema,
  playerStatisticsSchema,
} from "../validators/player-statistics.validation.js";
import {
  playerAdvancedAnalyticsSchema,
  playerPerformanceSchema,
} from "../validators/analytics.validation.js";

export const playerRouter = Router();

playerRouter.get("/", validateRequest(listPlayersSchema), asyncHandler(listPlayers));
playerRouter.get(
  "/me/profile",
  requireAuth,
  authorizeRoles(...ROLE_ACCESS.PLAYER_AREA),
  validateRequest(linkedPlayerProfileSchema),
  asyncHandler(getLinkedPlayerProfile),
);
playerRouter.get(
  "/me/matches",
  requireAuth,
  authorizeRoles(...ROLE_ACCESS.PLAYER_AREA),
  validateRequest(linkedPlayerMatchesSchema),
  asyncHandler(getLinkedPlayerMatches),
);
playerRouter.get(
  "/:playerId/profile",
  validateRequest(playerIdSchema),
  asyncHandler(getPlayerProfile),
);
playerRouter.get(
  "/:playerId/card",
  validateRequest(playerCardSchema),
  asyncHandler(getPlayerCard),
);
playerRouter.get(
  "/:playerId/card/image.svg",
  validateRequest(playerCardSchema),
  asyncHandler(getPlayerCardImage),
);
playerRouter.get(
  "/:playerId/card/image.png",
  validateRequest(playerCardSchema),
  asyncHandler(getPlayerCardPng),
);
playerRouter.get(
  "/:playerId/matches",
  validateRequest(playerMatchesSchema),
  asyncHandler(getPlayerMatches),
);
playerRouter.get(
  "/:playerId/ratings",
  validateRequest(playerRatingSchema),
  asyncHandler(getPlayerRating),
);
playerRouter.get(
  "/:playerId/statistics",
  validateRequest(playerStatisticsSchema),
  asyncHandler(getPlayerStatistics),
);
playerRouter.get(
  "/:playerId/records",
  validateRequest(playerStatisticsSchema),
  asyncHandler(getPlayerRecords),
);
playerRouter.get(
  "/:playerId/performance",
  validateRequest(playerPerformanceSchema),
  asyncHandler(getPlayerPerformance),
);
playerRouter.get(
  "/:playerId/advanced-analytics",
  validateRequest(playerAdvancedAnalyticsSchema),
  asyncHandler(getPlayerAdvancedAnalytics),
);
playerRouter.get(
  "/:playerId",
  validateRequest(playerIdSchema),
  asyncHandler(getPlayer),
);

playerRouter.use(requireAuth, authorizeRoles(USER_ROLES.ADMIN));
playerRouter.post("/", validateRequest(createPlayerSchema), asyncHandler(createPlayer));
playerRouter.patch(
  "/:playerId",
  validateRequest(updatePlayerSchema),
  asyncHandler(updatePlayer),
);
playerRouter.patch(
  "/:playerId/status",
  validateRequest(updatePlayerStatusSchema),
  asyncHandler(updatePlayerStatus),
);
playerRouter.post(
  "/:playerId/photo",
  validateRequest(playerPhotoParamsSchema),
  playerPhotoUploadMiddleware,
  requireValidPlayerPhoto,
  asyncHandler(uploadPlayerPhoto),
);
playerRouter.delete(
  "/:playerId/photo",
  validateRequest(deletePlayerPhotoSchema),
  asyncHandler(deletePlayerPhoto),
);
