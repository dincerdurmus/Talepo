"use client";

import { AlertTriangle } from "lucide-react";

export function BudgetConflictConfirmation({
  textBudget,
  enteredBudget,
  onChoose,
}: {
  textBudget: string;
  enteredBudget: string;
  onChoose: (value: string) => void;
}) {
  return (
    <section className="rounded-2xl border-2 border-orange-300/70 bg-orange-300/10 p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-orange-100">
        <AlertTriangle className="h-4 w-4" /> Bütçeniz iki farklı şekilde girilmiş
      </p>
      <p className="mt-1 text-xs leading-5 text-orange-50/70">
        Talepteki bütçe ile sonradan girdiğiniz bütçe farklı. Kullanılacak doğru değeri seçin.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={() => onChoose(textBudget)} className="rounded-xl border border-orange-200/25 bg-white/10 px-3 py-2 text-left text-xs text-white hover:bg-white/15">
          <span className="block text-[10px] text-orange-100/60">Talep metnindeki</span>
          <strong className="mt-0.5 block">{textBudget}</strong>
        </button>
        <button type="button" onClick={() => onChoose(enteredBudget)} className="rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-left text-xs text-white hover:bg-emerald-300/15">
          <span className="block text-[10px] text-emerald-100/60">Sonradan girilen</span>
          <strong className="mt-0.5 block">{enteredBudget}</strong>
        </button>
      </div>
    </section>
  );
}
