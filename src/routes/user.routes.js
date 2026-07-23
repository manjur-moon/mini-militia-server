import { USER_ROLES } from "@mini-militia/shared";
import { Router } from "express";
import {
  getUser,
  linkUserPlayer,
  listUsers,
  unlinkUserPlayer,
  updateUserRole,
  updateUserStatus,
} from "../controllers/user.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/authorize.middleware.js";
import { validateRequest } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  linkPlayerSchema,
  listUsersSchema,
  unlinkPlayerSchema,
  updateRoleSchema,
  updateStatusSchema,
  userIdSchema,
} from "../validators/user.validation.js";

export const userRouter = Router();
userRouter.use(requireAuth, authorizeRoles(USER_ROLES.ADMIN));
userRouter.get("/", validateRequest(listUsersSchema), asyncHandler(listUsers));
userRouter.get("/:userId", validateRequest(userIdSchema), asyncHandler(getUser));
userRouter.patch(
  "/:userId/role",
  validateRequest(updateRoleSchema),
  asyncHandler(updateUserRole),
);
userRouter.patch(
  "/:userId/status",
  validateRequest(updateStatusSchema),
  asyncHandler(updateUserStatus),
);
userRouter.put(
  "/:userId/player-link",
  validateRequest(linkPlayerSchema),
  asyncHandler(linkUserPlayer),
);
userRouter.delete(
  "/:userId/player-link",
  validateRequest(unlinkPlayerSchema),
  asyncHandler(unlinkUserPlayer),
);
