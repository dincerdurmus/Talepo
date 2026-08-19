import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import type { SayfamActivityItem } from "@/lib/panel/sayfam-home-types";

export function PanelSayfamActivityFeed({
  items,
}: {
  items: SayfamActivityItem[];
}) {
  return (
    <aside className="talepo-beacon-rail flex flex-col lg:sticky lg:top-6">
      <div className="talepo-beacon-rail-feed talepo-beacon-rail-feed--solo rounded-[1.25rem] px-4 py-4 sm:px-5 sm:py-5">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#0f766e]/75">
            Son gelişmeler
          </p>
          <p className="mt-1.5 text-[12px] leading-snug text-[#0f1f1d]/42">
            Bildirim ve mesaj hareketleri — odak kartından farklı bir zaman çizgisi.
          </p>
        </div>

        {items.length === 0 ? (
          <p className="mt-4 text-[13px] leading-relaxed text-[#0f1f1d]/42">
            Henüz bildirim yok. Talep ve teklif hareketleri burada listelenir.
          </p>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={`talepo-beacon-rail-row block rounded-xl px-3 py-2.5 transition ${
                    item.unread ? "border-[#0f766e]/12 bg-[#f0fdfa]/80" : ""
                  }`}
                >
                  <p className="text-[13px] font-medium text-[#0f1f1d]/76">{item.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-[#0f1f1d]/36">
                    {item.message}
                  </p>
                  <p className="mt-1 text-[10px] text-[#0f1f1d]/32">{item.timeLabel}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <Link
          href="/panel/bildirimler"
          className="mt-4 inline-flex min-h-11 items-center gap-1 text-[12px] font-semibold text-[#0f766e] transition hover:gap-2"
        >
          Tüm bildirimler
          <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      </div>
    </aside>
  );
}
