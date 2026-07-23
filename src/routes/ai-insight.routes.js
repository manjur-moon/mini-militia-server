import { Router } from "express";
import {
  getAIStatus,
  getMatchInsight,
  getPeriodHighlight,
  getPeriodSummary,
  getPlayerInsight,
} from "../controllers/ai-insight.controller.js";
import { validateRequest } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  aiStatusSchema,
  matchInsightSchema,
  periodHighlightSchema,
  periodSummarySchema,
  playerInsightSchema,
} from "../validators/ai-insight.validation.js";

export const aiInsightRouter = Router();

aiInsightRouter.get(
  "/status",
  validateRequest(aiStatusSchema),
  asyncHandler(getAIStatus),
);
aiInsightRouter.get(
  "/summaries/:periodType",
  validateRequest(periodSummarySchema),
  asyncHandler(getPeriodSummary),
);
aiInsightRouter.get(
  "/highlights/:periodType",
  validateRequest(periodHighlightSchema),
  asyncHandler(getPeriodHighlight),
);
aiInsightRouter.get(
  "/players/:playerId",
  validateRequest(playerInsightSchema),
  asyncHandler(getPlayerInsight),
);
aiInsightRouter.get(
  "/matches/:matchId",
  validateRequest(matchInsightSchema),
  asyncHandler(getMatchInsight),
);
