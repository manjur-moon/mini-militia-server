import { Router } from "express";
import {
  getHallOfFameCategory,
  getPlayerHallOfFame,
  listHallOfFame,
} from "../controllers/hall-of-fame.controller.js";
import { validateRequest } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  getHallOfFameCategorySchema,
  getPlayerHallOfFameSchema,
  listHallOfFameSchema,
} from "../validators/hall-of-fame.validation.js";

export const hallOfFameRouter = Router();

hallOfFameRouter.get(
  "/",
  validateRequest(listHallOfFameSchema),
  asyncHandler(listHallOfFame),
);
hallOfFameRouter.get(
  "/players/:playerId",
  validateRequest(getPlayerHallOfFameSchema),
  asyncHandler(getPlayerHallOfFame),
);
hallOfFameRouter.get(
  "/:category",
  validateRequest(getHallOfFameCategorySchema),
  asyncHandler(getHallOfFameCategory),
);
