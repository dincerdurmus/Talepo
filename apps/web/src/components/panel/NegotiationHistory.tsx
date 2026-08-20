"use client";

import { useState } from "react";
import { ArrowLeftRight, ChevronDown, FileText } from "lucide-react";

import { NegotiationTimeline } from "@/components/panel/NegotiationTimeline";
import {
  buildNegotiationHistory,
  historyShouldAutoOpen,
  negotiationRoundCount,
  type NegotiationHistoryViewer,
} from "@/lib/offer/negotiation-history";
import type { OfferCompleteness } from "@/lib/offer/offer-completeness";
import type { OfferNegotiationDto } from "@/lib/offer/offer-negotiation";

function DisclosureRow({
  open,
  onToggle,
  icon,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-teal-900/8 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex min-h-11 w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-[#f8fbfa]"
        aria-expanded={open}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#f3f7f6] text-teal-900/70">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-[#0f1f1d]">
            {title}
          </span>
          {subtitle ? (
            <span className="mt-0.5 block text-[11px] text-black/40">
              {subtitle}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-black/35 transition ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="border-t border-teal-900/8 px-3.5 py-3">{children}</div>
      ) : null}
    </div>
  );
}

export function NegotiationHistory({
  viewer,
  originalAmount,
  currency,
  offerStatus,
  offerCreatedAt,
  negotiations,
  highlightNegotiationId,
  deliveryDays,
  completeness,
}: {
  viewer: NegotiationHistoryViewer;
  originalAmount: number;
  currency: string;
  offerStatus: string;
  offerCreatedAt?: string | null;
  negotiations: OfferNegotiationDto[];
  highlightNegotiationId?: string | null;
  deliveryDays?: number | null;
  completeness?: OfferCompleteness;
}) {
  const rounds = negotiationRoundCount(negotiations);
  const events = buildNegotiationHistory({
    viewer,
    originalAmount,
    currency,
    offerStatus,
    offerCreatedAt,
    negotiations,
  });
  const shouldShow =
    rounds > 0 ||
    offerStatus === "ACCEPTED" ||
    offerStatus === "REJECTED" ||
    Boolean(completeness) ||
    deliveryDays != null;
  const autoOpen = historyShouldAutoOpen(
    negotiations,
    highlightNegotiationId,
  );
  const [open, setOpen] = useState(autoOpen);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [autoOpenSeen, setAutoOpenSeen] = useState(autoOpen);

  if (autoOpen && !autoOpenSeen) {
    setAutoOpenSeen(true);
    if (!open) setOpen(true);
  }
  if (!autoOpen && autoOpenSeen) {
    setAutoOpenSeen(false);
  }

  if (!shouldShow) return null;

  const hasDetails = Boolean(completeness) || deliveryDays != null;
  const historyMoves = events.length;

  return (
    <div className="mt-3 space-y-2.5">
      {rounds > 0 ||
      offerStatus === "ACCEPTED" ||
      offerStatus === "REJECTED" ? (
        <DisclosureRow
          open={open}
          onToggle={() => setOpen((value) => !value)}
          icon={<ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />}
          title="Fiyat ve pazarlık geçmişi"
          subtitle={`${historyMoves} hareket · ${rounds} tur`}
        >
          <NegotiationTimeline events={events} />
          {highlightNegotiationId
            ? events
                .filter(
                  (event) => event.negotiationId === highlightNegotiationId,
                )
                .map((event) => (
                  <span
                    key={`hl-${event.id}`}
                    data-history-event={event.id}
                    data-negotiation-id={event.negotiationId ?? undefined}
                    className="sr-only"
                  />
                ))
            : null}
        </DisclosureRow>
      ) : null}

      {hasDetails ? (
        <DisclosureRow
          open={detailsOpen}
          onToggle={() => setDetailsOpen((value) => !value)}
          icon={<FileText className="h-3.5 w-3.5" aria-hidden />}
          title="Teklif ayrıntıları"
          subtitle="Teslim, notlar ve diğer bilgiler"
        >
          <div className="space-y-2 text-sm text-black/55">
            {deliveryDays != null ? (
              <p>Teslimat · {deliveryDays} gün</p>
            ) : (
              <p>Teslimat süresi belirtilmedi</p>
            )}
            {completeness ? (
              <p className="text-[12px] leading-5 text-teal-900/60">
                Teklif kapsamı {completeness.filled}/{completeness.total}
                {completeness.missing.length > 0
                  ? ` · ${completeness.missing.join(" · ")} henüz eklenmemiş`
                  : ""}
              </p>
            ) : null}
          </div>
        </DisclosureRow>
      ) : null}
    </div>
  );
}
