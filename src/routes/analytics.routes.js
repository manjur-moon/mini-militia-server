import { Router } from "express";
import {
  getGlobalAnalytics,
  getLeaderboard,
  getMostImproved,
  getPeriodAnalytics,
} from "../controllers/analytics.controller.js";
import { validateRequest } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  globalAnalyticsSchema,
  leaderboardSchema,
  mostImprovedSchema,
  periodAnalyticsSchema,
} from "../validators/analytics.validation.js";

export const analyticsRouter = Router();

analyticsRouter.get(
  "/leaderboards",
  validateRequest(leaderboardSchema),
  asyncHandler(getLeaderboard),
);
analyticsRouter.get(
  "/periods/:periodType",
  validateRequest(periodAnalyticsSchema),
  asyncHandler(getPeriodAnalytics),
);
analyticsRouter.get(
  "/global",
  validateRequest(globalAnalyticsSchema),
  asyncHandler(getGlobalAnalytics),
);
analyticsRouter.get(
  "/most-improved",
  validateRequest(mostImprovedSchema),
  asyncHandler(getMostImproved),
);
