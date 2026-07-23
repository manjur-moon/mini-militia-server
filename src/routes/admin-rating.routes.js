import { USER_ROLES } from "@mini-militia/shared";
import { Router } from "express";
import { recalculateRatings } from "../controllers/rating.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/authorize.middleware.js";
import { validateRequest } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import { recalculateRatingSchema } from "../validators/rating.validation.js";

export const adminRatingRouter = Router();

adminRatingRouter.use(requireAuth, authorizeRoles(USER_ROLES.ADMIN));
adminRatingRouter.post(
  "/recalculate",
  validateRequest(recalculateRatingSchema),
  asyncHandler(recalculateRatings),
);
