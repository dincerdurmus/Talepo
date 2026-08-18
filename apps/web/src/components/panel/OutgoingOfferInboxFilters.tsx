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
}: {
  active: OutgoingOfferInboxFilter;
  counts: Record<OutgoingOfferInboxFilter, number>;
  teklif?: string | null;
  tur?: string | null;
}) {
  return (
    <div
      className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="tablist"
      aria-label="Teklif durumu filtreleri"
    >
      {OUTGOING_OFFER_INBOX_FILTERS.map((filter) => {
        const selected = filter === active;
        const href = buildOutgoingOffersPath({ filter, teklif, tur });
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
    </div>
  );
}

export function OutgoingOfferInboxEmpty({
  filter,
}: {
  filter: OutgoingOfferInboxFilter;
}) {
  return (
    <div className="talepo-card px-5 py-8 text-center sm:text-left">
      <p className="text-sm leading-6 text-black/50">
        {OUTGOING_OFFER_INBOX_EMPTY[filter]}
      </p>
    </div>
  );
}
