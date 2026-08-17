/** Canonical unread condition: Notification.status === UNREAD. */

export const NOTIFICATION_UNREAD_STATUS = "UNREAD" as const;

export const unreadNotificationWhere = {
  status: NOTIFICATION_UNREAD_STATUS,
} as const;

export function notificationIsUnread(status: string) {
  return status === NOTIFICATION_UNREAD_STATUS;
}
