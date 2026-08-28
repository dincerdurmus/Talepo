import { notFound } from "next/navigation";
import { connection } from "next/server";

import {
  NOTIFICATION_MISSING_TARGET_HREF,
  parseOpenRequestDetailPath,
  parseOwnedRequestDetailPath,
  resolveNotificationDestination,
} from "@/lib/notifications/destination";
import { NotificationReadRedirect } from "@/components/panel/NotificationReadRedirect";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";

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

  /**
   * RENDER SALT-OKUNURDUR (KB-22 Dilim 1, 2026-08-28).
   *
   * Burada eskiden `markNotificationAsRead` çağrılıyordu. "Okundu" bir
   * KULLANICI EYLEMİDİR; sayfanın render edilmesi değildir. Sayfa artık yalnız
   * bildirimi okur ve GÜVENLİ HEDEFİ SUNUCUDA hesaplar; yazım ekran açıldıktan
   * sonra istemciden çağrılan yetkili POST'ta yürür ve yönlendirme ancak
   * BAŞARIDAN SONRA yapılır.
   */
  const complaintId = complaintIdFromActionUrl(notification.actionUrl);

  const destination = complaintId
    ? `/panel/bildirimler?sikayet=${encodeURIComponent(complaintId)}`
    : notification.title === "Şikayetiniz güncellendi"
      ? `/panel/bildirimler?sikayetBildirimi=${encodeURIComponent(notification.id)}`
      : await assertDestinationReachable(
          user.id,
          resolveNotificationDestination(notification),
        );

  return (
    <NotificationReadRedirect
      notificationId={notification.id}
      destination={destination}
    />
  );
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
