import { USER_ROLES } from "@mini-militia/shared";
import { Router } from "express";
import { recalculateStatistics } from "../controllers/statistics.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/authorize.middleware.js";
import { validateRequest } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import { recalculateStatisticsSchema } from "../validators/statistics.validation.js";

export const adminStatisticsRouter = Router();

adminStatisticsRouter.use(requireAuth, authorizeRoles(USER_ROLES.ADMIN));
adminStatisticsRouter.post(
  "/recalculate",
  validateRequest(recalculateStatisticsSchema),
  asyncHandler(recalculateStatistics),
);
