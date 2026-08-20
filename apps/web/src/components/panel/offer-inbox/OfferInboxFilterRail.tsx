"use client";

import type { ReactNode, Ref } from "react";

import {
  OFFER_INBOX_FILTER_RAIL_CLASS,
  OFFER_INBOX_FILTER_SCROLLER_CLASS,
} from "@/components/panel/offer-inbox/offerInboxFilterStyles";

export function OfferInboxFilterRail({
  ariaLabel,
  scrollerRef,
  children,
}: {
  ariaLabel: string;
  scrollerRef?: Ref<HTMLDivElement>;
  children: ReactNode;
}) {
  return (
    <div className={OFFER_INBOX_FILTER_RAIL_CLASS}>
      <div
        ref={scrollerRef}
        role="tablist"
        aria-label={ariaLabel}
        className={OFFER_INBOX_FILTER_SCROLLER_CLASS}
      >
        {children}
      </div>
    </div>
  );
}
