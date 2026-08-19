"use client";

import Link from "next/link";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { useEffect, useId, useState } from "react";

import {
  SAYFAM_ACTIVITY_DEFAULT_OPEN,
  getLatestSayfamActivity,
  shouldShowSayfamActivityDisclosure,
  shouldShowSayfamUnreadBadge,
} from "@/lib/panel/sayfam-focus";
import type { SayfamActivityItem } from "@/lib/panel/sayfam-home-types";

function ActivityRow({ item }: { item: SayfamActivityItem }) {
  return (
    <Link
      href={item.href}
      prefetch={false}
      className={`talepo-beacon-rail-row block rounded-xl px-3 py-2.5 transition ${
        item.unread ? "talepo-beacon-rail-row--unread" : ""
      }`}
      aria-label={
        item.unread
          ? `${item.title}, okunmadı, ${item.timeLabel}`
          : `${item.title}, ${item.timeLabel}`
      }
    >
      <p className="flex items-start gap-2">
        {item.unread ? (
          <span className="talepo-beacon-unread-dot mt-1.5" aria-hidden />
        ) : null}
        <span
          className={`min-w-0 flex-1 text-[13px] ${
            item.unread
              ? "font-semibold text-[#0f1f1d]"
              : "font-medium text-[#0f1f1d]/62"
          }`}
        >
          {item.title}
          {item.unread ? (
            <>
              <span className="talepo-beacon-unread-chip">Yeni</span>
              <span className="sr-only">Okunmadı</span>
            </>
          ) : null}
        </span>
      </p>
      <p
        className={`mt-0.5 line-clamp-2 text-[11px] ${
          item.unread ? "pl-3.5 text-[#0f1f1d]/48" : "text-[#0f1f1d]/36"
        }`}
      >
        {item.message}
      </p>
      <p
        className={`mt-1 text-[10px] ${
          item.unread ? "pl-3.5 text-[#0f1f1d]/40" : "text-[#0f1f1d]/32"
        }`}
      >
        {item.timeLabel}
      </p>
    </Link>
  );
}

export function PanelSayfamActivityFeed({
  items,
  unreadCount,
}: {
  items: SayfamActivityItem[];
  unreadCount: number;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(SAYFAM_ACTIVITY_DEFAULT_OPEN);
  const latest = getLatestSayfamActivity(items);
  const canDisclose = shouldShowSayfamActivityDisclosure(items.length);
  const showUnreadBadge = shouldShowSayfamUnreadBadge(unreadCount);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <aside className="talepo-beacon-rail flex flex-col lg:sticky lg:top-6">
      <div className="talepo-beacon-rail-feed talepo-beacon-rail-feed--solo rounded-[1.25rem] px-4 py-3.5 sm:px-5">
        {canDisclose ? (
          <button
            type="button"
            className="talepo-beacon-activity-toggle"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((current) => !current)}
          >
            <span className="min-w-0 text-left">
              <span className="flex items-center gap-2">
                <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#0f766e]/75">
                  Son gelişmeler
                </span>
                {showUnreadBadge ? (
                  <span className="talepo-beacon-activity-count">
                    {unreadCount}
                    <span className="sr-only"> okunmamış</span>
                  </span>
                ) : null}
              </span>
            </span>
            <span className="inline-flex items-center text-[#0f1f1d]/42">
              <span className="sr-only">{open ? "Kapat" : "Aç"}</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${
                  open ? "rotate-180" : ""
                }`}
                strokeWidth={2}
                aria-hidden
              />
            </span>
          </button>
        ) : (
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#0f766e]/75">
            Son gelişmeler
          </p>
        )}

        {!canDisclose ? (
          <p className="mt-2 text-[13px] leading-relaxed text-[#0f1f1d]/42">
            Teklif, mesaj ve bildirim hareketleri. Son gelişmeler burada.
          </p>
        ) : !open && latest ? (
          <p className="talepo-beacon-activity-preview mt-2 line-clamp-1">
            <span className="font-medium text-[#0f1f1d]/72">{latest.title}</span>
            <span className="text-[#0f1f1d]/36"> · {latest.message}</span>
            <span className="text-[#0f1f1d]/32"> · {latest.timeLabel}</span>
          </p>
        ) : null}

        {canDisclose ? (
          <div
            id={panelId}
            className={`talepo-beacon-activity-panel ${
              open ? "talepo-beacon-activity-panel--open" : ""
            }`}
            aria-hidden={!open}
            {...(!open ? { inert: true } : {})}
          >
            <div className="talepo-beacon-activity-panel-inner">
              <p className="pt-2 text-[11px] text-[#0f1f1d]/38">
                {items.length} gelişme
              </p>
              <ul className="talepo-beacon-activity-scroll space-y-2.5 pt-2">
                {items.map((item) => (
                  <li key={item.id}>
                    <ActivityRow item={item} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        <Link
          href="/panel/bildirimler"
          className="mt-3 inline-flex min-h-11 items-center gap-1 text-[12px] font-semibold text-[#0f766e] transition hover:gap-2"
        >
          Tüm bildirimler
          <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      </div>
    </aside>
  );
}
