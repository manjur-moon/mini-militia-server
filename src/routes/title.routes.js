import { USER_ROLES } from "@mini-militia/shared";
import { Router } from "express";
import {
  activateTitleDefinition,
  createTitleDefinition,
  createTitleRevision,
  deactivateTitleDefinition,
  getPlayerCurrentTitle,
  getPlayerTitleHistory,
  getPublicTitle,
  listPublicTitles,
  listTitleDefinitions,
} from "../controllers/title.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/authorize.middleware.js";
import { validateRequest } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  changeTitleStatusSchema,
  createTitleDefinitionSchema,
  createTitleRevisionSchema,
  getPlayerCurrentTitleSchema,
  getPlayerTitleHistorySchema,
  getPublicTitleSchema,
  listPublicTitlesSchema,
  listTitleDefinitionsSchema,
} from "../validators/title.validation.js";

export const titleRouter = Router();

titleRouter.get(
  "/",
  validateRequest(listPublicTitlesSchema),
  asyncHandler(listPublicTitles),
);
titleRouter.get(
  "/players/:playerId/current",
  validateRequest(getPlayerCurrentTitleSchema),
  asyncHandler(getPlayerCurrentTitle),
);
titleRouter.get(
  "/players/:playerId/history",
  validateRequest(getPlayerTitleHistorySchema),
  asyncHandler(getPlayerTitleHistory),
);
titleRouter.get(
  "/definitions/:code",
  validateRequest(getPublicTitleSchema),
  asyncHandler(getPublicTitle),
);

titleRouter.use(requireAuth, authorizeRoles(USER_ROLES.ADMIN));
titleRouter.get(
  "/admin/definitions",
  validateRequest(listTitleDefinitionsSchema),
  asyncHandler(listTitleDefinitions),
);
titleRouter.post(
  "/admin/definitions",
  validateRequest(createTitleDefinitionSchema),
  asyncHandler(createTitleDefinition),
);
titleRouter.post(
  "/admin/definitions/:titleId/revisions",
  validateRequest(createTitleRevisionSchema),
  asyncHandler(createTitleRevision),
);
titleRouter.post(
  "/admin/definitions/:titleId/activate",
  validateRequest(changeTitleStatusSchema),
  asyncHandler(activateTitleDefinition),
);
titleRouter.post(
  "/admin/definitions/:titleId/deactivate",
  validateRequest(changeTitleStatusSchema),
  asyncHandler(deactivateTitleDefinition),
);
