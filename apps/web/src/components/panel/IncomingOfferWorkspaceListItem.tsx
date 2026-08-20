"use client";

import {
  ArrowLeftRight,
  Camera,
  Clock,
  Star,
} from "lucide-react";

import { useOfferGroupLiveUnread } from "@/components/panel/OfferGroupLiveUnreadContext";
import {
  budgetCompareListDeltaLabel,
  compareBuyerBudgetToOffer,
  formatOfferMoney,
} from "@/lib/offer/budget-offer-compare";
import {
  formatAverageRating,
  type TrustSummary,
} from "@/lib/offer/deal-review";
import {
  countNegotiationRounds,
  formatOfferRelativeTime,
  resolveOfferDecisionAmount,
  resolveOfferLastActivityAt,
} from "@/lib/offer/offer-compare-rail";
import {
  isActionRequiredOffer,
  resolveOfferCardStatusHeader,
  type OfferCardInput,
  type OfferCardStatusHeader,
} from "@/lib/offer/offer-card-status";

function sellerInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "TE";
}

function previewMessage(text: string | null | undefined): string | null {
  const raw = text?.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  if (!raw) return null;
  if (raw.length <= 96) return raw;
  return `${raw.slice(0, 93)}…`;
}

function statusTone(
  statusLabel: OfferCardStatusHeader,
  actionRequired: boolean,
): "action" | "new" | "waiting" | "accepted" | "closed" {
  if (statusLabel === "Kabul edildi") return "accepted";
  if (statusLabel === "Reddedildi" || statusLabel === "Sonuçlandı") {
    return "closed";
  }
  if (actionRequired || statusLabel === "Yanıtınız bekleniyor") {
    return "action";
  }
  if (statusLabel === "Yeni teklif") return "new";
  return "waiting";
}

const STATUS_PILL: Record<
  ReturnType<typeof statusTone>,
  string
> = {
  action:
    "border-[#e8dcc8] bg-[#faf6ef] text-[#7a5a2b] ring-1 ring-[#e8dcc8]/80",
  new: "border-teal-200/80 bg-teal-50 text-teal-900 ring-1 ring-teal-200/50",
  waiting:
    "border-[#e8dcc8]/90 bg-[#faf6ef]/80 text-[#7a5a2b] ring-1 ring-[#e8dcc8]/70",
  accepted:
    "border-emerald-200/80 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/50",
  closed:
    "border-black/8 bg-[#f6f6f4] text-black/45 ring-1 ring-black/5",
};

