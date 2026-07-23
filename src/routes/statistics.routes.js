import { Router } from "express";
import { getStatisticsOverview } from "../controllers/statistics.controller.js";
import { validateRequest } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import { statisticsOverviewSchema } from "../validators/statistics.validation.js";

export const statisticsRouter = Router();

statisticsRouter.get(
  "/overview",
  validateRequest(statisticsOverviewSchema),
  asyncHandler(getStatisticsOverview),
);
