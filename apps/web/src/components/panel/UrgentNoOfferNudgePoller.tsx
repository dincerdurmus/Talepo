"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { URGENT_NO_OFFER_NUDGE_MS } from "@/lib/request/urgent-nudge-constants";

/**
 * Lightweight client poll so testers see the bell nudge without a full reload
 * once the 1-minute window elapses while staying on Taleplerim.
 */
export function UrgentNoOfferNudgePoller({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const ranRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function tick() {
      if (cancelled || ranRef.current) return;
      try {
        const response = await fetch("/api/notifications/urgent-nudge", {
          method: "POST",
        });
        const data = (await response.json()) as {
          ok?: boolean;
          created?: number;
        };
        if (!cancelled && response.ok && data.ok && (data.created ?? 0) > 0) {
          ranRef.current = true;
          router.refresh();
        }
      } catch {
        // Best-effort; panel layout also runs the scan on navigation.
      }
    }

    void tick();
    const interval = window.setInterval(() => {
      void tick();
    }, Math.min(URGENT_NO_OFFER_NUDGE_MS, 30_000));

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [enabled, router]);

  return null;
}
