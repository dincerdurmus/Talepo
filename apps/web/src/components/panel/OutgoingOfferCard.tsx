"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Clock, MessageCircle, Scale } from "lucide-react";

import { IncomingOfferGallery } from "@/components/panel/IncomingOfferGallery";
import { NegotiationHistory } from "@/components/panel/NegotiationHistory";
import { OfferActions } from "@/components/panel/OfferActions";
import { OfferNegotiationPanel } from "@/components/panel/OfferNegotiationPanel";
import {
  budgetCompareCopy,
  compareBuyerBudgetToOffer,
  formatOfferMoney,
} from "@/lib/offer/budget-offer-compare";
import { resolveOfferCommercialAmount } from "@/lib/offer/commercial-amount";
import type { OfferCompleteness } from "@/lib/offer/offer-completeness";
import type { OfferNegotiationDto } from "@/lib/offer/offer-negotiation";
import {
  compareNegotiationPrices,
  negotiationCompareCopy,
} from "@/lib/offer/negotiation-price-compare";
import { currentPendingNegotiation } from "@/lib/offer/outgoing-offer-inbox";

export type OutgoingOfferCardData = {
  id: string;
  requestId: string;
  amount: number;
  currency: string;
  deliveryDays: number | null;
  title: string | null;
  description: string;
  status: string;
  createdAt?: string | null;
  conversationId: string | null;
  mediaIds: string[];
  negotiations: OfferNegotiationDto[];
};

export type OutgoingBudgetContext = {
  budgetMin: number | null;
  budgetMax: number | null;
  currency: string;
};

function statusLabel(
  status: string,
  pending: OfferNegotiationDto | undefined,
) {
  if (status === "ACCEPTED") return "Kabul edildi";
  if (status === "REJECTED") return "Reddedildi";
  if (pending && ["SUBMITTED", "VIEWED"].includes(status)) {
    return "Pazarlıkta";
  }
  if (status === "SUBMITTED") return "Gönderildi";
  if (status === "VIEWED") return "Yanıt bekleniyor";
  return status;
}

