"use client";

import { useState } from "react";

const TABS = [
  { id: "bilgiler", label: "Profil bilgileri" },
  { id: "degerlendirmeler", label: "Değerlendirmeler" },
  { id: "guvenlik", label: "Güvenlik" },
  { id: "hesap", label: "Hesap özeti" },
] as const;

export type ProfileTabId = (typeof TABS)[number]["id"];

export function ProfilePageTabs({
  sections,
}: {
  sections: Record<ProfileTabId, React.ReactNode>;
}) {
  const [active, setActive] = useState<ProfileTabId>("bilgiler");

  return (
    <div className="min-w-0 space-y-4">
      <div
        className="-mx-1 flex gap-2 overflow-x-auto overscroll-x-contain px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Profil bölümleri"
      >
        {TABS.map((tab) => {
          const selected = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(tab.id)}
              className={`inline-flex shrink-0 min-h-11 items-center rounded-full px-4 py-2 text-sm font-semibold transition ${
                selected
                  ? "bg-teal-800 text-white shadow-[0_8px_18px_rgba(15,118,110,0.18)]"
                  : "border border-teal-900/10 bg-white text-teal-950/70 hover:bg-[#f4faf9]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {TABS.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          hidden={active !== tab.id}
          className="min-w-0"
        >
          {sections[tab.id]}
        </div>
      ))}
    </div>
  );
}
