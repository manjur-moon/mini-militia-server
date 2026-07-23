import { USER_ROLES } from "@mini-militia/shared";
import { Router } from "express";
import { recalculateAchievements } from "../controllers/achievement.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/authorize.middleware.js";
import { validateRequest } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import { recalculateAchievementsSchema } from "../validators/achievement.validation.js";

export const adminAchievementRouter = Router();

adminAchievementRouter.use(requireAuth, authorizeRoles(USER_ROLES.ADMIN));
adminAchievementRouter.post(
  "/recalculate",
  validateRequest(recalculateAchievementsSchema),
  asyncHandler(recalculateAchievements),
);
