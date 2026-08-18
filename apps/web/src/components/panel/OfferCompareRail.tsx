import { Scale } from "lucide-react";

import {
  formatOfferDecisionPrice,
  resolveOfferCompareDiff,
  resolveOfferCompareTurn,
  resolveOfferDecisionAmount,
} from "@/lib/offer/offer-compare-rail";
import type { OfferCardInput, OfferCardViewer } from "@/lib/offer/offer-card-status";
import type { OfferNegotiationDto } from "@/lib/offer/offer-negotiation";
import { currentPendingNegotiation } from "@/lib/offer/outgoing-offer-inbox";

const TONE_BADGE = {
  amber: "bg-amber-50/80 text-amber-900 ring-amber-200/60",
  teal: "bg-teal-50/80 text-teal-900 ring-teal-200/60",
  neutral: "bg-black/[0.03] text-black/50 ring-black/10",
} as const;

const TONE_DIFF = {
  amber: "text-amber-950",
  teal: "text-teal-900",
  neutral: "text-[#0f1f1d]",
} as const;

const TERAZI_BG =
  "bg-gradient-to-b from-amber-50/35 via-white to-teal-50/35";

function TurnHint({ turn }: { turn: string }) {
  return (
    <div className="text-right lg:text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40 lg:text-[11px]">
        Pazarlık
      </p>
      <p className="mt-0.5 text-base font-semibold leading-tight text-[#0f1f1d] lg:text-[15px]">
        {turn}
      </p>
    </div>
  );
}

function useCompareRailData(props: {
  viewer: OfferCardViewer;
  offer: OfferCardInput;
  amount: number;
  currency: string;
  budgetMin?: number | string | null;
  budgetMax?: number | string | null;
  requestCurrency?: string | null;
}) {
  const turn = resolveOfferCompareTurn(props.viewer, props.offer);
  const decisionAmount = resolveOfferDecisionAmount({
    status: props.offer.status,
    amount: props.amount,
    currency: props.currency,
    negotiations: props.offer.negotiations,
  });
  const diff = resolveOfferCompareDiff({
    status: props.offer.status,
    amount: props.amount,
    currency: props.currency,
    negotiations: props.offer.negotiations as OfferNegotiationDto[],
    budgetMin: props.budgetMin,
    budgetMax: props.budgetMax,
    requestCurrency: props.requestCurrency,
  });
  const pending = currentPendingNegotiation(props.offer.negotiations);
  const showTurnHint =
    turn !== "Sonuçlandı" &&
    (Boolean(pending) || ["SUBMITTED", "VIEWED"].includes(props.offer.status));

  return { turn, decisionAmount, diff, showTurnHint };
}

export function OfferCompareRail({
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
  const { turn, decisionAmount, diff, showTurnHint } = useCompareRailData({
    viewer,
    offer,
    amount,
    currency,
    budgetMin,
    budgetMax,
    requestCurrency,
  });

  return (
    <>
      {/* Mobile: compact horizontal terazi card */}
      <div
        className={`flex min-w-0 items-center gap-3 border-b border-teal-900/[0.06] px-4 py-3 lg:hidden ${TERAZI_BG}`}
        aria-label="Pazarlık karşılaştırması"
      >
        {showTurnHint ? (
          <div className="min-w-0 shrink-0">
            <TurnHint turn={turn} />
          </div>
        ) : null}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-teal-900/[0.06] bg-white shadow-[0_2px_8px_rgba(15,31,29,0.06)]">
          <Scale className="h-4 w-4 text-teal-700/75" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-black/40">Güncel fiyat</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums tracking-tight text-[#0f1f1d]">
            {formatOfferDecisionPrice(decisionAmount, currency)}
          </p>
          <p
            className={`mt-1 truncate text-sm font-semibold leading-tight tabular-nums tracking-tight ${TONE_DIFF[diff.tone]}`}
          >
            {diff.deltaLabel}
          </p>
          <span
            className={`mt-0.5 inline-flex max-w-full rounded-full px-2 py-0.5 text-[10px] font-semibold leading-4 ring-1 ${TONE_BADGE[diff.tone]}`}
          >
            {diff.relativeLabel}
          </span>
        </div>
      </div>

      {/* Desktop: narrow vertical strip */}
      <aside
        className={`hidden min-h-full flex-col items-center justify-center border-b border-teal-900/[0.06] px-2.5 py-5 lg:flex lg:border-b-0 lg:border-x ${TERAZI_BG}`}
        aria-label="Pazarlık karşılaştırması"
      >
        {showTurnHint ? (
          <div className="mb-3 w-full px-1">
            <TurnHint turn={turn} />
          </div>
        ) : null}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-teal-900/[0.06] bg-white shadow-[0_2px_10px_rgba(15,31,29,0.07)]">
          <Scale className="h-5 w-5 text-teal-700/75" aria-hidden />
        </div>
        <p className="mt-4 text-center text-[11px] font-medium text-black/40">
          Güncel fiyat
        </p>
        <p className="mt-0.5 text-center text-base font-semibold tabular-nums tracking-tight text-[#0f1f1d]">
          {formatOfferDecisionPrice(decisionAmount, currency)}
        </p>
        <p
          className={`mt-3 text-center text-sm font-semibold leading-tight tracking-tight tabular-nums ${TONE_DIFF[diff.tone]}`}
        >
          {diff.deltaLabel}
        </p>
        <span
          className={`mt-1.5 max-w-full rounded-full px-2 py-0.5 text-center text-[10px] font-semibold leading-4 ring-1 ${TONE_BADGE[diff.tone]}`}
        >
          {diff.relativeLabel}
        </span>
      </aside>
    </>
  );
}
