import { prisma } from "@/lib/prisma";
import { unarchiveOfferOnNewEvent } from "@/server/offer/offer-archive-service";

type CreateNotificationInput = {
  userId: string;
  type:
    | "GENERAL"
    | "REQUEST_PUBLISHED"
    | "NEW_REQUEST_MATCH"
    | "NEW_OFFER"
    | "OFFER_VIEWED"
    | "OFFER_ACCEPTED"
    | "OFFER_REJECTED"
    | "OFFER_NEGOTIATE"
    | "COUNTER_OFFER_RECEIVED"
    | "COUNTER_OFFER_ACCEPTED"
    | "COUNTER_OFFER_REJECTED"
    | "DEAL_COMPLETION_REQUESTED"
    | "DEAL_COMPLETED"
    | "DEAL_REVIEW_RECEIVED"
    | "NEW_MESSAGE"
    | "COMPANY_INVITATION"
    | "COMPANY_MEMBER_JOINED";
  title: string;
  message: string;
  actionUrl?: string;
  requestId?: string;
  offerId?: string;
  companyId?: string;
};

/**
 * Bildirimi yazacak istemci (KB-22, 2026-08-28).
 *
 * Varsayılan tekil Prisma istemcisidir. Bir transaction içinde yazmak
 * gerektiğinde çağıran kendi `tx` istemcisini geçer; böylece claim ile
 * bildirim aynı işlemde kalır. İKİNCİ BİR BİLDİRİM YAZMA KOPYASI AÇILMAZ —
 * kanonik yazıcı burada tektir.
 */
export type NotificationWriteClient = {
  notification: { create: (args: { data: unknown }) => Promise<unknown> };
};

export async function createNotification(
  input: CreateNotificationInput,
  client: NotificationWriteClient = prisma as unknown as NotificationWriteClient,
) {
  return client.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      actionUrl: input.actionUrl,
      requestId: input.requestId,
      offerId: input.offerId,
      companyId: input.companyId,
    },
  });
}

/** One row per recipient + type + offer + exact actionUrl (includes negotiation round). */
export async function createNotificationIfAbsent(
  input: CreateNotificationInput,
) {
  if (input.offerId && input.actionUrl) {
    const existing = await prisma.notification.findFirst({
      where: {
        userId: input.userId,
        type: input.type,
        offerId: input.offerId,
        actionUrl: input.actionUrl,
      },
      select: { id: true },
    });
    if (existing) return existing;
  }
  const created = await createNotification(input);
  if (input.offerId) {
    await unarchiveOfferOnNewEvent({
      userId: input.userId,
      offerId: input.offerId,
      companyId: input.companyId ?? null,
    });
  }
  return created;
}
