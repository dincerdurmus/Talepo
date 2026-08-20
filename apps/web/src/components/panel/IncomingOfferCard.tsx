"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { MessageCircle } from "lucide-react";

import { IncomingOfferGallery } from "@/components/panel/IncomingOfferGallery";
import { NegotiationHistory } from "@/components/panel/NegotiationHistory";
import { OfferActions } from "@/components/panel/OfferActions";
import { OfferMessageBlock } from "@/components/panel/OfferMessageBlock";
import { OfferArchiveActions } from "@/components/panel/OfferArchiveActions";
import { OfferNegotiationPanel } from "@/components/panel/OfferNegotiationPanel";
import { OfferWaitingFooter } from "@/components/panel/OfferWaitingFooter";
import { useOfferGroupLiveUnread } from "@/components/panel/OfferGroupLiveUnreadContext";
import { TrustSummaryBadge } from "@/components/panel/TrustSummaryBadge";
import { resolveOfferCommercialAmount } from "@/lib/offer/commercial-amount";
import {
  isActionRequiredOffer,
  resolveOfferCardStatusHeader,
  resolveOfferPriceCaption,
} from "@/lib/offer/offer-card-status";
import type { TrustSummary } from "@/lib/offer/deal-review";
import type { OfferCompleteness } from "@/lib/offer/offer-completeness";
import type { OfferNegotiationDto } from "@/lib/offer/offer-negotiation";
import { currentPendingNegotiation } from "@/lib/offer/outgoing-offer-inbox";

export type IncomingOfferCardData = {
  id: string;
  amount: number;
  currency: string;
  deliveryDays: number | null;
  title: string | null;
  description: string;
  status: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  companyName: string | null;
  companyVerified: boolean;
  submittedByName: string | null;
  conversationId: string | null;
  mediaIds: string[];
  negotiations: OfferNegotiationDto[];
};

function formatMoneyLabel(amount: number, currency: string) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency:
      currency === "USD" || currency === "EUR" || currency === "GBP"
        ? currency
        : "TRY",
    maximumFractionDigits: 0,
  }).format(amount);
}

function sellerInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "TE";
}

