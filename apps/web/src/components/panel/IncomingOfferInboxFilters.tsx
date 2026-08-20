"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { OfferInboxFilterRail } from "@/components/panel/offer-inbox/OfferInboxFilterRail";
import { offerInboxFilterChipClass } from "@/components/panel/offer-inbox/offerInboxFilterStyles";
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
    const scroller = scrollerRef.current;
    const node = scroller?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!scroller || !node) return;
    const rail = scroller.getBoundingClientRect();
    const tab = node.getBoundingClientRect();
    if (tab.left >= rail.left && tab.right <= rail.right) return;
    node.scrollIntoView({
      inline: "nearest",
      block: "nearest",
    });
  }, [active, archiveView]);

  return (
    <OfferInboxFilterRail
      ariaLabel="Gelen teklif durumu filtreleri"
      scrollerRef={scrollerRef}
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
            className={offerInboxFilterChipClass(selected)}
          >
            <span>{INCOMING_OFFER_INBOX_LABELS[filter]}</span>
            <span className={selected ? "text-white/75" : "text-[#0f1f1d]/40"}>
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
        className={offerInboxFilterChipClass(archiveView)}
      >
        <span>Arşiv</span>
        <span className={archiveView ? "text-white/75" : "text-[#0f1f1d]/40"}>
          {archiveCount}
        </span>
      </Link>
    </OfferInboxFilterRail>
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
    <div className="rounded-[1.35rem] border border-[#0f1f1d]/8 bg-white px-6 py-10 text-center sm:px-8 sm:text-left">
      <p className="text-sm leading-6 text-[#0f1f1d]/55">
        {archiveView
          ? "Arşivde teklif yok."
          : INCOMING_OFFER_INBOX_EMPTY[filter]}
      </p>
    </div>
  );
}
