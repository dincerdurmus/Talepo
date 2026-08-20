import { notFound } from "next/navigation";

import { ConversationShell } from "@/components/panel/ConversationShell";
import {
  buildConversationProcessSteps,
  formatConversationMoney,
} from "@/lib/message/conversation-process";
import { resolveOfferCommercialAmount } from "@/lib/offer/commercial-amount";
import { isBilateralDealCompleted } from "@/lib/offer/deal-completion";
import { getCompanyWorkspace } from "@/lib/panel/company-workspace";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";
import { markConversationAsRead } from "@/server/message/mark-conversation-read";
import { getDealReviewConversationState } from "@/server/offer/deal-review-service";
import {
  getCompanyTrustSummary,
  getUserTrustSummary,
} from "@/server/offer/trust-summary";
import { getDealOutcomeForConversation } from "@/server/price-intelligence/deal-outcome";

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const workspace = await getCompanyWorkspace(user.id);
  const { id } = await params;

  const participant = await prisma.conversationParticipant.findFirst({
    where: {
      conversationId: id,
      leftAt: null,
      OR: [
        { userId: user.id },
        ...(workspace ? [{ companyId: workspace.companyId }] : []),
      ],
    },
    include: {
      conversation: {
        include: {
          offer: {
            include: {
              request: {
                select: {
                  title: true,
                  id: true,
                  city: true,
                  createdById: true,
                  createdAt: true,
                  publishedAt: true,
                  coverImageUrl: true,
                  category: { select: { slug: true } },
                },
              },
              company: { select: { name: true, id: true } },
              submittedBy: { select: { name: true, id: true } },
              negotiations: {
                orderBy: { createdAt: "desc" },
                take: 5,
                select: {
                  createdAt: true,
                  status: true,
                  amount: true,
                  currency: true,
                },
              },
            },
          },
          messages: {
            orderBy: { createdAt: "asc" },
            include: {
              senderUser: { select: { name: true, id: true } },
            },
          },
        },
      },
    },
  });

  if (!participant) notFound();

  await markConversationAsRead(user.id, id);

  const offerStatus = participant.conversation.offer.status;
  const offerAccepted = offerStatus === "ACCEPTED";
  const { conversation } = participant;
  const request = conversation.offer.request;
  const isBuyer = request.createdById === user.id;
  const isSupplier = Boolean(
    conversation.offer.submittedById === user.id ||
      (workspace && conversation.offer.companyId === workspace.companyId),
  );
  const counterpartLabel = isBuyer
    ? conversation.offer.company?.name ||
      conversation.offer.submittedBy.name ||
      "Firma"
    : "Alıcı";
  const counterpartUserId = isBuyer
    ? conversation.offer.submittedById
    : request.createdById;
  const requestHref = isBuyer
    ? `/panel/taleplerim/${request.id}`
    : `/panel/talepler/${request.id}`;

  const dealRole: "buyer" | "supplier" | null = isBuyer
    ? "buyer"
    : isSupplier
      ? "supplier"
      : null;
  const dealOutcome =
    offerAccepted ? await getDealOutcomeForConversation(id) : null;
  const dealCompleted = dealOutcome
    ? isBilateralDealCompleted(dealOutcome)
    : false;
  const providerTrust = isBuyer
    ? conversation.offer.company?.id
      ? await getCompanyTrustSummary(conversation.offer.company.id)
      : await getUserTrustSummary(conversation.offer.submittedById)
    : null;
  const reviewState =
    dealCompleted && dealOutcome && dealRole
      ? await getDealReviewConversationState(
          dealOutcome.id,
          dealRole === "buyer" ? "BUYER" : "PROVIDER",
        )
      : {
          ownReview: null,
          oppositeReview: null,
          canCreateReview: false,
          windowExpired: false,
          reviewDeadlineIso: null,
          reviewDeadlineLabel: null,
        };

  const latestNegotiation = conversation.offer.negotiations[0] ?? null;
  const acceptedNegotiation =
    conversation.offer.negotiations.find((item) => item.status === "ACCEPTED") ??
    null;
  const offerAmountLabel = formatConversationMoney(
    conversation.offer.amount.toNumber(),
    conversation.offer.currency,
  );
  const negotiationAmountLabel = latestNegotiation
    ? formatConversationMoney(
        latestNegotiation.amount.toNumber(),
        latestNegotiation.currency,
      )
    : null;
  const commercialAmount = resolveOfferCommercialAmount({
    offerAmount: conversation.offer.amount.toNumber(),
    acceptedNegotiationAmount: acceptedNegotiation?.amount.toNumber() ?? null,
  });
  const agreedAmountLabel = offerAccepted
    ? formatConversationMoney(
        dealOutcome?.agreedPrice?.toNumber() ?? commercialAmount,
        dealOutcome?.currency ?? conversation.offer.currency,
      )
    : null;
  const processSteps = buildConversationProcessSteps({
    requestTitle: request.title,
    requestAt: (request.publishedAt ?? request.createdAt).toISOString(),
    hasOffer: true,
    offerAmountLabel,
    offerSubmittedAt: conversation.offer.submittedAt?.toISOString() ?? null,
    hasNegotiation: Boolean(latestNegotiation),
    negotiationAmountLabel,
    negotiationAt: latestNegotiation?.createdAt.toISOString() ?? null,
    offerAccepted,
    acceptedAmountLabel: agreedAmountLabel,
    offerAcceptedAt: conversation.offer.acceptedAt?.toISOString() ?? null,
    conversationOpened: true,
    conversationOpenedAt: conversation.createdAt.toISOString(),
    dealCompleted,
    dealCompletedAt: dealOutcome?.completedAt?.toISOString() ?? null,
    reviewSubmitted: Boolean(reviewState.ownReview),
    reviewRating: reviewState.ownReview?.rating ?? null,
    reviewSubmittedAt: reviewState.ownReview?.createdAt ?? null,
  });

  return (
    <ConversationShell
      conversationId={conversation.id}
      viewerUserId={user.id}
      counterpartLabel={counterpartLabel}
      counterpartUserId={counterpartUserId}
      requestTitle={request.title}
      requestCity={request.city}
      requestHref={requestHref}
      coverImageUrl={request.coverImageUrl}
      categorySlug={request.category?.slug ?? null}
      offerAccepted={offerAccepted}
      isSupplier={isSupplier}
      providerTrust={providerTrust}
      processSteps={processSteps}
      amountLabel={null}
      messages={conversation.messages.map((message) => ({
        id: message.id,
        type: message.type,
        content: message.content,
        fileUrl: message.fileUrl,
        fileName: message.fileName,
        senderUserId: message.senderUserId,
        createdAt: message.createdAt,
        senderUser: message.senderUser,
      }))}
      dealOutcome={
        dealOutcome && dealRole
          ? {
              id: dealOutcome.id,
              status: dealOutcome.status,
              confirmationLevel: dealOutcome.confirmationLevel,
              agreedPrice: dealOutcome.agreedPrice?.toNumber() ?? null,
              currency: dealOutcome.currency,
              buyerConfirmedAt:
                dealOutcome.buyerConfirmedAt?.toISOString() ?? null,
              supplierConfirmedAt:
                dealOutcome.supplierConfirmedAt?.toISOString() ?? null,
              completedAt: dealOutcome.completedAt?.toISOString() ?? null,
            }
          : null
      }
      dealRole={dealRole}
      dealCompleted={dealCompleted}
      reviewState={reviewState}
    />
  );
}
