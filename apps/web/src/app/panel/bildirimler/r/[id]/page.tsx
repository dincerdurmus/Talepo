import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import {
  NOTIFICATION_MISSING_TARGET_HREF,
  parseOpenRequestDetailPath,
  parseOwnedRequestDetailPath,
  resolveNotificationDestination,
} from "@/lib/notifications/destination";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";
import { markNotificationAsRead } from "@/server/notifications/mark-notifications-read";

export const dynamic = "force-dynamic";

/**
 * Click-through: mark one owned notification READ, then continue to a
 * sanitized panel destination. Notification.id is never used as Request.id.
 */
export default async function NotificationRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  await connection();
  const { id } = await params;

  const notification = await prisma.notification.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      type: true,
      title: true,
      actionUrl: true,
      requestId: true,
      offerId: true,
      companyId: true,
    },
  });

  if (!notification) notFound();

  // No revalidation here: this is a render, and Next.js only allows
  // revalidation outside renders. The redirect below starts a fresh request,
  // so the destination re-renders with the updated read state anyway.
  await markNotificationAsRead(user.id, notification.id, { revalidate: false });

  const complaintId = complaintIdFromActionUrl(notification.actionUrl);
  if (complaintId) {
    redirect(`/panel/bildirimler?sikayet=${encodeURIComponent(complaintId)}`);
  }

  if (notification.title === "Şikayetiniz güncellendi") {
    redirect(`/panel/bildirimler?sikayetBildirimi=${encodeURIComponent(notification.id)}`);
  }

  const destination = resolveNotificationDestination(notification);
  const reachable = await assertDestinationReachable(user.id, destination);
  redirect(reachable);
}

function complaintIdFromActionUrl(actionUrl: string | null) {
  if (!actionUrl) return null;
  const match = /^\/panel\/bildirimler\?complaint=([^&#/?]+)$/.exec(actionUrl);
  return match?.[1] ?? null;
}

async function assertDestinationReachable(userId: string, destination: string) {
  const ownedRequestId = parseOwnedRequestDetailPath(destination);
  if (ownedRequestId) {
    const request = await prisma.request.findFirst({
      where: {
        id: ownedRequestId,
        createdById: userId,
        deletedAt: null,
      },
      select: { id: true },
    });
    return request ? destination : NOTIFICATION_MISSING_TARGET_HREF;
  }

  const openRequestId = parseOpenRequestDetailPath(destination);
  if (openRequestId) {
    const request = await prisma.request.findFirst({
      where: {
        id: openRequestId,
        deletedAt: null,
      },
      select: { id: true },
    });
    return request ? destination : NOTIFICATION_MISSING_TARGET_HREF;
  }

  return destination;
}
