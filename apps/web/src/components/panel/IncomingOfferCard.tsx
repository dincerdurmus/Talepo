"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { MessageCircle } from "lucide-react";

import { OfferActions } from "@/components/panel/OfferActions";
import { OfferMediaThumbStrip } from "@/components/panel/OfferMediaThumbStrip";
import { OfferNegotiationPanel } from "@/components/panel/OfferNegotiationPanel";
import { TrustSummaryBadge } from "@/components/panel/TrustSummaryBadge";
import { resolveOfferCommercialAmount } from "@/lib/offer/commercial-amount";
import type { TrustSummary } from "@/lib/offer/deal-review";
import type { OfferCompleteness } from "@/lib/offer/offer-completeness";
import type { OfferNegotiationDto } from "@/lib/offer/offer-negotiation";

export type IncomingOfferCardData = {
  id: string;
  amount: number;
  currency: string;
  deliveryDays: number | null;
  title: string | null;
  description: string;
  status: string;
  companyName: string | null;
  companyVerified: boolean;
  submittedByName: string | null;
  conversationId: string | null;
  mediaIds: string[];
  negotiations: OfferNegotiationDto[];
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
  if (pending && ["SUBMITTED", "VIEWED"].includes(status)) {
    return "Pazarlıkta";
  }
  return STATUS_COPY[status] ?? status;
}

export function IncomingOfferCard({
  offer,
  actionable = false,
  completeness,
  rank,
  trust,
}: {
  offer: IncomingOfferCardData;
  actionable?: boolean;
  completeness?: OfferCompleteness;
  rank?: number;
  trust?: TrustSummary;
}) {
  const router = useRouter();
  const [composerOpen, setComposerOpen] = useState(false);
  const [panelBusy, setPanelBusy] = useState<string | null>(null);
  const [pendingBusy, setPendingBusy] = useState<string | null>(null);
  const [pendingError, setPendingError] = useState<string | null>(null);

  const firmName =
    offer.companyName || offer.submittedByName || "Firma";
  const amount = offer.amount;
  const pendingNegotiation = offer.negotiations.find(
    (row) => row.status === "PENDING",
  );
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
      ? "Güncel teklif · sıra satıcıda"
      : "Bekleyen karşı teklif"
    : offer.status === "ACCEPTED" && commercialAmount !== amount
      ? "Anlaşılan fiyat"
      : "İlk teklif";

  const postPending = useCallback(
    async (action: "accept" | "reject") => {
      if (pendingBusy || panelBusy) return;
      setPendingBusy(action);
      setPendingError(null);
      try {
        const response = await fetch(
          `/api/offers/${offer.id}/negotiations`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action }),
          },
        );
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
        setPendingError(
          err instanceof Error ? err.message : "İşlem başarısız.",
        );
      } finally {
        setPendingBusy(null);
      }
    },
    [offer.id, panelBusy, pendingBusy, router],
  );

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-white ${
        isNew
          ? "border-teal-700/20 shadow-[0_8px_24px_rgba(15,118,110,0.06)]"
          : "border-teal-900/[0.08] shadow-[0_6px_18px_rgba(15,31,29,0.03)]"
      }`}
    >
      <div className="flex flex-col gap-3 px-4 pt-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {rank != null ? (
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-[#0f1f1d] px-1.5 text-[11px] font-bold text-white">
                #{rank}
              </span>
            ) : null}
            <span
              className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                isNew
                  ? "bg-teal-600 text-white"
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
              {displayStatus}
            </span>
            {offer.companyVerified ? (
              <span className="text-[11px] font-medium text-emerald-700">
                Doğrulanmış firma
              </span>
            ) : null}
            {trust ? <TrustSummaryBadge summary={trust} /> : null}
          </div>
          <h3 className="mt-2 text-lg font-semibold tracking-tight text-[#0f1f1d]">
            {firmName}
          </h3>
          {offer.title ? (
            <p className="mt-0.5 text-sm text-black/45">{offer.title}</p>
          ) : null}
        </div>

        <div className="min-w-0 sm:max-w-[16rem] sm:text-right">
          <p
            className={`text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl ${
              pendingNegotiation ? "text-amber-950" : "text-[#0f1f1d]"
            }`}
          >
            {Number.isFinite(displayAmount)
              ? formatMoneyLabel(displayAmount, offer.currency)
              : "—"}
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-black/40">
            {priceCaption}
          </p>
          {pendingNegotiation ||
          (offer.status === "ACCEPTED" && commercialAmount !== amount) ? (
            <p className="mt-1 text-[11px] text-black/40">
              İlk teklif {originalLabel}
            </p>
          ) : null}
          {offer.deliveryDays != null ? (
            <p className="mt-1 text-xs text-black/50">
              Teslimat · {offer.deliveryDays} gün
            </p>
          ) : (
            <p className="mt-1 text-xs text-black/35">Teslimat süresi belirtilmedi</p>
          )}
        </div>
      </div>

      <div className="mt-3 max-w-prose px-4 sm:px-5">
        {offer.description ? (
          <p className="text-sm leading-6 text-black/65 break-words">{offer.description}</p>
        ) : (
          <p className="text-sm leading-6 text-black/35">
            Satıcı henüz bir açıklama eklemedi.
          </p>
        )}
        <OfferMediaThumbStrip
          offerId={offer.id}
          mediaIds={offer.mediaIds}
          compact
        />
        {completeness ? (
          <div className="mt-3 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="font-medium text-black/40">Teklif detayı</span>
                <span className="tabular-nums text-black/35">
                  {completeness.filled}/{completeness.total}
                </span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-teal-900/8">
                <div
                  className={`h-full rounded-full ${
                    completeness.score >= 85
                      ? "bg-emerald-500"
                      : completeness.score >= 65
                        ? "bg-teal-500"
                        : completeness.score >= 40
                          ? "bg-amber-400"
                          : "bg-black/20"
                  }`}
                  style={{ width: `${completeness.score}%` }}
                />
              </div>
              {completeness.missing.length > 0 ? (
                <p className="mt-1.5 text-[11px] leading-4 text-black/35">
                  {completeness.missing.join(" · ")} henüz eklenmemiş
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {actionable || offer.negotiations.length > 0 || composerOpen ? (
        <div className="px-4 sm:px-5">
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
        </div>
      ) : null}

      {myPending && awaiting ? (
        <p className="px-4 pb-3 text-xs text-amber-900/70 sm:px-5">
          Sıra teklif verende. Yanıt gelince pazarlık devam eder veya anlaşma
          oluşur.
        </p>
      ) : null}

      {pendingError ? (
        <p className="px-4 text-xs font-semibold text-[#8b352b] sm:px-5">
          {pendingError}
        </p>
      ) : null}

      {showActions ? (
        <OfferActions
          offerId={offer.id}
          hasPendingNegotiation={Boolean(pendingNegotiation)}
          originalAmountLabel={originalLabel}
          showBargain={canPropose}
          onBargain={() => setComposerOpen(true)}
          bargainDisabled={busy || composerOpen}
          locked={Boolean(panelBusy)}
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
      ) : null}

      {offer.status === "ACCEPTED" && offer.conversationId ? (
        <div className="border-t border-teal-900/8 px-4 py-3 sm:px-5">
          <Link
            href={`/panel/mesajlar/${offer.conversationId}`}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0f1f1d] px-4 text-sm font-semibold text-white sm:w-auto"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Mesajlara git
          </Link>
        </div>
      ) : null}
    </article>
  );
}
