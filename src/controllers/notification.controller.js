import { notificationService } from "../services/notification.service.js";
import { sendPaginatedSuccess, sendSuccess } from "../utils/api-response.js";

function requestMeta(request) {
  return {
    requestId: request.id,
    ipAddress: request.ip,
    userAgent: request.get("user-agent") ?? null,
  };
}

export async function listNotifications(request, response) {
  const result = await notificationService.listForUser(
    request.auth.user.id,
    request.validated.query,
  );
  return sendPaginatedSuccess(response, {
    message: "Notifications retrieved successfully.",
    data: result.items,
    pagination: result.pagination,
    meta: { unreadCount: result.unreadCount },
  });
}

export async function getUnreadNotificationCount(request, response) {
  return sendSuccess(response, {
    message: "Unread notification count retrieved successfully.",
    data: {
      unreadCount: await notificationService.unreadCount(request.auth.user.id),
    },
  });
}

export async function markNotificationRead(request, response) {
  return sendSuccess(response, {
    message: "Notification marked as read.",
    data: await notificationService.markRead(
      request.auth.user.id,
      request.validated.params.notificationId,
    ),
  });
}

export async function markAllNotificationsRead(request, response) {
  return sendSuccess(response, {
    message: "All notifications marked as read.",
    data: await notificationService.markAllRead(request.auth.user.id),
  });
}

export async function listAdminNotifications(request, response) {
  const result = await notificationService.listAdmin(request.validated.query);
  return sendPaginatedSuccess(response, {
    message: "Notification management list retrieved successfully.",
    data: result.items,
    pagination: result.pagination,
  });
}

export async function createAdminNotification(request, response) {
  return sendSuccess(response, {
    statusCode: 201,
    message: "Notification sent successfully.",
    data: await notificationService.createAdmin(
      request.validated.body,
      request.auth.user,
      requestMeta(request),
    ),
  });
}
