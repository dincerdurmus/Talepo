import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";
import { markNotificationAsRead } from "@/server/notifications/mark-notifications-read";

/**
 * Click-through: mark one notification READ, then continue to its actionUrl.
 */
export default async function NotificationRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const notification = await prisma.notification.findFirst({
    where: { id, userId: user.id },
    select: { id: true, actionUrl: true },
  });

  if (!notification) notFound();

  await markNotificationAsRead(user.id, notification.id);

  redirect(notification.actionUrl || "/panel/bildirimler");
}
