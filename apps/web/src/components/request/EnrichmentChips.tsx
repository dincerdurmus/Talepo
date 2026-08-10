"use client";

import { Plus } from "lucide-react";

import type { QuestionCandidate } from "@/lib/request-brain/types";

type Props = {
  candidates: QuestionCandidate[];
  activeFieldKey: string | null;
  draftValue: string;
  onSelect: (question: QuestionCandidate) => void;
  onDraftChange: (value: string) => void;
  onApply: (question: QuestionCandidate, value: string) => void;
  onCancel: () => void;
};

export function EnrichmentChips({
  candidates,
  activeFieldKey,
  draftValue,
  onSelect,
  onDraftChange,
  onApply,
  onCancel,
}: Props) {
  if (candidates.length === 0) return null;

  const active = candidates.find((c) => c.fieldKey === activeFieldKey) ?? null;

  return (
    <section className="rounded-[1.5rem] border border-teal-900/8 bg-white/95 p-5 sm:p-6">
      <h3 className="text-base font-semibold tracking-tight text-[#0f1f1d]">
        Talebinizi biraz daha güçlendirmek ister misiniz?
      </h3>
      <p className="mt-1.5 text-sm leading-6 text-teal-950/48">
        Bu bilgiler zorunlu değil; eklerseniz satıcıların ihtiyacınızı daha doğru
        anlamasına yardımcı olur.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {candidates.map((q) => {
          const isActive = q.fieldKey === activeFieldKey;
          return (
            <button
              key={q.fieldKey}
              type="button"
              onClick={() => onSelect(q)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                isActive
                  ? "border-[#0f766e]/35 bg-[#f0fdfa] text-[#115e59]"
                  : "border-teal-900/10 bg-[#fafcfb] text-teal-950/70 hover:border-[#0f766e]/25 hover:bg-[#f0fdfa]"
              }`}
            >
              <Plus className="h-3.5 w-3.5 opacity-70" aria-hidden />
              {q.label}
            </button>
          );
        })}
      </div>

      {active ? (
        <div className="mt-4 rounded-2xl border border-teal-900/8 bg-[#f7faf9] p-4">
          <p className="text-sm font-medium text-[#0f1f1d]">{active.label}</p>
          {active.reason ? (
            <p className="mt-1 text-xs text-teal-950/45">{active.reason}</p>
          ) : null}

          {active.quickChoices && active.quickChoices.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {active.quickChoices.map((choice) => (
                <button
                  key={choice.label}
                  type="button"
                  onClick={() => onApply(active, choice.value)}
                  className="rounded-full border border-teal-900/10 bg-white px-3 py-1.5 text-xs font-medium text-teal-950/75 transition hover:border-[#0f766e]/30 hover:bg-[#f0fdfa]"
                >
                  {choice.label}
                </button>
              ))}
            </div>
          ) : active.inputType === "select" ? (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={draftValue}
                onChange={(e) => onDraftChange(e.target.value)}
                className="h-11 flex-1 rounded-xl border border-teal-900/10 bg-white px-3.5 text-sm outline-none focus:border-[#0f766e]/35"
              >
                <option value="">Seçiniz</option>
                {active.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!draftValue.trim()}
                onClick={() => onApply(active, draftValue)}
                className="h-11 rounded-xl bg-[#0f766e] px-4 text-sm font-medium text-white disabled:opacity-40"
              >
                Ekle
              </button>
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type={active.inputType === "number" ? "number" : "text"}
                value={draftValue}
                onChange={(e) => onDraftChange(e.target.value)}
                placeholder={active.placeholder ?? "Değer girin"}
                className="h-11 flex-1 rounded-xl border border-teal-900/10 bg-white px-3.5 text-sm outline-none focus:border-[#0f766e]/35"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && draftValue.trim()) {
                    e.preventDefault();
                    onApply(active, draftValue);
                  }
                }}
              />
              <button
                type="button"
                disabled={!draftValue.trim()}
                onClick={() => onApply(active, draftValue)}
                className="h-11 rounded-xl bg-[#0f766e] px-4 text-sm font-medium text-white disabled:opacity-40"
              >
                Ekle
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onCancel}
            className="mt-3 text-xs font-medium text-teal-800/50 hover:text-[#0f1f1d]"
          >
            Vazgeç
          </button>
        </div>
      ) : null}
    </section>
  );
}
