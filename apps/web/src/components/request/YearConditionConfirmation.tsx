"use client";

import { AlertTriangle, Check, RefreshCw } from "lucide-react";

/** Emergency rollback switch: false removes this confirmation surface. */
export const ENABLE_YEAR_CONDITION_CONFIRMATION = true;

export function shouldConfirmYearCondition(
  yearText: string,
  condition: "Sıfır" | "İkinci el",
  currentYear = new Date().getFullYear(),
): boolean {
  if (!ENABLE_YEAR_CONDITION_CONFIRMATION) return false;
  const match = yearText.match(/(?:19|20)\d{2}/);
  if (!match) return false;
  const year = Number(match[0]);

  // Normal combinations need no interruption:
  // past model + used, current/future model + new.
  if (condition === "İkinci el") return year >= currentYear;
  return year < currentYear;
}

export function YearConditionConfirmation({
  year,
  condition,
  onChangeCondition,
  onConfirm,
}: {
  year: string;
  condition: "Sıfır" | "İkinci el";
  onChangeCondition: (value: "Sıfır" | "İkinci el") => void;
  onConfirm: () => void;
}) {
  if (!shouldConfirmYearCondition(year, condition)) {
    return null;
  }

  const opposite = condition === "Sıfır" ? "İkinci el" : "Sıfır";

  return (
    <section className="relative overflow-hidden rounded-2xl border-2 border-amber-300/80 bg-gradient-to-br from-amber-300/20 via-orange-200/10 to-white/5 p-4 shadow-[0_12px_35px_rgba(245,158,11,0.16)]">
      <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-amber-300/20 blur-3xl" />
      <div className="relative flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-300 text-amber-950 shadow-lg shadow-amber-400/20">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-amber-100">Bu iki bilgi doğru mu?</p>
          <p className="mt-1 text-xs leading-5 text-amber-50/75">
            Model yılı <strong className="text-white">{year}</strong> ve durum
            <strong className="text-white"> {condition}</strong> olarak anlaşıldı.
            İlanı yayınlamadan önce kontrol edin.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onConfirm}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-400 px-3 py-2 text-xs font-bold text-emerald-950 transition hover:-translate-y-0.5 hover:bg-emerald-300"
            >
              <Check className="h-3.5 w-3.5" />
              Evet, doğru
            </button>
            <button
              type="button"
              onClick={() => {
                onChangeCondition(opposite);
                onConfirm();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {opposite} olarak düzelt
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
