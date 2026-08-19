import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { unreadNotificationWhere } from "@/lib/notifications/unread";

function revalidateNotificationSurfaces() {
  revalidatePath("/panel", "layout");
  revalidatePath("/panel");
  revalidatePath("/panel/bildirimler");
}

/**
 * Marks every unread notification for the authenticated user as READ.
 * Ownership is always the server session userId — never a client-supplied id.
 */
export async function markAllNotificationsAsRead(userId: string) {
  const now = new Date();

  const result = await prisma.notification.updateMany({
    where: {
      userId,
      ...unreadNotificationWhere,
    },
    data: {
      status: "READ",
      readAt: now,
    },
  });
  revalidateNotificationSurfaces();
  return result;
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

  const result = await prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId,
      ...unreadNotificationWhere,
    },
    data: {
      status: "READ",
      readAt: now,
    },
  });
  revalidateNotificationSurfaces();
  return result;
}
