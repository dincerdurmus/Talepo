export function offerInboxFilterChipClass(selected: boolean) {
  return `inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f1f1d]/30 ${
    selected
      ? "border-transparent bg-[#0f1f1d] text-white"
      : "border-[#0f1f1d]/10 bg-white text-[#0f1f1d]/70 hover:bg-[#f4f7f6]"
  }`;
}

export const OFFER_INBOX_FILTER_RAIL_CLASS =
  "talepo-offer-inbox-filter-rail relative min-w-0 max-w-full";

export const OFFER_INBOX_FILTER_SCROLLER_CLASS =
  "flex flex-nowrap gap-2 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible sm:pb-0";
