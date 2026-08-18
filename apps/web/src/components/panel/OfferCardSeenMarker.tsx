"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import type { OfferInboxRole } from "@/lib/offer/offer-event-unread";
import { dispatchOfferInboxBadgeUpdate } from "@/lib/offer/offer-inbox-badge-events";

export function OfferCardSeenMarker({
  offerId,
  role,
  active,
  enabled = true,
  onSeen,
}: {
  offerId: string;
  role: OfferInboxRole;
  active?: boolean;
  enabled?: boolean;
  onSeen?: (offerId: string) => void;
}) {
  const router = useRouter();
  const markedRef = useRef(false);
  const nodeRef = useRef<HTMLSpanElement | null>(null);

  const markSeen = useCallback(async () => {
    if (!enabled || markedRef.current) return;
    markedRef.current = true;
    try {
      const response = await fetch(`/api/offers/${offerId}/seen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (response.ok) {
        dispatchOfferInboxBadgeUpdate({ role, mode: "decrement", offerId });
        onSeen?.(offerId);
        router.refresh();
      } else {
        markedRef.current = false;
      }
    } catch {
      markedRef.current = false;
    }
  }, [enabled, offerId, onSeen, role, router]);

  useEffect(() => {
    if (!enabled) return;
    if (active) {
      void markSeen();
    }
  }, [active, enabled, markSeen]);

  useEffect(() => {
    if (!enabled || active) return;
    const node = nodeRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void markSeen();
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [active, enabled, markSeen]);

  return (
    // Not `sr-only`: that utility applies `clip-path: inset(50%)`, and a
    // clip-path'ed target never reports an intersection, so the card would never
    // be marked as seen. This stays invisible without clipping.
    <span
      ref={nodeRef}
      className="pointer-events-none absolute h-px w-px opacity-0"
      aria-hidden
      data-offer-seen-marker={offerId}
    />
  );
}
