import { USER_ROLES } from "@mini-militia/shared";
import { Router } from "express";
import {
  createAdminNotification,
  listAdminNotifications,
} from "../controllers/notification.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/authorize.middleware.js";
import { validateRequest } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  createAdminNotificationSchema,
  listAdminNotificationsSchema,
} from "../validators/notification.validation.js";

export const adminNotificationRouter = Router();

adminNotificationRouter.use(requireAuth, authorizeRoles(USER_ROLES.ADMIN));
adminNotificationRouter.get(
  "/",
  validateRequest(listAdminNotificationsSchema),
  asyncHandler(listAdminNotifications),
);
adminNotificationRouter.post(
  "/",
  validateRequest(createAdminNotificationSchema),
  asyncHandler(createAdminNotification),
);
