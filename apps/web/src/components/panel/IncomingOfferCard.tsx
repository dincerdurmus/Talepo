"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Clock, MessageCircle, Scale } from "lucide-react";

import { IncomingOfferGallery } from "@/components/panel/IncomingOfferGallery";
import { NegotiationHistory } from "@/components/panel/NegotiationHistory";
import { OfferActions } from "@/components/panel/OfferActions";
import { OfferNegotiationPanel } from "@/components/panel/OfferNegotiationPanel";
import { TrustSummaryBadge } from "@/components/panel/TrustSummaryBadge";
import {
  budgetCompareCopy,
  compareBuyerBudgetToOffer,
} from "@/lib/offer/budget-offer-compare";
import { resolveOfferCommercialAmount } from "@/lib/offer/commercial-amount";
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
  companyName: string | null;
  companyVerified: boolean;
  submittedByName: string | null;
  conversationId: string | null;
  mediaIds: string[];
  negotiations: OfferNegotiationDto[];
};

export type IncomingBudgetContext = {
  budgetMin: number | null;
  budgetMax: number | null;
  currency: string;
};

const STATUS_COPY: Record<string, string> = {
  SUBMITTED: "Yeni",
  VIEWED: "Yanıt bekliyor",
  ACCEPTED: "Kabul edildi",
  REJECTED: "Reddedildi",
  WITHDRAWN: "Geri çekildi",
  EXPIRED: "Süresi doldu",
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

function statusLabel(
  status: string,
  pending: OfferNegotiationDto | undefined,
) {
  if (status === "ACCEPTED") return "Kabul edildi";
  if (status === "REJECTED") return "Reddedildi";
  if (pending && ["SUBMITTED", "VIEWED"].includes(status)) {
    return "Pazarlıkta";
  }
  return STATUS_COPY[status] ?? status;
}

function sellerInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "TE";
}

