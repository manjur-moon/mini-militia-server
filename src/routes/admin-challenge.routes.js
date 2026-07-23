import { USER_ROLES } from "@mini-militia/shared";
import { Router } from "express";
import { recalculateChallenges } from "../controllers/challenge.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/authorize.middleware.js";
import { validateRequest } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import { recalculateChallengesSchema } from "../validators/challenge.validation.js";

export const adminChallengeRouter = Router();
adminChallengeRouter.use(requireAuth, authorizeRoles(USER_ROLES.ADMIN));
adminChallengeRouter.post(
  "/recalculate",
  validateRequest(recalculateChallengesSchema),
  asyncHandler(recalculateChallenges),
);