export function IncomingOfferCard({
  offer,
  actionable = false,
  completeness,
  rank,
  trust,
  highlightNegotiationId,
  isUnread: isUnreadProp = false,
  compareStripLayout = false,
  decisionDesk = false,
  canArchive = false,
  isArchived = false,
}: {
  offer: IncomingOfferCardData;
  actionable?: boolean;
  completeness?: OfferCompleteness;
  rank?: number;
  trust?: TrustSummary;
  highlightNegotiationId?: string | null;
  isUnread?: boolean;
  compareStripLayout?: boolean;
  /** Selected-offer decision workspace: stronger header, editorial note, slim waiting. */
  decisionDesk?: boolean;
  canArchive?: boolean;
  isArchived?: boolean;
}) {
  const router = useRouter();
  const isUnread = useOfferGroupLiveUnread(isUnreadProp);
  const [composerOpen, setComposerOpen] = useState(false);
  const [panelBusy, setPanelBusy] = useState<string | null>(null);
  const [negotiationSent, setNegotiationSent] = useState(false);

  const firmName = offer.companyName || offer.submittedByName || "Firma";
  const amount = offer.amount;
  const pendingNegotiation = currentPendingNegotiation(offer.negotiations);
  const acceptedNegotiation = offer.negotiations.find(
    (row) => row.status === "ACCEPTED",
  );
  const commercialAmount = resolveOfferCommercialAmount({
    offerAmount: amount,
    acceptedNegotiationAmount: acceptedNegotiation?.amount ?? null,
  });
  const originalLabel = Number.isFinite(amount)
    ? formatMoneyLabel(amount, offer.currency)
    : undefined;
  const awaiting = ["SUBMITTED", "VIEWED"].includes(offer.status);
  const myPending =
    Boolean(pendingNegotiation) &&
    pendingNegotiation?.proposedBySide === "BUYER";
  const canRespond = Boolean(
    actionable && awaiting && pendingNegotiation && !myPending,
  );
  const canPropose = Boolean(
    actionable && awaiting && (!pendingNegotiation || !myPending),
  );
  const showActions = actionable && awaiting && !myPending;
  const busy = Boolean(panelBusy);
  const cardInput = {
    status: offer.status,
    negotiations: offer.negotiations,
  };
  const actionRequired = isActionRequiredOffer("buyer", cardInput);
  const statusHeader = resolveOfferCardStatusHeader("buyer", cardInput, {
    isUnread,
  });
  const showWaitingFooter =
    awaiting &&
    !showActions &&
    !composerOpen &&
    !negotiationSent &&
    (myPending ||
      statusHeader === "Satıcının yanıtı bekleniyor" ||
      statusHeader === "Alıcının yanıtı bekleniyor");
  const waitingHint = myPending
    ? "Karşı taraf yanıt verdiğinde bildirim alırsınız."
    : "Teklif süreci devam ediyor; yanıt gelince burada görürsünüz.";

  const displayAmount = pendingNegotiation
    ? pendingNegotiation.amount
    : offer.status === "ACCEPTED"
      ? commercialAmount
      : amount;
  const decisionAmountLabel = Number.isFinite(displayAmount)
    ? formatMoneyLabel(displayAmount, offer.currency)
    : undefined;
  const priceCaption = resolveOfferPriceCaption("buyer", {
    status: offer.status,
    amount,
    currency: offer.currency,
    negotiations: offer.negotiations,
  });

  const sectionOrder = compareStripLayout ? "order-2" : "";
  const galleryOrder = compareStripLayout ? "order-4" : "";
  const historyOrder = compareStripLayout ? "order-5" : "";
  const panelOrder = compareStripLayout ? "order-6" : "";
  const footerOrder = compareStripLayout ? "order-9" : "";
  const terminalOrder = compareStripLayout ? "order-10" : "";
  const archiveOrder = compareStripLayout ? "order-11" : "";

  const postPending = useCallback(
    async (action: "accept" | "reject"): Promise<void> => {
      if (panelBusy) {
        throw new Error("İşlem devam ediyor.");
      }
      const response = await fetch(`/api/offers/${offer.id}/negotiations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = (await response.json()) as {
        message?: string;
        redirectTo?: string;
      };
      if (!response.ok) {
        throw new Error(result.message || "İşlem tamamlanamadı.");
      }
      if (result.redirectTo) {
        router.push(result.redirectTo);
      }
    },
    [offer.id, panelBusy, router],
  );

  return (
    <article
      className={`min-w-0 ${
        decisionDesk ? "bg-white px-4 pb-4 pt-3 sm:px-5 sm:pb-5" : "bg-[#f4faf9] px-4 py-4 sm:px-5"
      } ${compareStripLayout ? "flex flex-col" : ""}`}
    >
      <div
        className={`flex flex-wrap items-start gap-2.5 ${
          compareStripLayout ? "order-1" : ""
        }`}
      >
        {rank != null ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#0f1f1d] px-1.5 text-[10px] font-bold text-white">
            #{rank}
          </span>
        ) : null}
        <span
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0f5149] text-[11px] font-semibold text-white"
          aria-hidden
        >
          {sellerInitials(firmName)}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold tracking-tight text-[#0f1f1d] sm:text-base">
            {firmName}
          </h3>
          {offer.title ? (
            <p className="truncate text-xs text-black/40">{offer.title}</p>
          ) : null}
          {trust ? (
            <div className="mt-1">
              <TrustSummaryBadge summary={trust} />
            </div>
          ) : null}
        </div>
        {isUnread ? (
          <span className="rounded-full bg-[#0f766e] px-2 py-0.5 text-[11px] font-semibold text-white">
            Yeni
          </span>
        ) : null}
        {offer.companyVerified ? (
          <span className="text-[11px] font-medium text-emerald-700">
            Doğrulanmış firma
          </span>
        ) : null}
      </div>

      {isUnread ? (
        <p className={`sr-only ${compareStripLayout ? "order-1" : ""}`}>Okunmadı</p>
      ) : null}

      <div className={`${decisionDesk ? "mt-2.5" : "mt-3"} ${compareStripLayout ? "order-1" : ""}`}>
        <p
          className={`${
            decisionDesk
              ? "text-[1.6rem] sm:text-[1.75rem]"
              : "text-[1.55rem] sm:text-[1.7rem]"
          } font-semibold leading-none tracking-tight tabular-nums ${
            pendingNegotiation ? "text-amber-950" : "text-[#0f1f1d]"
          }`}
        >
          {Number.isFinite(displayAmount)
            ? formatMoneyLabel(displayAmount, offer.currency)
            : "—"}
        </p>
        <p
          className={`mt-1.5 text-[13px] font-semibold ${
            actionRequired
              ? "text-[#7a5a2b]"
              : statusHeader === "Kabul edildi"
                ? "text-teal-900"
                : statusHeader === "Reddedildi"
                  ? "text-[#6b7280]"
                  : "text-[#0f1f1d]/70"
          }`}
        >
          {statusHeader}
        </p>
        {!compareStripLayout ? (
          <p className="mt-1 text-[11px] font-medium text-black/40">
            {priceCaption}
          </p>
        ) : null}
      </div>

      <div className={sectionOrder}>
        <OfferMessageBlock
          label="Satıcının mesajı"
          message={offer.description}
          emptyLabel="Satıcı henüz bir açıklama eklemedi."
          variant={decisionDesk ? "editorial" : "panel"}
        />
      </div>

      <div className={galleryOrder}>
        <IncomingOfferGallery
          offerId={offer.id}
          mediaIds={offer.mediaIds}
          sellerName={firmName}
        />
      </div>

      <div className={historyOrder}>
        <NegotiationHistory
          viewer="buyer"
          originalAmount={amount}
          currency={offer.currency}
          offerStatus={offer.status}
          offerCreatedAt={offer.createdAt}
          negotiations={offer.negotiations}
          highlightNegotiationId={highlightNegotiationId}
          deliveryDays={offer.deliveryDays}
          completeness={completeness}
        />
      </div>

      {actionable || composerOpen ? (
        <div className={panelOrder}>
          <OfferNegotiationPanel
            offerId={offer.id}
            originalAmount={amount}
            currency={offer.currency}
            offerStatus={offer.status}
            viewer="buyer"
            negotiations={offer.negotiations}
            canMutate={actionable}
            hideTriggers
            composerOpen={composerOpen}
            onComposerOpenChange={setComposerOpen}
            onBusyChange={setPanelBusy}
            onProposeSuccess={() => setNegotiationSent(true)}
            bargainCopy
          />
        </div>
      ) : null}

      {showActions ? (
        <div className={`${footerOrder} ${decisionDesk ? "mt-4" : ""}`}>
          <OfferActions
            offerId={offer.id}
            hasPendingNegotiation={Boolean(pendingNegotiation)}
            originalAmountLabel={originalLabel}
            acceptAmountLabel={decisionAmountLabel}
            showBargain={canPropose}
            onBargain={() => setComposerOpen(true)}
            bargainDisabled={busy || composerOpen}
            locked={Boolean(panelBusy)}
            layout={decisionDesk ? "compact" : "footer"}
            composerOpen={composerOpen}
            negotiationSent={negotiationSent}
            negotiationSubmitting={panelBusy === "propose"}
            waitingMessage="Satıcının yanıtı bekleniyor"
            waitingHint="Karşı taraf yanıt verdiğinde bildirim alırsınız."
            pendingCounter={
              canRespond && pendingNegotiation
                ? {
                    amountLabel: formatMoneyLabel(
                      pendingNegotiation.amount,
                      offer.currency,
                    ),
                    onAccept: () => postPending("accept"),
                    onReject: () => postPending("reject"),
                  }
                : undefined
            }
          />
        </div>
      ) : null}

      {showWaitingFooter ? (
        <div className={`${footerOrder} ${decisionDesk ? "mt-2" : ""}`}>
          <OfferWaitingFooter
            message={decisionDesk ? waitingHint : statusHeader}
            hint={decisionDesk ? undefined : waitingHint}
            compact={decisionDesk}
          />
        </div>
      ) : null}

      {offer.status === "ACCEPTED" && offer.conversationId ? (
        <Link
          href={`/panel/mesajlar/${offer.conversationId}`}
          className={`${terminalOrder} mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0f1f1d] px-4 text-sm font-semibold text-white`}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Mesajlara git
        </Link>
      ) : null}

      <div className={archiveOrder}>
        <OfferArchiveActions
          offerId={offer.id}
          role="buyer"
          canArchive={canArchive}
          isArchived={isArchived}
        />
      </div>
    </article>
  );
}
