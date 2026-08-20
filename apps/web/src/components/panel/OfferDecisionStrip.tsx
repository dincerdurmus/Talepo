import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import {
  formatOfferDecisionPrice,
  resolveOfferCompareDiff,
  resolveOfferCompareTurn,
  resolveOfferDecisionAmount,
} from "@/lib/offer/offer-compare-rail";
import type { OfferCardInput, OfferCardViewer } from "@/lib/offer/offer-card-status";
import type { OfferNegotiationDto } from "@/lib/offer/offer-negotiation";
import { currentPendingNegotiation } from "@/lib/offer/outgoing-offer-inbox";

/**
 * Horizontal negotiation / decision strip for the selected-offer workspace.
 * Reuses OfferCompareRail authority — layout and labels only.
 *
 * Diff semantics:
 * - pending negotiation → "Pazarlık farkı" (initial vs current counter)
 * - otherwise → "Bütçe farkı" (request budget vs current price)
 */
export function OfferDecisionStrip({
  viewer,
  offer,
  amount,
  currency,
  budgetMin,
  budgetMax,
  requestCurrency,
}: {
  viewer: OfferCardViewer;
  offer: OfferCardInput;
  amount: number;
  currency: string;
  budgetMin?: number | string | null;
  budgetMax?: number | string | null;
  requestCurrency?: string | null;
}) {
  const turn = resolveOfferCompareTurn(viewer, offer);
  const decisionAmount = resolveOfferDecisionAmount({
    status: offer.status,
    amount,
    currency,
    negotiations: offer.negotiations,
  });
  const diff = resolveOfferCompareDiff({
    status: offer.status,
    amount,
    currency,
    negotiations: offer.negotiations as OfferNegotiationDto[],
    budgetMin,
    budgetMax,
    requestCurrency,
  });
  const pending = currentPendingNegotiation(offer.negotiations);
  const isNegotiationDiff = Boolean(pending);
  const showTurn =
    turn !== "Sonuçlandı" &&
    (Boolean(pending) || ["SUBMITTED", "VIEWED"].includes(offer.status));

  const negotiationUnchanged =
    isNegotiationDiff && diff.relativeLabel === "İlk teklifle aynı";

  const showDiffColumn = !(isNegotiationDiff && negotiationUnchanged);
  const diffLabel = isNegotiationDiff ? "Pazarlık farkı" : "Bütçe farkı";

  const turnTone =
    turn === "Sıra sizde" || turn.includes("satıcı") || turn.includes("alıcı")
      ? "text-[#654820]"
      : "text-[#0f1f1d]";

  const DiffIcon =
    diff.deltaLabel.includes("üstünde") ||
    diff.deltaLabel.includes("yukarı") ||
    diff.relativeLabel.includes("üstünde")
      ? ArrowUpRight
      : diff.deltaLabel.includes("altında") ||
          diff.deltaLabel.includes("aşağı") ||
          diff.relativeLabel.includes("altında")
        ? ArrowDownRight
        : null;

  const cellClass =
    "min-w-0 sm:border-l sm:border-teal-900/[0.09] sm:pl-3 sm:first:border-l-0 sm:first:pl-0";
  const columnLabelClass =
    "text-[10px] font-medium uppercase tracking-[0.08em] text-[#0f1f1d]/58";

  return (
    <div
      className="rounded-[12px] border border-teal-900/6 bg-[#f7faf9]/90 px-3 py-2.5 sm:px-3.5"
      aria-label="Pazarlık durumu"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#3d5c58]/78">
        Pazarlık durumu
      </p>

      <div
        className={`mt-2 grid gap-2.5 sm:grid-cols-2 ${
          showDiffColumn ? "lg:grid-cols-4" : "lg:grid-cols-3"
        }`}
      >
        <div className={cellClass}>
          <p className={columnLabelClass}>
            {showTurn ? "Sıra" : "Durum"}
          </p>
          <p className={`mt-0.5 text-[13px] font-semibold leading-snug ${turnTone}`}>
            {turn}
          </p>
        </div>

        <div className={cellClass}>
          <p className={columnLabelClass}>Güncel fiyat</p>
          <p className="mt-0.5 text-[13px] font-semibold tabular-nums tracking-tight text-[#0f1f1d]/88">
            {formatOfferDecisionPrice(decisionAmount, currency)}
          </p>
        </div>

        <div className={cellClass}>
          <p className={columnLabelClass}>İlk teklif</p>
          <p className="mt-0.5 text-[13px] font-medium tabular-nums text-[#0f1f1d]/72">
            {formatOfferDecisionPrice(amount, currency)}
          </p>
        </div>

        {showDiffColumn ? (
          <div className={cellClass}>
            <p className={columnLabelClass}>{diffLabel}</p>
            <p
              className={`mt-0.5 inline-flex items-center gap-1 text-[13px] font-semibold tabular-nums ${
                diff.tone === "amber"
                  ? "text-[#654820]"
                  : diff.tone === "teal"
                    ? "text-[#0f5149]"
                    : "text-[#0f1f1d]/85"
              }`}
            >
              {DiffIcon ? (
                <DiffIcon className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              ) : null}
              {diff.deltaLabel}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-[#0f1f1d]/62">
              {diff.relativeLabel}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
