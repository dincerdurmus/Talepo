import Link from "next/link";

import {
  INCOMING_OFFER_INBOX_EMPTY,
  INCOMING_OFFER_INBOX_FILTERS,
  INCOMING_OFFER_INBOX_LABELS,
  buildIncomingOffersPath,
  type IncomingOfferInboxFilter,
} from "@/lib/offer/incoming-offer-inbox";

export function IncomingOfferInboxFilters({
  active,
  counts,
  teklif,
  tur,
}: {
  active: IncomingOfferInboxFilter;
  counts: Record<IncomingOfferInboxFilter, number>;
  teklif?: string | null;
  tur?: string | null;
}) {
  return (
    <div
      className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="tablist"
      aria-label="Gelen teklif durumu filtreleri"
    >
      {INCOMING_OFFER_INBOX_FILTERS.map((filter) => {
        const selected = filter === active;
        return (
          <Link
            key={filter}
            href={buildIncomingOffersPath({ filter, teklif, tur })}
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
    </div>
  );
}

export function IncomingOfferInboxEmpty({
  filter,
}: {
  filter: IncomingOfferInboxFilter;
}) {
  return (
    <div className="talepo-card px-5 py-8 text-center sm:text-left">
      <p className="text-sm leading-6 text-black/50">
        {INCOMING_OFFER_INBOX_EMPTY[filter]}
      </p>
    </div>
  );
}
