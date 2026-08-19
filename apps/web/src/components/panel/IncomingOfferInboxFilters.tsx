"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import {
  INCOMING_OFFER_INBOX_EMPTY,
  INCOMING_OFFER_INBOX_FILTERS,
  INCOMING_OFFER_INBOX_LABELS,
  buildIncomingOffersInboxPath,
  type IncomingOfferInboxFilter,
} from "@/lib/offer/incoming-offer-inbox";

export function IncomingOfferInboxFilters({
  active,
  counts,
  archiveView = false,
  archiveCount = 0,
}: {
  active: IncomingOfferInboxFilter;
  counts: Record<IncomingOfferInboxFilter, number>;
  archiveView?: boolean;
  archiveCount?: number;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scrollerRef.current?.querySelector<HTMLElement>(
      '[aria-selected="true"]',
    );
    node?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    });
  }, [active, archiveView]);

  return (
    <div className="relative -mx-1 mb-5 min-w-0">
      <div
        ref={scrollerRef}
        className="flex gap-2 overflow-x-auto overscroll-x-contain px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Gelen teklif durumu filtreleri"
      >
        {INCOMING_OFFER_INBOX_FILTERS.map((filter) => {
          const selected = !archiveView && filter === active;
          return (
            <Link
              key={filter}
              href={buildIncomingOffersInboxPath({ filter, archiveView: false })}
              role="tab"
              aria-selected={selected}
              data-inbox-filter={filter}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold tabular-nums transition ${
                selected
                  ? "bg-teal-800 text-white shadow-[0_8px_18px_rgba(15,118,110,0.18)]"
                  : "border border-teal-900/10 bg-white text-teal-950/70 hover:bg-[#f4faf9]"
              }`}
            >
              <span>{INCOMING_OFFER_INBOX_LABELS[filter]}</span>
              <span className={selected ? "text-white/80" : "text-teal-950/40"}>
                {counts[filter]}
              </span>
            </Link>
          );
        })}
        <Link
          href={buildIncomingOffersInboxPath({
            filter: active,
            archiveView: true,
          })}
          role="tab"
          aria-selected={archiveView}
          data-inbox-filter="archive"
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold tabular-nums transition ${
            archiveView
              ? "bg-teal-800 text-white shadow-[0_8px_18px_rgba(15,118,110,0.18)]"
              : "border border-teal-900/10 bg-white text-teal-950/70 hover:bg-[#f4faf9]"
          }`}
        >
          <span>Arşiv</span>
          <span className={archiveView ? "text-white/80" : "text-teal-950/40"}>
            {archiveCount}
          </span>
        </Link>
      </div>
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#eef6f4] via-[#eef6f4]/80 to-transparent"
        aria-hidden
      />
    </div>
  );
}

export function IncomingOfferInboxEmpty({
  filter,
  archiveView = false,
}: {
  filter: IncomingOfferInboxFilter;
  archiveView?: boolean;
}) {
  return (
    <div className="talepo-card px-5 py-8 text-center sm:text-left">
      <p className="text-sm leading-6 text-black/50">
        {archiveView
          ? "Arşivde teklif yok."
          : INCOMING_OFFER_INBOX_EMPTY[filter]}
      </p>
    </div>
  );
}
