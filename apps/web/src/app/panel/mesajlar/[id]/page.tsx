import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";

import { MessageComposer } from "@/components/panel/MessageComposer";
import { DealOutcomePanel } from "@/components/panel/DealOutcomePanel";
import { DealReviewPanel } from "@/components/panel/DealReviewPanel";
import { TrustSummaryBadge } from "@/components/panel/TrustSummaryBadge";
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
                },
              },
              company: { select: { name: true, id: true } },
              submittedBy: { select: { name: true } },
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
  const canSendMessages = offerAccepted;
  const { conversation } = participant;
  const request = conversation.offer.request;
  const isBuyer = request.createdById === user.id;
  const isSupplier = Boolean(
    conversation.offer.submittedById === user.id ||
      (workspace && conversation.offer.companyId === workspace.companyId),
  );
  const counterpart = isBuyer
    ? conversation.offer.company?.name ||
      conversation.offer.submittedBy.name ||
      "Firma"
    : "Alıcı";
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

  return (
    <>
      <header className="rounded-2xl border border-teal-900/8 bg-gradient-to-br from-white via-[#f8fcfb] to-[#eef6f8] px-5 py-4 shadow-[0_12px_40px_rgba(15,118,110,0.04)]">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/panel/mesajlar"
            className="flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-teal-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Mesajlar
          </Link>
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            {counterpart}
            {isBuyer && providerTrust ? (
              <TrustSummaryBadge summary={providerTrust} />
            ) : null}
          </p>
        </div>

        <Link
          href={requestHref}
          className="mt-3 flex items-start gap-3 rounded-xl border border-teal-800/12 bg-[#f0faf7] px-3.5 py-3 transition hover:border-teal-700/25 hover:bg-[#e7f7f2]"
        >
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-800/10 text-teal-800">
            <FileText className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-teal-800/55">
              Talep başlığı
            </span>
            <span className="mt-0.5 block truncate text-sm font-semibold text-teal-950">
              {request.title}
            </span>
            {request.city && (
              <span className="mt-0.5 block text-xs text-teal-900/50">
                {request.city}
              </span>
            )}
          </span>
        </Link>
      </header>

      {!offerAccepted ? (
        <p className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950/80">
          Bu yazışma salt okunur. Fiyat pazarlığı karşı teklif turlarıyla
          yapılır; yeni mesaj ancak anlaşmadan sonra gönderilebilir.
        </p>
      ) : null}

      {dealOutcome && dealRole && (
        <>
          <DealOutcomePanel
            dealOutcome={{
              id: dealOutcome.id,
              status: dealOutcome.status,
              confirmationLevel: dealOutcome.confirmationLevel,
              agreedPrice: dealOutcome.agreedPrice?.toNumber() ?? null,
              currency: dealOutcome.currency,
              buyerConfirmedAt: dealOutcome.buyerConfirmedAt?.toISOString() ?? null,
              supplierConfirmedAt:
                dealOutcome.supplierConfirmedAt?.toISOString() ?? null,
              completedAt: dealOutcome.completedAt?.toISOString() ?? null,
            }}
            role={dealRole}
          />
          {dealCompleted ? (
            <DealReviewPanel
              dealOutcomeId={dealOutcome.id}
              existingReview={reviewState.ownReview}
              oppositeReview={reviewState.oppositeReview}
              canCreateReview={reviewState.canCreateReview}
              windowExpired={reviewState.windowExpired}
              reviewDeadlineLabel={reviewState.reviewDeadlineLabel}
            />
          ) : null}
        </>
      )}

      <section className="mt-5 flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-teal-900/8 bg-white shadow-[0_18px_55px_rgba(15,118,110,0.05)]">
        <div className="flex-1 space-y-3.5 overflow-y-auto bg-gradient-to-b from-[#f7fbfa] to-white p-5 sm:p-6">
          {conversation.messages.length === 0 ? (
            <p className="text-center text-sm text-slate-400">
              Henüz mesaj yok. İlk mesajı siz gönderebilirsiniz.
            </p>
          ) : (
            conversation.messages.map((message) => {
              if (message.type === "SYSTEM") {
                return (
                  <div key={message.id} className="flex justify-center">
                    <p className="max-w-[90%] rounded-xl border border-teal-900/8 bg-white/80 px-3 py-2 text-center text-xs leading-5 text-slate-500">
                      {message.content}
                    </p>
                  </div>
                );
              }

              const isMine = message.senderUserId === user.id;
              const isImage =
                message.type === "IMAGE" && Boolean(message.fileUrl);

              return (
                <div
                  key={message.id}
                  className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] overflow-hidden rounded-2xl text-sm leading-6 shadow-sm ${
                      isMine
                        ? "bg-teal-800 text-white shadow-teal-900/10"
                        : "border border-slate-200/70 bg-white text-slate-700"
                    }`}
                  >
                    {!isMine && (
                      <p
                        className={`px-4 pt-3 text-xs font-semibold ${
                          isMine ? "text-white/55" : "text-slate-400"
                        }`}
                      >
                        {message.senderUser.name}
                      </p>
                    )}

                    {isImage ? (
                      <div className={message.content || !isMine ? "pt-2" : ""}>
                        <a
                          href={message.fileUrl!}
                          target="_blank"
                          rel="noreferrer"
                          className="block"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={message.fileUrl!}
                            alt={message.fileName || "Sohbet görseli"}
                            className={`max-h-72 w-full object-cover ${
                              message.content ? "" : isMine ? "" : "mt-2"
                            }`}
                          />
                        </a>
                        {message.content && (
                          <p className="px-4 py-3">{message.content}</p>
                        )}
                        {!message.content && <div className="h-1" />}
                      </div>
                    ) : (
                      <p className="px-4 py-3">{message.content}</p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <MessageComposer
          conversationId={conversation.id}
          canSend={canSendMessages}
          canSendImages={offerAccepted && isSupplier}
        />
      </section>
    </>
  );
}
