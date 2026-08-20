import Link from "next/link";

import { OfferInboxFilterRail } from "@/components/panel/offer-inbox/OfferInboxFilterRail";
import { offerInboxFilterChipClass } from "@/components/panel/offer-inbox/offerInboxFilterStyles";
import {
  OUTGOING_OFFER_INBOX_EMPTY,
  OUTGOING_OFFER_INBOX_FILTERS,
  OUTGOING_OFFER_INBOX_LABELS,
  buildOutgoingOffersPath,
  type OutgoingOfferInboxFilter,
} from "@/lib/offer/outgoing-offer-inbox";

export function OutgoingOfferInboxFilters({
  active,
  counts,
  teklif,
  tur,
  archiveView = false,
  archiveCount = 0,
}: {
  active: OutgoingOfferInboxFilter;
  counts: Record<OutgoingOfferInboxFilter, number>;
  teklif?: string | null;
  tur?: string | null;
  archiveView?: boolean;
  archiveCount?: number;
}) {
  return (
    <OfferInboxFilterRail ariaLabel="Teklif durumu filtreleri">
      {OUTGOING_OFFER_INBOX_FILTERS.map((filter) => {
        const selected = !archiveView && filter === active;
        const href = buildOutgoingOffersPath({
          filter,
          teklif,
          tur,
          archiveView: false,
        });
        return (
          <Link
            key={filter}
            href={href}
            role="tab"
            aria-selected={selected}
            data-inbox-filter={filter}
            className={offerInboxFilterChipClass(selected)}
          >
            <span>{OUTGOING_OFFER_INBOX_LABELS[filter]}</span>
            <span className={selected ? "text-white/75" : "text-[#0f1f1d]/40"}>
              {counts[filter]}
            </span>
          </Link>
        );
      })}
      <Link
        href={buildOutgoingOffersPath({
          filter: active,
          teklif,
          tur,
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

export function OutgoingOfferInboxEmpty({
  filter,
  archiveView = false,
}: {
  filter: OutgoingOfferInboxFilter;
  archiveView?: boolean;
}) {
  return (
    <div className="rounded-[1.35rem] border border-[#0f1f1d]/8 bg-white px-6 py-10 text-center sm:px-8 sm:text-left">
      <p className="text-sm leading-6 text-[#0f1f1d]/55">
        {archiveView
          ? "Arşivde teklif yok."
          : OUTGOING_OFFER_INBOX_EMPTY[filter]}
      </p>
    </div>
  );
}
