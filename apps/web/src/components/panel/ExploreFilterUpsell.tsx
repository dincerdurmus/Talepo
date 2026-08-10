import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";

export function ExploreFilterUpsell({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`mt-3 flex flex-col gap-3 rounded-xl border border-sky-200/70 bg-gradient-to-br from-[#eef8ff] to-[#e0f0ff] p-3 sm:flex-row sm:items-center sm:justify-between ${compact ? "mt-2" : ""}`}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 text-white">
          <Zap className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#1e3a8a]">
            {compact
              ? "Bütçe, acil talep ve tarih filtreleri Profesyonel planda"
              : "Gelişmiş filtreler Profesyonel planda"}
          </p>
          <p className="mt-0.5 text-xs leading-5 text-[#1e40af]/70">
            {compact
              ? "Kategori alanlarıyla filtreleyebilirsiniz; bütçe aralığı, acil talep ve yayın tarihi için planınızı yükseltin."
              : "Bütçe aralığı, acil talep ve tarih filtreleri için planınızı yükseltin."}
          </p>
        </div>
      </div>
      <Link
        href="/panel/plan"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-sky-600 to-blue-700 px-4 py-2 text-xs font-semibold text-white"
      >
        Profesyonel&apos;e geç
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