function CompareRail({
  copy,
}: {
  copy: ReturnType<typeof budgetCompareCopy>;
}) {
  const tone =
    copy.tone === "amber"
      ? "text-amber-950"
      : copy.tone === "teal"
        ? "text-teal-900"
        : "text-[#0f1f1d]";
  const badge =
    copy.tone === "amber"
      ? "bg-amber-50 text-amber-950 ring-amber-200/80"
      : copy.tone === "teal"
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
          Fiyat karşılaştırması
        </p>
        <p className={`text-sm font-semibold tracking-tight ${tone}`}>
          {copy.deltaLabel}
        </p>
        <p
          className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${badge}`}
        >
          {copy.relativeLabel}
        </p>
      </div>
    </div>
  );
}

export function IncomingOfferCard({
  offer,
  budget,
  actionable = false,
  completeness,
  rank,
  trust,
  highlightNegotiationId,
}: {
  offer: IncomingOfferCardData;
  budget?: IncomingBudgetContext;
  actionable?: boolean;
  completeness?: OfferCompleteness;
  rank?: number;
  trust?: TrustSummary;
  highlightNegotiationId?: string | null;
}) {
  const router = useRouter();
  const [composerOpen, setComposerOpen] = useState(false);
  const [panelBusy, setPanelBusy] = useState<string | null>(null);
  const [pendingBusy, setPendingBusy] = useState<string | null>(null);
  const [pendingError, setPendingError] = useState<string | null>(null);

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
  const isNew = offer.status === "SUBMITTED" && !pendingNegotiation;
  const displayStatus = statusLabel(offer.status, pendingNegotiation);
  const busy = Boolean(panelBusy) || Boolean(pendingBusy);

  const displayAmount = pendingNegotiation
    ? pendingNegotiation.amount
    : offer.status === "ACCEPTED"
      ? commercialAmount
      : amount;
  const priceCaption = pendingNegotiation
    ? myPending
      ? "Son öneriniz"
      : "Satıcının önerisi"
    : offer.status === "ACCEPTED" && commercialAmount !== amount
      ? "Anlaşılan fiyat"
      : "İlk teklif";

  const compare = compareBuyerBudgetToOffer({
    budgetMin: budget?.budgetMin,
    budgetMax: budget?.budgetMax,
    requestCurrency: budget?.currency,
    offerAmount: Number.isFinite(displayAmount) ? displayAmount : null,
    offerCurrency: offer.currency,
  });
  const compareCopy = budgetCompareCopy(compare, offer.currency);
  const railCopy = pendingNegotiation
    ? {
        ...compareCopy,
        relativeLabel: myPending ? "Sıra satıcıda" : "Sıra sizde",
        tone: myPending ? ("neutral" as const) : ("amber" as const),
      }
    : compareCopy;

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
      <CompareRail copy={railCopy} />
      <article className="min-w-0 bg-[#f4faf9] px-4 py-4 sm:px-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800/70">
          Gelen teklif
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {rank != null ? (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#0f1f1d] px-1.5 text-[10px] font-bold text-white">
              #{rank}
            </span>
          ) : null}
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0f766e] text-[11px] font-semibold text-white"
            aria-hidden
          >
            {sellerInitials(firmName)}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold tracking-tight text-[#0f1f1d]">
              {firmName}
            </h3>
            {offer.title ? (
              <p className="truncate text-xs text-black/40">{offer.title}</p>
            ) : null}
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              isNew
                ? "bg-[#0f766e] text-white"
                : displayStatus === "Pazarlıkta"
                  ? "bg-amber-50 text-amber-950 ring-1 ring-amber-200/80"
                  : displayStatus === "Kabul edildi"
                    ? "bg-teal-50 text-teal-900"
                    : displayStatus === "Reddedildi"
                      ? "bg-[#f3f4f6] text-[#6b7280]"
                      : actionable
                        ? "bg-teal-50 text-teal-900"
                        : "bg-[#f3f4f6] text-[#4b5563]"
            }`}
          >
            {isNew ? "Yeni teklif" : displayStatus}
          </span>
          {offer.companyVerified ? (
            <span className="text-[11px] font-medium text-emerald-700">
              Doğrulanmış firma
            </span>
          ) : null}
          {trust ? <TrustSummaryBadge summary={trust} /> : null}
        </div>

        <p
          className={`mt-3 text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums ${
            pendingNegotiation ? "text-amber-950" : "text-[#0f1f1d]"
          }`}
        >
          {Number.isFinite(displayAmount)
            ? formatMoneyLabel(displayAmount, offer.currency)
            : "—"}
        </p>
        <p className="mt-1.5 text-[11px] font-medium text-black/40">
          {priceCaption}
        </p>
        {pendingNegotiation ||
        (offer.status === "ACCEPTED" && commercialAmount !== amount) ? (
          <p className="mt-0.5 text-[11px] text-black/35">
            İlk teklif {originalLabel}
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
            Satıcı henüz bir açıklama eklemedi.
          </p>
        )}

        {completeness ? (
          <p className="mt-2 text-[11px] leading-4 text-teal-900/55">
            Teklif kapsamı {completeness.filled}/{completeness.total}
            {completeness.missing.length > 0
              ? ` · ${completeness.missing.join(" · ")} henüz eklenmemiş`
              : ""}
          </p>
        ) : null}

        <IncomingOfferGallery
          offerId={offer.id}
          mediaIds={offer.mediaIds}
          sellerName={firmName}
        />

        {actionable || composerOpen ? (
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
            bargainCopy
          />
        ) : null}

        <NegotiationHistory
          viewer="buyer"
          originalAmount={amount}
          currency={offer.currency}
          offerStatus={offer.status}
          offerCreatedAt={offer.createdAt}
          negotiations={offer.negotiations}
          highlightNegotiationId={highlightNegotiationId}
        />

        {myPending && awaiting ? (
          <p className="mt-2 text-xs text-amber-900/70">Sıra satıcıda.</p>
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
                      amountLabel: formatMoneyLabel(
                        pendingNegotiation.amount,
                        offer.currency,
                      ),
                      onAccept: () => void postPending("accept"),
                      onReject: () => void postPending("reject"),
                      busy: pendingBusy,
                    }
                  : undefined
              }
            />
          </div>
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
