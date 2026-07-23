import { Router } from "express";
import {
  getActiveMvpConfig,
  getCurrentMvp,
  listMvpAwards,
} from "../controllers/mvp.controller.js";
import { validateRequest } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  currentMvpSchema,
  emptyMvpConfigSchema,
  listMvpAwardsSchema,
} from "../validators/mvp.validation.js";

export const mvpRouter = Router();

mvpRouter.get(
  "/current",
  validateRequest(currentMvpSchema),
  asyncHandler(getCurrentMvp),
);
mvpRouter.get(
  "/awards",
  validateRequest(listMvpAwardsSchema),
  asyncHandler(listMvpAwards),
);
mvpRouter.get(
  "/config",
  validateRequest(emptyMvpConfigSchema),
  asyncHandler(getActiveMvpConfig),
);
