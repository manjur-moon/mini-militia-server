import { USER_ROLES } from "@mini-militia/shared";
import { Router } from "express";
import {
  listAISummaries,
  regenerateAIInsight,
} from "../controllers/ai-insight.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/authorize.middleware.js";
import { validateRequest } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  listAISummariesSchema,
  regenerateAIInsightSchema,
} from "../validators/ai-insight.validation.js";

export const adminAIInsightRouter = Router();

adminAIInsightRouter.use(requireAuth, authorizeRoles(USER_ROLES.ADMIN));
adminAIInsightRouter.get(
  "/summaries",
  validateRequest(listAISummariesSchema),
  asyncHandler(listAISummaries),
);
adminAIInsightRouter.post(
  "/regenerate",
  validateRequest(regenerateAIInsightSchema),
  asyncHandler(regenerateAIInsight),
);
