import { USER_ROLES } from "@mini-militia/shared";
import { Router } from "express";
import {
  activateAchievementDefinition,
  createAchievementDefinition,
  createAchievementRevision,
  deactivateAchievementDefinition,
  getPlayerAchievements,
  getPublicAchievement,
  listAchievementDefinitions,
  listPublicAchievements,
} from "../controllers/achievement.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/authorize.middleware.js";
import { validateRequest } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  changeAchievementStatusSchema,
  createAchievementDefinitionSchema,
  createAchievementRevisionSchema,
  getPlayerAchievementsSchema,
  getPublicAchievementSchema,
  listAchievementDefinitionsSchema,
  listPublicAchievementsSchema,
} from "../validators/achievement.validation.js";

export const achievementRouter = Router();

achievementRouter.get(
  "/",
  validateRequest(listPublicAchievementsSchema),
  asyncHandler(listPublicAchievements),
);
achievementRouter.get(
  "/players/:playerId",
  validateRequest(getPlayerAchievementsSchema),
  asyncHandler(getPlayerAchievements),
);
achievementRouter.get(
  "/definitions/:code",
  validateRequest(getPublicAchievementSchema),
  asyncHandler(getPublicAchievement),
);

achievementRouter.use(requireAuth, authorizeRoles(USER_ROLES.ADMIN));
achievementRouter.get(
  "/admin/definitions",
  validateRequest(listAchievementDefinitionsSchema),
  asyncHandler(listAchievementDefinitions),
);
achievementRouter.post(
  "/admin/definitions",
  validateRequest(createAchievementDefinitionSchema),
  asyncHandler(createAchievementDefinition),
);
achievementRouter.post(
  "/admin/definitions/:achievementId/revisions",
  validateRequest(createAchievementRevisionSchema),
  asyncHandler(createAchievementRevision),
);
achievementRouter.post(
  "/admin/definitions/:achievementId/activate",
  validateRequest(changeAchievementStatusSchema),
  asyncHandler(activateAchievementDefinition),
);
achievementRouter.post(
  "/admin/definitions/:achievementId/deactivate",
  validateRequest(changeAchievementStatusSchema),
  asyncHandler(deactivateAchievementDefinition),
);
