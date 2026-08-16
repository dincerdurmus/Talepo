"use client";

import { AlertTriangle, Check, RefreshCw } from "lucide-react";

/** Emergency rollback switch: false disables this experiment completely. */
export const ENABLE_FUTURE_MODEL_YEAR_CONFIRMATION = true;

export function isImplausibleFutureModelYear(
  year: number,
  currentYear = new Date().getFullYear(),
): boolean {
  return ENABLE_FUTURE_MODEL_YEAR_CONFIRMATION && year > currentYear + 1;
}

export function FutureModelYearConfirmation({
  year,
  onUseCurrentYear,
  onConfirm,
}: {
  year: number;
  onUseCurrentYear: () => void;
  onConfirm: () => void;
}) {
  const currentYear = new Date().getFullYear();
  if (!isImplausibleFutureModelYear(year, currentYear)) return null;

  return (
    <section className="relative overflow-hidden rounded-2xl border-2 border-orange-300/80 bg-gradient-to-br from-orange-300/20 via-amber-200/10 to-white/5 p-4 shadow-[0_12px_35px_rgba(249,115,22,0.16)]">
      <div className="relative flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-300 text-orange-950">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-orange-100">Model yılını kontrol edin</p>
          <p className="mt-1 text-xs leading-5 text-orange-50/80">
            <strong className="text-white">{year}</strong> model yılı gelecekte
            görünüyor. <strong className="text-white">{currentYear}</strong> mı demek
            istediniz?
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onUseCurrentYear}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-400 px-3 py-2 text-xs font-bold text-emerald-950"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {currentYear} olarak düzelt
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white"
            >
              <Check className="h-3.5 w-3.5" />
              {year} doğru, kullan
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
