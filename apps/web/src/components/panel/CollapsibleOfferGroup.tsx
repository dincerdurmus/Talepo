"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import type { OfferInboxRole } from "@/lib/offer/offer-event-unread";
import {
  offerUnreadGeneration,
  shouldOfferGroupDefaultOpen,
} from "@/lib/offer/offer-card-status";
import type { OfferCardInput } from "@/lib/offer/offer-card-status";
import { OfferCardSeenMarker } from "@/components/panel/OfferCardSeenMarker";
import { OfferGroupLiveUnreadProvider } from "@/components/panel/OfferGroupLiveUnreadContext";

export function CollapsibleOfferGroup({
  offerId,
  viewer,
  offer,
  isUnread: isUnreadProp,
  isActionRequired,
  isDeepLinked,
  header,
  children,
  onExpandedChange,
  cardClassName = "talepo-card",
}: {
  offerId: string;
  viewer: OfferInboxRole;
  offer: OfferCardInput;
  isUnread: boolean;
  isActionRequired: boolean;
  isDeepLinked: boolean;
  header: ReactNode;
  children: ReactNode;
  onExpandedChange?: (open: boolean) => void;
  cardClassName?: string;
}) {
  const panelId = useId();

  // Server truth stays authoritative. A successful seen call only suppresses the
  // unread state of the generation it acknowledged, so a later offer event makes
  // the same offer unread again without any effect-driven resync.
  const unreadGeneration = offerUnreadGeneration(offer);
  const [seenGeneration, setSeenGeneration] = useState<string | null>(null);
  const isUnread = isUnreadProp && seenGeneration !== unreadGeneration;

  // Frozen at mount, like the previous initial state: unread and action-required
  // cards open by default, counterpart-waiting cards stay compact, and a card the
  // user is reading is never collapsed by later prop changes.
  const [defaultOpen] = useState(() =>
    shouldOfferGroupDefaultOpen({
      viewer,
      offer,
      isUnread: isUnreadProp,
      isDeepLinked,
      isActionRequired,
    }),
  );
  // Manual toggles win, but they are scoped to the current deep-link phase, so a
  // deep link arriving later still opens a card the user had collapsed.
  const deepLinkPhase = isDeepLinked ? "deep" : "base";
  const [manualOpen, setManualOpen] = useState<{
    phase: string;
    open: boolean;
  } | null>(null);
  const open =
    manualOpen?.phase === deepLinkPhase
      ? manualOpen.open
      : isDeepLinked || defaultOpen;

  useEffect(() => {
    if (!isDeepLinked) return;
    const node = document.getElementById(`teklif-${offerId}`);
    node?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [isDeepLinked, offerId]);

  useEffect(() => {
    onExpandedChange?.(open);
  }, [onExpandedChange, open]);

  const toggle = () =>
    setManualOpen({ phase: deepLinkPhase, open: !open });

  return (
    <section
      className={`overflow-hidden ${
        isUnread
          ? "talepo-offer-unread-glow rounded-[24px] ring-2 ring-teal-700/25 ring-offset-2 ring-offset-[#edf3f1]"
          : ""
      }`}
      data-offer-group={offerId}
      data-offer-unread={isUnread ? "true" : "false"}
      data-offer-action-required={isActionRequired ? "true" : "false"}
    >
      <div className={`${cardClassName} overflow-hidden`}>
        <button
          type="button"
          id={`offer-toggle-${offerId}`}
          onClick={toggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="relative flex min-h-11 w-full items-start justify-between gap-3 border-b border-teal-900/[0.06] px-4 py-3.5 text-left sm:px-5"
        >
          <span
            aria-hidden
            className={`pointer-events-none absolute inset-x-4 top-0 h-1 origin-top rounded-b-md bg-gradient-to-b from-amber-200/70 to-transparent transition duration-200 motion-reduce:transition-none ${
              open ? "scale-y-100 opacity-100" : "scale-y-0 opacity-0"
            }`}
          />
          <div className="min-w-0 flex-1">
            <OfferGroupLiveUnreadProvider isUnread={isUnread}>
              {header}
            </OfferGroupLiveUnreadProvider>
          </div>
          <ChevronDown
            className={`mt-1 h-5 w-5 shrink-0 text-black/40 transition duration-200 motion-reduce:transition-none ${
              open ? "rotate-180" : ""
            }`}
            aria-hidden
          />
        </button>
        <div
          id={panelId}
          role="region"
          aria-labelledby={`offer-toggle-${offerId}`}
          className={`grid transition-[grid-template-rows,opacity] duration-[220ms] ease-out motion-reduce:transition-none motion-reduce:duration-0 ${
            open
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            <div
              className={`transition-[transform,opacity] duration-[220ms] ease-out motion-reduce:transition-none motion-reduce:duration-0 motion-reduce:transform-none ${
                open ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
              }`}
            >
              <OfferGroupLiveUnreadProvider isUnread={isUnread}>
                {children}
              </OfferGroupLiveUnreadProvider>
            </div>
          </div>
        </div>
      </div>
      {open ? (
        <OfferCardSeenMarker
          offerId={offerId}
          role={viewer}
          active={isDeepLinked}
          enabled={isUnread}
          onSeen={() => setSeenGeneration(unreadGeneration)}
        />
      ) : null}
    </section>
  );
}
