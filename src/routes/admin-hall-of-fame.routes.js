import { USER_ROLES } from "@mini-militia/shared";
import { Router } from "express";
import { recalculateHallOfFame } from "../controllers/hall-of-fame.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/authorize.middleware.js";
import { validateRequest } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import { recalculateHallOfFameSchema } from "../validators/hall-of-fame.validation.js";

export const adminHallOfFameRouter = Router();
adminHallOfFameRouter.use(requireAuth, authorizeRoles(USER_ROLES.ADMIN));
adminHallOfFameRouter.post(
  "/recalculate",
  validateRequest(recalculateHallOfFameSchema),
  asyncHandler(recalculateHallOfFame),
);