export function IncomingOfferWorkspaceListItem({
  firmName,
  amount,
  currency,
  deliveryDays,
  status,
  negotiations,
  description,
  createdAt,
  updatedAt,
  photoCount,
  budgetMin,
  budgetMax,
  requestCurrency,
  trust,
  isSelected,
  isUnread: isUnreadProp,
  onSelect,
}: {
  firmName: string;
  amount: number;
  currency: string;
  deliveryDays: number | null;
  status: string;
  negotiations: OfferCardInput["negotiations"];
  description?: string | null;
  createdAt: string;
  updatedAt?: string;
  photoCount: number;
  budgetMin?: number | null;
  budgetMax?: number | null;
  requestCurrency?: string | null;
  trust?: TrustSummary;
  isSelected: boolean;
  isUnread: boolean;
  onSelect: () => void;
}) {
  const isUnread = useOfferGroupLiveUnread(isUnreadProp);
  const cardInput: OfferCardInput = { status, negotiations };
  const statusLabel = resolveOfferCardStatusHeader("buyer", cardInput, {
    isUnread,
  });
  const actionRequired = isActionRequiredOffer("buyer", cardInput);
  const tone = statusTone(statusLabel, actionRequired);
  const isConcluded = tone === "accepted" || tone === "closed";

  const displayAmount = resolveOfferDecisionAmount({
    status,
    amount,
    currency,
    negotiations,
  });
  const budgetDelta = budgetCompareListDeltaLabel(
    compareBuyerBudgetToOffer({
      budgetMin,
      budgetMax,
      requestCurrency,
      offerAmount: displayAmount,
      offerCurrency: currency,
    }),
    currency,
  );

  const rounds = countNegotiationRounds(negotiations);
  const lastActivity = formatOfferRelativeTime(
    resolveOfferLastActivityAt({
      createdAt,
      updatedAt,
      negotiations,
    }),
  );
  const messagePreview = previewMessage(description);

  const trustRating =
    trust?.reviewCount && trust.averageRating != null
      ? formatAverageRating(trust.averageRating)
      : null;
  const trustLine =
    trust && (trust.completedTransactions > 0 || trustRating)
      ? [
          trust.completedTransactions > 0
            ? `${trust.completedTransactions} işlem`
            : null,
          trustRating,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={isSelected ? "true" : undefined}
      className={`group relative flex min-h-11 w-full items-stretch gap-0 overflow-hidden rounded-[16px] border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/35 focus-visible:ring-offset-2 ${
        isSelected
          ? "border-teal-800/20 bg-[#f5f9f8] shadow-[inset_2px_0_0_0_#0f5149]"
          : isConcluded
            ? "border-teal-900/6 bg-[#fafafa] opacity-90 hover:border-teal-900/12 hover:opacity-100"
            : "border-teal-900/8 bg-white hover:border-teal-800/15 hover:bg-[#fbfcfc]"
      }`}
    >
      <span className="flex min-w-0 flex-1 items-start gap-2.5 px-3 py-2.5">
        <span className="relative shrink-0">
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-full text-[11px] font-semibold text-white ${
              isConcluded ? "bg-black/35" : "bg-[#0f5149]"
            }`}
            aria-hidden
          >
            {sellerInitials(firmName)}
          </span>
          {isUnread ? (
            <span
              className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#0f766e]"
              aria-hidden
            />
          ) : null}
        </span>

        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="min-w-0 truncate text-[13px] font-semibold text-[#0f1f1d]">
              {firmName}
            </span>
            <span
              className={`inline-flex max-w-full shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold leading-tight ${STATUS_PILL[tone]}`}
            >
              {statusLabel}
            </span>
            {isUnread ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#0f766e] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-white/90" aria-hidden />
                Yeni
              </span>
            ) : null}
          </span>

          <span className="block">
            <span className="text-[1.05rem] font-semibold leading-none tracking-tight tabular-nums text-[#0f1f1d]">
              {displayAmount != null
                ? formatOfferMoney(displayAmount, currency)
                : "—"}
            </span>
            {budgetDelta ? (
              <span className="mt-1 block text-[11px] font-medium text-black/40">
                {budgetDelta}
              </span>
            ) : null}
          </span>

          {messagePreview ? (
            <p className="line-clamp-2 text-[11px] leading-4 text-black/45">
              “{messagePreview}”
            </p>
          ) : null}

          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-black/38">
            {deliveryDays != null ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3 shrink-0" aria-hidden />
                {deliveryDays} gün
              </span>
            ) : null}
            {photoCount > 0 ? (
              <span className="inline-flex items-center gap-1">
                <Camera className="h-3 w-3 shrink-0" aria-hidden />
                {photoCount}
              </span>
            ) : null}
            {rounds > 0 ? (
              <span className="inline-flex items-center gap-1">
                <ArrowLeftRight className="h-3 w-3 shrink-0" aria-hidden />
                {rounds} tur
              </span>
            ) : null}
            {lastActivity ? (
              <span className="inline-flex items-center gap-1">
                {deliveryDays != null || photoCount > 0 || rounds > 0 ? (
                  <span aria-hidden>·</span>
                ) : null}
                {lastActivity}
              </span>
            ) : null}
            {trustLine ? (
              <span className="inline-flex items-center gap-1 text-black/35">
                <span aria-hidden>·</span>
                {trustRating ? (
                  <Star className="h-3 w-3 shrink-0 text-amber-600/70" aria-hidden />
                ) : null}
                {trustLine}
              </span>
            ) : null}
          </span>
        </span>
      </span>
    </button>
  );
}
