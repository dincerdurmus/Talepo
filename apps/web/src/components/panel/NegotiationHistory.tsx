"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

import {
  buildNegotiationHistory,
  historyShouldAutoOpen,
  negotiationRoundCount,
  type NegotiationHistoryViewer,
} from "@/lib/offer/negotiation-history";
import type { OfferCompleteness } from "@/lib/offer/offer-completeness";
import type { OfferNegotiationDto } from "@/lib/offer/offer-negotiation";

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
  const [open, setOpen] = useState(() =>
    historyShouldAutoOpen(negotiations, highlightNegotiationId),
  );
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    if (historyShouldAutoOpen(negotiations, highlightNegotiationId)) {
      setOpen(true);
    }
  }, [highlightNegotiationId, negotiations]);

  if (!shouldShow) return null;

  const hasDetails = Boolean(completeness) || deliveryDays != null;

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-xl border border-teal-900/8 bg-white">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-11 w-full items-center justify-between gap-3 px-3.5 text-left"
          aria-expanded={open}
        >
          <span className="text-sm font-semibold text-[#0f1f1d]">
            Fiyat ve pazarlık geçmişi ({rounds} tur)
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-black/40 transition ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
        {open ? (
          <ol className="space-y-2 border-t border-teal-900/8 px-3.5 py-3">
            {events.map((event) => (
              <li
                key={event.id}
                data-history-event={event.id}
                data-negotiation-id={event.negotiationId ?? undefined}
                className={`min-w-0 ${
                  highlightNegotiationId &&
                  event.negotiationId === highlightNegotiationId
                    ? "rounded-lg bg-amber-50/80 px-2 py-1.5"
                    : ""
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p
                    className={`text-sm font-medium ${
                      event.tone === "amber"
                        ? "text-amber-950"
                        : event.tone === "teal"
                          ? "text-teal-900"
                          : event.tone === "rose"
                            ? "text-rose-800"
                            : "text-[#0f1f1d]"
                    }`}
                  >
                    {event.title}
                  </p>
                  {event.amountLabel ? (
                    <p className="shrink-0 text-sm font-semibold tabular-nums text-[#0f1f1d]">
                      {event.amountLabel}
                    </p>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[11px] text-black/40">
                  {[event.detail, event.at].filter(Boolean).join(" · ")}
                </p>
              </li>
            ))}
          </ol>
        ) : null}
      </div>

      {hasDetails ? (
        <div className="rounded-xl border border-teal-900/8 bg-white/70">
          <button
            type="button"
            onClick={() => setDetailsOpen((value) => !value)}
            className="flex min-h-10 w-full items-center justify-between gap-3 px-3.5 text-left"
            aria-expanded={detailsOpen}
          >
            <span className="text-sm font-medium text-teal-950/70">
              Teklif ayrıntıları
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-black/35 transition ${
                detailsOpen ? "rotate-180" : ""
              }`}
            />
          </button>
          {detailsOpen ? (
            <div className="space-y-2 border-t border-teal-900/8 px-3.5 py-3 text-sm text-black/55">
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
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
