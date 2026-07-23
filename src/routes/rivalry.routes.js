import { Router } from "express";
import {
  getRivalOfWeek,
  getRivalryComparison,
  getRivalryMatches,
  listPlayerRivalries,
} from "../controllers/rivalry.controller.js";
import { validateRequest } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  getRivalOfWeekSchema,
  getRivalryComparisonSchema,
  getRivalryMatchesSchema,
  listPlayerRivalriesSchema,
} from "../validators/rivalry.validation.js";

export const rivalryRouter = Router();

rivalryRouter.get(
  "/rival-of-week",
  validateRequest(getRivalOfWeekSchema),
  asyncHandler(getRivalOfWeek),
);
rivalryRouter.get(
  "/players/:playerId",
  validateRequest(listPlayerRivalriesSchema),
  asyncHandler(listPlayerRivalries),
);
rivalryRouter.get(
  "/players/:playerId/opponents/:opponentId",
  validateRequest(getRivalryComparisonSchema),
  asyncHandler(getRivalryComparison),
);
rivalryRouter.get(
  "/players/:playerId/opponents/:opponentId/matches",
  validateRequest(getRivalryMatchesSchema),
  asyncHandler(getRivalryMatches),
);
