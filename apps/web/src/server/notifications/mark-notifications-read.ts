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
  /**
   * Yazımı yapacak istemci (KB-22 Dilim 1, 2026-08-28).
   *
   * Varsayılan tekil Prisma istemcisidir. Enjekte edilebilir olması, sahiplik
   * ve idempotency sözleşmesinin GERÇEK BİR VERİTABANI OLMADAN ölçülebilmesi
   * içindir; üretim davranışı değişmez.
   */
  db?: NotificationReadClient;
};

/** Okundu yazımının ihtiyaç duyduğu en dar istemci yüzeyi. */
export type NotificationReadClient = {
  notification: {
    updateMany: (args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => Promise<{ count: number }>;
  };
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

  const db = options.db ?? (prisma as unknown as NotificationReadClient);

  const result = await db.notification.updateMany({
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

  const db = options.db ?? (prisma as unknown as NotificationReadClient);

  const result = await db.notification.updateMany({
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
