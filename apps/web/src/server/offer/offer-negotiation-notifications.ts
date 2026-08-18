import { formatMoneyFromCents } from "@/lib/offer/budget-offer-compare";
import { negotiationInboxPath } from "@/lib/offer/negotiation-inbox-path";
import { moneyAmountCents } from "@/lib/offer/submitted-commercial-lock";
import { prisma } from "@/lib/prisma";
import { createNotificationIfAbsent } from "@/server/notifications/create-notification";

function formatNotifyMoney(amount: number | string, currency: string) {
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return formatMoneyFromCents(moneyAmountCents(n), currency);
}

type NegotiationNotifyOffer = {
  id: string;
  submittedById: string;
  companyId: string | null;
  requestId: string;
  request: { title: string; createdById: string };
};

async function resolveSellerRecipientIds(
  offer: NegotiationNotifyOffer,
  actorUserId: string,
) {
  const ids = new Set<string>();
  if (offer.submittedById && offer.submittedById !== actorUserId) {
    ids.add(offer.submittedById);
  }
  if (!offer.companyId) {
    return [...ids];
  }

  const members = await prisma.companyMember.findMany({
    where: {
      companyId: offer.companyId,
      status: "ACTIVE",
      company: { deletedAt: null },
    },
    select: { userId: true },
  });
  for (const member of members) {
    if (member.userId && member.userId !== actorUserId) {
      ids.add(member.userId);
    }
  }
  return [...ids];
}

async function notifyRecipients(input: {
  userIds: string[];
  type:
    | "COUNTER_OFFER_RECEIVED"
    | "COUNTER_OFFER_ACCEPTED"
    | "COUNTER_OFFER_REJECTED";
  title: string;
  message: string;
  actionUrl: string;
  offer: NegotiationNotifyOffer;
}) {
  for (const userId of input.userIds) {
    try {
      await createNotificationIfAbsent({
        userId,
        type: input.type,
        title: input.title,
        message: input.message,
        actionUrl: input.actionUrl,
        requestId: input.offer.requestId,
        offerId: input.offer.id,
        companyId: input.offer.companyId ?? undefined,
      });
    } catch (error) {
      console.error("[negotiation] notification failed", {
        type: input.type,
        offerId: input.offer.id,
      });
      void error;
    }
  }
}

export async function notifyNegotiationProposed(input: {
  actorUserId: string;
  actorSide: "BUYER" | "PROVIDER";
  offer: NegotiationNotifyOffer;
  negotiationId: string;
  amount: number | string;
  currency: string;
}) {
  const money = formatNotifyMoney(input.amount, input.currency);
  const title = input.offer.request.title.trim() || "Talep";

  if (input.actorSide === "BUYER") {
    const userIds = await resolveSellerRecipientIds(
      input.offer,
      input.actorUserId,
    );
    await notifyRecipients({
      userIds,
      type: "COUNTER_OFFER_RECEIVED",
      title: "Teklifinize yeni pazarlık teklifi geldi",
      message: `${title} talebi için ${money} tutarında yeni bir fiyat önerildi.`,
      actionUrl: negotiationInboxPath(
        "seller",
        input.offer.id,
        input.negotiationId,
      ),
      offer: input.offer,
    });
    return;
  }

  const buyerId = input.offer.request.createdById;
  if (!buyerId || buyerId === input.actorUserId) return;
  await notifyRecipients({
    userIds: [buyerId],
    type: "COUNTER_OFFER_RECEIVED",
    title: "Yeni pazarlık teklifi geldi",
    message: `${title} talebiniz için ${money} tutarında yeni bir fiyat önerildi.`,
    actionUrl: negotiationInboxPath("buyer", input.offer.id, input.negotiationId),
    offer: input.offer,
  });
}

export async function notifyNegotiationRejected(input: {
  actorUserId: string;
  offer: NegotiationNotifyOffer;
  negotiationId: string;
  proposedByUserId: string;
  proposedBySide: "BUYER" | "PROVIDER";
  amount: number | string;
  currency: string;
}) {
  if (input.proposedByUserId === input.actorUserId) return;
  const money = formatNotifyMoney(input.amount, input.currency);
  const title = input.offer.request.title.trim() || "Talep";
  const recipientRole = input.proposedBySide === "BUYER" ? "buyer" : "seller";
  await notifyRecipients({
    userIds: [input.proposedByUserId],
    type: "COUNTER_OFFER_REJECTED",
    title: "Pazarlık teklifiniz reddedildi",
    message: `${title} için önerdiğiniz ${money} tutarı kabul edilmedi.`,
    actionUrl: negotiationInboxPath(
      recipientRole,
      input.offer.id,
      input.negotiationId,
    ),
    offer: input.offer,
  });
}

export async function notifyNegotiationAccepted(input: {
  actorUserId: string;
  offer: NegotiationNotifyOffer;
  negotiationId: string;
  proposedByUserId: string;
  amount: number | string;
  currency: string;
  conversationId: string;
}) {
  if (input.proposedByUserId === input.actorUserId) return;
  const money = formatNotifyMoney(input.amount, input.currency);
  const title = input.offer.request.title.trim() || "Talep";
  await notifyRecipients({
    userIds: [input.proposedByUserId],
    type: "COUNTER_OFFER_ACCEPTED",
    title: "Pazarlık teklifiniz kabul edildi",
    message: `${title} için ${money} tutarındaki pazarlık kabul edildi.`,
    actionUrl: `/panel/mesajlar/${input.conversationId}`,
    offer: input.offer,
  });
}
