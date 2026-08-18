import Link from "next/link";

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
    <div
      className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="tablist"
      aria-label="Teklif durumu filtreleri"
    >
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
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold tabular-nums transition ${
              selected
                ? "bg-teal-800 text-white shadow-[0_8px_18px_rgba(15,118,110,0.18)]"
                : "border border-teal-900/10 bg-white text-teal-950/70 hover:bg-[#f4faf9]"
            }`}
          >
            <span>{OUTGOING_OFFER_INBOX_LABELS[filter]}</span>
            <span className={selected ? "text-white/80" : "text-teal-950/40"}>
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
    <div className="talepo-card px-5 py-8 text-center sm:text-left">
      <p className="text-sm leading-6 text-black/50">
        {archiveView
          ? "Arşivde teklif yok."
          : OUTGOING_OFFER_INBOX_EMPTY[filter]}
      </p>
    </div>
  );
}
