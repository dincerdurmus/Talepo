"use client";

import { Camera, MapPin } from "lucide-react";

import { IncomingRequestCover } from "@/components/panel/IncomingRequestCover";
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
  type OfferCardViewer,
} from "@/lib/offer/offer-card-status";
import type { OfferNegotiationDto } from "@/lib/offer/offer-negotiation";

export function OfferCollapsedSummary({
  viewer,
  offer,
  title,
  roleLabel,
  city,
  isUnread: isUnreadProp,
  thumbnail,
  photoCount = 0,
}: {
  viewer: OfferCardViewer;
  offer: OfferCardInput & {
    amount: number;
    currency: string;
    createdAt?: string | Date | null;
    updatedAt?: string | Date | null;
  };
  title: string;
  roleLabel: string;
  city?: string | null;
  isUnread: boolean;
  thumbnail?: {
    coverImageUrl?: string | null;
    categorySlug?: string | null;
    categoryName?: string | null;
    requestTitle?: string;
    initials?: string;
  };
  photoCount?: number;
}) {
  const isUnread = useOfferGroupLiveUnread(isUnreadProp);
  const cardInput: OfferCardInput = {
    status: offer.status,
    negotiations: offer.negotiations,
  };
  const actionRequired = isActionRequiredOffer(viewer, cardInput);
  const status = resolveOfferCardStatusHeader(viewer, cardInput, { isUnread });
  const amount = resolveOfferDecisionAmount({
    status: offer.status,
    amount: offer.amount,
    currency: offer.currency,
    negotiations: offer.negotiations as OfferNegotiationDto[],
  });
  const rounds = countNegotiationRounds(offer.negotiations as OfferNegotiationDto[]);
  const lastActivity = formatOfferRelativeTime(
    resolveOfferLastActivityAt({
      createdAt: offer.createdAt,
      updatedAt: offer.updatedAt,
      negotiations: offer.negotiations as OfferNegotiationDto[],
    }),
  );

  return (
    <div className="grid min-w-0 gap-2 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-3">
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-teal-900/5 ring-1 ring-black/[0.04]">
        {thumbnail?.coverImageUrl != null ||
        thumbnail?.categorySlug != null ||
        thumbnail?.categoryName != null ? (
          <IncomingRequestCover
            coverImageUrl={thumbnail.coverImageUrl ?? null}
            categorySlug={thumbnail.categorySlug ?? null}
            categoryName={thumbnail.categoryName ?? null}
            requestTitle={thumbnail.requestTitle ?? title}
            compact
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-[#0f766e] text-[11px] font-semibold text-white">
            {thumbnail?.initials ?? "TE"}
          </span>
        )}
      </div>
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-900/45">
            {roleLabel}
          </p>
          {isUnread ? (
            <span className="rounded-full bg-[#0f766e] px-1.5 py-0.5 text-[10px] font-semibold text-white">
              Yeni
            </span>
          ) : null}
          {actionRequired ? (
            <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 ring-1 ring-amber-200/70">
              Yanıtınız bekleniyor
            </span>
          ) : null}
        </div>
        <p className="truncate text-sm font-semibold tracking-tight text-[#0f1f1d]">
          {title}
        </p>
        <p className="text-xs font-medium text-black/55">{status}</p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-black/45">
          <span className="font-semibold tabular-nums text-[#0f1f1d]">
            {formatOfferMoney(amount, offer.currency)}
          </span>
          {city ? (
            <span className="inline-flex items-center gap-0.5">
              <MapPin className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
              {city}
            </span>
          ) : null}
          {lastActivity ? <span>{lastActivity}</span> : null}
          {rounds > 0 ? (
            <span>
              {rounds} tur
            </span>
          ) : null}
          {photoCount > 0 ? (
            <span className="inline-flex items-center gap-0.5">
              <Camera className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
              {photoCount}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
