import { prisma } from "@/lib/prisma";

/**
 * Marks every unread notification for the user as READ.
 * Used when the user opens the notifications inbox.
 */
export async function markAllNotificationsAsRead(userId: string) {
  const now = new Date();

  return prisma.notification.updateMany({
    where: {
      userId,
      status: "UNREAD",
    },
    data: {
      status: "READ",
      readAt: now,
    },
  });
}

/**
 * Marks a single notification as READ (ownership-scoped).
 * Used when the user clicks through a notification link.
 */
export async function markNotificationAsRead(
  userId: string,
  notificationId: string,
) {
  const now = new Date();

  return prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId,
      status: "UNREAD",
    },
    data: {
      status: "READ",
      readAt: now,
    },
  });
}
