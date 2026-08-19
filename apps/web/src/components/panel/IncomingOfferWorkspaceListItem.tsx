"use client";

import {
  Camera,
  ChevronRight,
} from "lucide-react";

import { useOfferGroupLiveUnread } from "@/components/panel/OfferGroupLiveUnreadContext";
import {
  countNegotiationRounds,
  formatOfferRelativeTime,
  resolveOfferDecisionAmount,
  resolveOfferLastActivityAt,
} from "@/lib/offer/offer-compare-rail";
import { formatOfferMoney } from "@/lib/offer/budget-offer-compare";
import {
  isActionRequiredOffer,
  resolveOfferCardStatusHeader,
  type OfferCardInput,
} from "@/lib/offer/offer-card-status";
import type { OfferNegotiationDto } from "@/lib/offer/offer-negotiation";

function sellerInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "TE";
}

export function IncomingOfferWorkspaceListItem({
  offerId,
  firmName,
  amount,
  currency,
  deliveryDays,
  status,
  negotiations,
  createdAt,
  updatedAt,
  photoCount,
  isSelected,
  isUnread: isUnreadProp,
  onSelect,
}: {
  offerId: string;
  firmName: string;
  amount: number;
  currency: string;
  deliveryDays: number | null;
  status: string;
  negotiations: OfferNegotiationDto[];
  createdAt: string;
  updatedAt?: string;
  photoCount: number;
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
  const displayAmount = resolveOfferDecisionAmount({
    status,
    amount,
    currency,
    negotiations,
  });
  const rounds = countNegotiationRounds(negotiations);
  const lastActivity = formatOfferRelativeTime(
    resolveOfferLastActivityAt({
      createdAt,
      updatedAt,
      negotiations,
    }),
  );

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={isSelected ? "true" : undefined}
      className={`flex min-h-11 w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition ${
        isSelected
          ? "border-teal-700/30 bg-[#eef8f5] ring-2 ring-teal-700/15"
          : "border-teal-900/8 bg-white hover:border-teal-700/20 hover:bg-[#f8fcfb]"
      }`}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0f766e] text-[11px] font-semibold text-white"
        aria-hidden
      >
        {sellerInitials(firmName)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-[#0f1f1d]">
            {firmName}
          </span>
          {isUnread ? (
            <span className="rounded-full bg-[#0f766e] px-1.5 py-0.5 text-[10px] font-semibold text-white">
              Yeni
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block text-base font-semibold tabular-nums text-[#0f1f1d]">
          {displayAmount != null ? formatOfferMoney(displayAmount, currency) : "—"}
        </span>
        <span
          className={`mt-1 block text-xs font-medium ${
            actionRequired ? "text-amber-900/85" : "text-black/45"
          }`}
        >
          {statusLabel}
        </span>
        <span className="mt-1 block text-[11px] text-black/40">
          {deliveryDays != null ? `${deliveryDays} gün teslim · ` : ""}
          {rounds > 0 ? `${rounds} pazarlık turu · ` : ""}
          {photoCount > 0 ? (
            <span className="inline-flex items-center gap-0.5">
              <Camera className="inline h-3 w-3" aria-hidden />
              {photoCount} fotoğraf ·{" "}
            </span>
          ) : null}
          {lastActivity}
        </span>
      </span>
      <ChevronRight
        className={`mt-2 h-4 w-4 shrink-0 ${isSelected ? "text-teal-800" : "text-black/25"}`}
        aria-hidden
      />
    </button>
  );
}