function CompareRail({
  deltaLabel,
  relativeLabel,
  tone,
}: {
  deltaLabel: string;
  relativeLabel: string;
  tone: "amber" | "teal" | "neutral";
}) {
  const color =
    tone === "amber"
      ? "text-amber-950"
      : tone === "teal"
        ? "text-teal-900"
        : "text-[#0f1f1d]";
  const badge =
    tone === "amber"
      ? "bg-amber-50 text-amber-950 ring-amber-200/80"
      : tone === "teal"
        ? "bg-teal-50 text-teal-900 ring-teal-200/70"
        : "bg-[#f3f4f6] text-black/55 ring-black/5";

  return (
    <div className="flex items-center gap-3 bg-white px-4 py-3 lg:flex-col lg:justify-center lg:gap-3 lg:px-3 lg:py-6">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-[#0f766e] ring-1 ring-teal-900/10"
        aria-hidden
      >
        <Scale className="h-4 w-4" />
      </span>
      <div className="min-w-0 lg:text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800/70">
          Pazarlık durumu
        </p>
        <p className={`text-sm font-semibold tracking-tight ${color}`}>
          {deltaLabel}
        </p>
        <p
          className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${badge}`}
        >
          {relativeLabel}
        </p>
      </div>
    </div>
  );
}

export function OutgoingOfferCard({
  offer,
  budget,
  completeness,
  canMutate,
  highlightNegotiationId,
}: {
  offer: OutgoingOfferCardData;
  budget?: OutgoingBudgetContext;
  completeness?: OfferCompleteness;
  canMutate: boolean;
  highlightNegotiationId?: string | null;
}) {
  const router = useRouter();
  const [composerOpen, setComposerOpen] = useState(false);
  const [panelBusy, setPanelBusy] = useState<string | null>(null);
  const [pendingBusy, setPendingBusy] = useState<string | null>(null);
  const [pendingError, setPendingError] = useState<string | null>(null);

  const amount = offer.amount;
  const pendingNegotiation = currentPendingNegotiation(offer.negotiations);
  const acceptedNegotiation = offer.negotiations.find(
    (row) => row.status === "ACCEPTED",
  );
  const commercialAmount = resolveOfferCommercialAmount({
    offerAmount: amount,
    acceptedNegotiationAmount: acceptedNegotiation?.amount ?? null,
  });
  const awaiting = ["SUBMITTED", "VIEWED"].includes(offer.status);
  const myPending =
    Boolean(pendingNegotiation) &&
    pendingNegotiation?.proposedBySide === "PROVIDER";
  const canRespond = Boolean(
    canMutate && awaiting && pendingNegotiation && !myPending,
  );
  const canPropose = Boolean(
    canMutate && awaiting && pendingNegotiation && !myPending,
  );
  const showActions = canMutate && awaiting && !myPending && Boolean(pendingNegotiation);
  const displayStatus = statusLabel(offer.status, pendingNegotiation);
  const busy = Boolean(panelBusy) || Boolean(pendingBusy);
  const originalLabel = formatOfferMoney(amount, offer.currency);
  const pendingLabel = pendingNegotiation
    ? formatOfferMoney(pendingNegotiation.amount, offer.currency)
    : null;

  const budgetCompare = compareBuyerBudgetToOffer({
    budgetMin: budget?.budgetMin,
    budgetMax: budget?.budgetMax,
    requestCurrency: budget?.currency,
    offerAmount: amount,
    offerCurrency: offer.currency,
  });
  const budgetCopy = budgetCompareCopy(budgetCompare, offer.currency);
  const negotiationCompare = pendingNegotiation
    ? compareNegotiationPrices({
        originalAmount: amount,
        pendingAmount: pendingNegotiation.amount,
        originalCurrency: offer.currency,
        pendingCurrency: offer.currency,
      })
    : null;
  const negotiationCopy = negotiationCompare
    ? negotiationCompareCopy(negotiationCompare, offer.currency)
    : null;

  const rail = pendingNegotiation && negotiationCopy
    ? {
        deltaLabel: negotiationCopy.deltaLabel,
        relativeLabel: myPending ? "Sıra alıcıda" : "Sıra sizde",
        tone: myPending ? ("neutral" as const) : negotiationCopy.tone,
      }
    : {
        deltaLabel: budgetCopy.deltaLabel,
        relativeLabel: budgetCopy.relativeLabel,
        tone: budgetCopy.tone,
      };

  const displayAmount = pendingNegotiation
    ? pendingNegotiation.amount
    : offer.status === "ACCEPTED"
      ? commercialAmount
      : amount;

  const postPending = useCallback(
    async (action: "accept" | "reject") => {
      if (pendingBusy || panelBusy) return;
      setPendingBusy(action);
      setPendingError(null);
      try {
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
          return;
        }
        router.refresh();
      } catch (err) {
        setPendingError(err instanceof Error ? err.message : "İşlem başarısız.");
      } finally {
        setPendingBusy(null);
      }
    },
    [offer.id, panelBusy, pendingBusy, router],
  );

  return (
    <div className="grid lg:grid-cols-[7.75rem_minmax(0,1fr)]">
      <CompareRail
        deltaLabel={rail.deltaLabel}
        relativeLabel={rail.relativeLabel}
        tone={rail.tone}
      />
      <article className="min-w-0 bg-[#f4faf9] px-4 py-4 sm:px-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800/70">
          Teklifiniz
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              displayStatus === "Pazarlıkta" || displayStatus === "Sıra sizde"
                ? "bg-amber-50 text-amber-950 ring-1 ring-amber-200/80"
                : displayStatus === "Kabul edildi"
                  ? "bg-teal-50 text-teal-900"
                  : displayStatus === "Reddedildi"
                    ? "bg-[#f3f4f6] text-[#6b7280]"
                    : "bg-teal-50 text-teal-900"
            }`}
          >
            {displayStatus}
          </span>
        </div>

        <p
          className={`mt-3 text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums ${
            pendingNegotiation ? "text-amber-950" : "text-[#0f1f1d]"
          }`}
        >
          {Number.isFinite(displayAmount)
            ? formatOfferMoney(displayAmount, offer.currency)
            : "—"}
        </p>
        <p className="mt-1.5 text-[11px] font-medium text-black/40">
          {pendingNegotiation
            ? myPending
              ? "Son öneriniz"
              : "Alıcının önerisi"
            : offer.status === "ACCEPTED" && commercialAmount !== amount
              ? "Anlaşılan fiyat"
              : "İlk teklifiniz"}
        </p>
        {pendingNegotiation ? (
          <div className="mt-2 space-y-0.5 text-[11px] text-black/45">
            <p>İlk teklifiniz: {originalLabel}</p>
            {pendingNegotiation.proposedBySide === "BUYER" ? (
              <p>Alıcının önerisi: {pendingLabel}</p>
            ) : (
              <p>Sizin öneriniz: {pendingLabel}</p>
            )}
            {negotiationCopy ? <p>Fark: {negotiationCopy.deltaLabel}</p> : null}
          </div>
        ) : offer.status === "ACCEPTED" && commercialAmount !== amount ? (
          <p className="mt-0.5 text-[11px] text-black/35">
            İlk teklifiniz {originalLabel}
          </p>
        ) : null}

        {offer.deliveryDays != null ? (
          <p className="mt-2 inline-flex items-center gap-1 text-xs text-black/50">
            <Clock className="h-3.5 w-3.5 opacity-70" />
            Teslimat · {offer.deliveryDays} gün
          </p>
        ) : (
          <p className="mt-2 text-xs text-black/32">
            Teslimat süresi belirtilmedi
          </p>
        )}

        {offer.description ? (
          <p className="mt-3 text-sm leading-6 text-black/60 break-words">
            {offer.description}
          </p>
        ) : (
          <p className="mt-3 text-sm leading-6 text-black/32">
            Bu teklife henüz açıklama eklemediniz.
          </p>
        )}

        {completeness ? (
          <p className="mt-2 text-[11px] leading-4 text-teal-900/55">
            Teklif kapsamı {completeness.filled}/{completeness.total}
          </p>
        ) : null}

        <IncomingOfferGallery
          offerId={offer.id}
          mediaIds={offer.mediaIds}
          sellerName="Teklifiniz"
        />

        {canMutate || composerOpen ? (
          <OfferNegotiationPanel
            offerId={offer.id}
            originalAmount={amount}
            currency={offer.currency}
            offerStatus={offer.status}
            viewer="provider"
            negotiations={offer.negotiations}
            canMutate={canMutate}
            hideTriggers
            composerOpen={composerOpen}
            onComposerOpenChange={setComposerOpen}
            onBusyChange={setPanelBusy}
            bargainCopy
          />
        ) : null}

        <NegotiationHistory
          viewer="seller"
          originalAmount={amount}
          currency={offer.currency}
          offerStatus={offer.status}
          offerCreatedAt={offer.createdAt}
          negotiations={offer.negotiations}
          highlightNegotiationId={highlightNegotiationId}
        />

        {myPending && awaiting ? (
          <p className="mt-2 text-xs text-amber-900/70">Sıra alıcıda.</p>
        ) : null}

        {pendingError ? (
          <p className="mt-2 text-xs font-semibold text-[#8b352b]">
            {pendingError}
          </p>
        ) : null}

        {showActions ? (
          <div className="mt-4">
            <OfferActions
              offerId={offer.id}
              hasPendingNegotiation={Boolean(pendingNegotiation)}
              originalAmountLabel={originalLabel}
              showBargain={canPropose}
              onBargain={() => setComposerOpen(true)}
              bargainDisabled={busy || composerOpen}
              locked={Boolean(panelBusy)}
              layout="stack"
              pendingCounter={
                canRespond && pendingNegotiation
                  ? {
                      amountLabel: pendingLabel ?? originalLabel,
                      acceptLabel: `${pendingLabel} teklifini kabul et`,
                      rejectLabel: "Teklifi reddet",
                      hideOfferLifecycle: true,
                      onAccept: () => void postPending("accept"),
                      onReject: () => void postPending("reject"),
                      busy: pendingBusy,
                    }
                  : undefined
              }
            />
          </div>
        ) : null}

        {canMutate ? (
          <Link
            href={`/panel/talepler/${offer.requestId}/teklif`}
            className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-teal-900/80 hover:underline"
          >
            Notu güncelle
          </Link>
        ) : null}

        {offer.status === "ACCEPTED" && offer.conversationId ? (
          <Link
            href={`/panel/mesajlar/${offer.conversationId}`}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0f1f1d] px-4 text-sm font-semibold text-white"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Mesajlara git
          </Link>
        ) : null}
      </article>
    </div>
  );
}
