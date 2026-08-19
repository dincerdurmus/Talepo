import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function ExploreFilterUpsell({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`mt-3 flex flex-col gap-3 rounded-[1.25rem] border border-[#0f1f1d]/8 bg-white/80 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between ${compact ? "mt-2" : ""}`}
    >
      <div>
        <p className="text-sm font-semibold text-[#0f1f1d]">
          {compact
            ? "Bütçe, acil talep ve tarih filtreleri Profesyonel planda"
            : "Gelişmiş filtreler Profesyonel planda"}
        </p>
        <p className="mt-0.5 text-xs leading-5 text-[#0f1f1d]/48">
          {compact
            ? "Kategori alanlarıyla filtreleyebilirsiniz; bütçe aralığı, acil talep ve yayın tarihi için planınızı yükseltin."
            : "Bütçe aralığı, acil talep ve tarih filtreleri için planınızı yükseltin."}
        </p>
      </div>
      <Link
        href="/panel/plan"
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-[#0f766e] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#115e59]"
      >
        Profesyonel&apos;e geç
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
