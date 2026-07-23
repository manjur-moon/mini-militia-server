import { Router } from "express";
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../controllers/notification.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { validateRequest } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  getUnreadNotificationCountSchema,
  listNotificationsSchema,
  markAllNotificationsReadSchema,
  markNotificationReadSchema,
} from "../validators/notification.validation.js";

export const notificationRouter = Router();

notificationRouter.use(requireAuth);
notificationRouter.get(
  "/unread-count",
  validateRequest(getUnreadNotificationCountSchema),
  asyncHandler(getUnreadNotificationCount),
);
notificationRouter.patch(
  "/read-all",
  validateRequest(markAllNotificationsReadSchema),
  asyncHandler(markAllNotificationsRead),
);
notificationRouter.patch(
  "/:notificationId/read",
  validateRequest(markNotificationReadSchema),
  asyncHandler(markNotificationRead),
);
notificationRouter.get(
  "/",
  validateRequest(listNotificationsSchema),
  asyncHandler(listNotifications),
);
