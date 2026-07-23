import { USER_ROLES } from "@mini-militia/shared";
import { Router } from "express";
import { recalculateRivalries } from "../controllers/rivalry.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/authorize.middleware.js";
import { validateRequest } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import { recalculateRivalriesSchema } from "../validators/rivalry.validation.js";

export const adminRivalryRouter = Router();

adminRivalryRouter.use(requireAuth, authorizeRoles(USER_ROLES.ADMIN));
adminRivalryRouter.post(
  "/recalculate",
  validateRequest(recalculateRivalriesSchema),
  asyncHandler(recalculateRivalries),
);
