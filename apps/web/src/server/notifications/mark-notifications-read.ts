import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { unreadNotificationWhere } from "@/lib/notifications/unread";

function revalidateNotificationSurfaces() {
  revalidatePath("/panel", "layout");
  revalidatePath("/panel");
  revalidatePath("/panel/bildirimler");
}

export type MarkNotificationsReadOptions = {
  /**
   * Revalidate the cached panel surfaces after the write.
   *
   * Must be `false` when the caller is a render (a page/layout Server
   * Component). Next.js only allows revalidation outside renders and cached
   * functions; calling it during render throws. Route handlers and Server
   * Actions are free to leave this on.
   */
  revalidate?: boolean;
};

/**
 * Marks every unread notification for the authenticated user as READ.
 * Ownership is always the server session userId — never a client-supplied id.
 */
export async function markAllNotificationsAsRead(
  userId: string,
  options: MarkNotificationsReadOptions = {},
) {
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
  if (options.revalidate !== false) revalidateNotificationSurfaces();
  return result;
}

/**
 * Marks a single notification as READ (ownership-scoped).
 * Used when the user clicks through a notification link.
 */
export async function markNotificationAsRead(
  userId: string,
  notificationId: string,
  options: MarkNotificationsReadOptions = {},
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
  if (options.revalidate !== false) revalidateNotificationSurfaces();
  return result;
}
