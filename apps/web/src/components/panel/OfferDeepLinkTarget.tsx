"use client";

import { useEffect, type ReactNode } from "react";

export function OfferDeepLinkTarget({
  offerId,
  active,
  children,
}: {
  offerId: string;
  active: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!active) return;
    const node = document.getElementById(`teklif-${offerId}`);
    node?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [active, offerId]);

  return (
    <div
      id={`teklif-${offerId}`}
      className={active ? "rounded-[24px] ring-2 ring-amber-300/90" : undefined}
    >
      {children}
    </div>
  );
}
