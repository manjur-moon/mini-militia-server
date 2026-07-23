import { USER_ROLES } from "@mini-militia/shared";
import { Router } from "express";
import { recalculateTitles } from "../controllers/title.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/authorize.middleware.js";
import { validateRequest } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import { recalculateTitlesSchema } from "../validators/title.validation.js";

export const adminTitleRouter = Router();

adminTitleRouter.use(requireAuth, authorizeRoles(USER_ROLES.ADMIN));
adminTitleRouter.post(
  "/recalculate",
  validateRequest(recalculateTitlesSchema),
  asyncHandler(recalculateTitles),
);
