"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Soft-refresh newest feed so freshly published requests appear without reload. */
export function ExploreAutoRefresh({ enabled }: { enabled: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      router.refresh();
    }, 20_000);
    return () => window.clearInterval(id);
  }, [enabled, router]);

  return null;
}
