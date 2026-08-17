import { prisma } from "@/lib/prisma";

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

export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({
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
