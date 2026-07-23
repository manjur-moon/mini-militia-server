import { USER_ROLES } from "@mini-militia/shared";
import { Router } from "express";
import { recalculateAnalytics } from "../controllers/analytics.controller.js";
import {
  activateMvpConfig,
  createMvpConfig,
  listMvpConfigs,
  recalculateMvp,
} from "../controllers/mvp.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/authorize.middleware.js";
import { validateRequest } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import { recalculateAnalyticsSchema } from "../validators/analytics.validation.js";
import {
  activateMvpConfigSchema,
  createMvpConfigSchema,
  emptyMvpConfigSchema,
  recalculateMvpSchema,
} from "../validators/mvp.validation.js";

export const adminAnalyticsRouter = Router();

adminAnalyticsRouter.use(requireAuth, authorizeRoles(USER_ROLES.ADMIN));
adminAnalyticsRouter.post(
  "/recalculate",
  validateRequest(recalculateAnalyticsSchema),
  asyncHandler(recalculateAnalytics),
);
adminAnalyticsRouter.get(
  "/mvp/configs",
  validateRequest(emptyMvpConfigSchema),
  asyncHandler(listMvpConfigs),
);
adminAnalyticsRouter.post(
  "/mvp/configs",
  validateRequest(createMvpConfigSchema),
  asyncHandler(createMvpConfig),
);
adminAnalyticsRouter.post(
  "/mvp/configs/:configId/activate",
  validateRequest(activateMvpConfigSchema),
  asyncHandler(activateMvpConfig),
);
adminAnalyticsRouter.post(
  "/mvp/recalculate",
  validateRequest(recalculateMvpSchema),
  asyncHandler(recalculateMvp),
);
