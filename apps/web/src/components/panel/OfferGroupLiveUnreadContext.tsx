"use client";

import { createContext, useContext } from "react";

const OfferGroupLiveUnreadContext = createContext<boolean | null>(null);

export function OfferGroupLiveUnreadProvider({
  isUnread,
  children,
}: {
  isUnread: boolean;
  children: React.ReactNode;
}) {
  return (
    <OfferGroupLiveUnreadContext.Provider value={isUnread}>
      {children}
    </OfferGroupLiveUnreadContext.Provider>
  );
}

export function useOfferGroupLiveUnread(fallback: boolean) {
  const live = useContext(OfferGroupLiveUnreadContext);
  return live ?? fallback;
}
