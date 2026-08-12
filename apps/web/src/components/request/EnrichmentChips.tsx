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
  /** light = left form card; dark = Talepo AI panel */
  variant?: "light" | "dark";
  /** Optional human prompts keyed by fieldKey (AI panel) */
  humanPrompts?: Record<string, string>;
};

export function EnrichmentChips({
  candidates,
  activeFieldKey,
  draftValue,
  onSelect,
  onDraftChange,
  onApply,
  onCancel,
  variant = "light",
  humanPrompts,
}: Props) {
  if (candidates.length === 0) return null;

  const active = candidates.find((c) => c.fieldKey === activeFieldKey) ?? null;
  const dark = variant === "dark";

  return (
    <section
      className={
        dark
          ? "space-y-3"
          : "rounded-[1.5rem] border border-teal-900/8 bg-white/95 p-5 sm:p-6"
      }
    >
      {!dark ? (
        <>
          <h3 className="text-base font-semibold tracking-tight text-[#0f1f1d]">
            Talebinizi biraz daha güçlendirmek ister misiniz?
          </h3>
          <p className="mt-1.5 text-sm leading-6 text-teal-950/48">
            Bu bilgiler zorunlu değil; eklerseniz satıcıların ihtiyacınızı daha
            doğru anlamasına yardımcı olur.
          </p>
        </>
      ) : (
        <p className="text-[11px] leading-4 text-teal-100/45">
          İsteğe bağlı — ekledikçe eşleşme güçlenir
        </p>
      )}

      <div className={dark ? "flex flex-wrap gap-1.5" : "mt-4 flex flex-wrap gap-2"}>
        {candidates.map((q) => {
          const isActive = q.fieldKey === activeFieldKey;
          return (
            <button
              key={q.fieldKey}
              type="button"
              onClick={() => onSelect(q)}
              className={
                dark
                  ? `inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                      isActive
                        ? "border-teal-200/50 bg-white/15 text-white"
                        : "border-teal-200/25 bg-white/5 text-teal-50/90 hover:border-teal-200/45 hover:bg-white/10"
                    }`
                  : `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                      isActive
                        ? "border-[#0f766e]/35 bg-[#f0fdfa] text-[#115e59]"
                        : "border-teal-900/10 bg-[#fafcfb] text-teal-950/70 hover:border-[#0f766e]/25 hover:bg-[#f0fdfa]"
                    }`
              }
            >
              <Plus className="h-3.5 w-3.5 opacity-70" aria-hidden />
              {q.label}
            </button>
          );
        })}
      </div>

      {active ? (
        <div
          className={
            dark
              ? "rounded-xl border border-teal-200/20 bg-white/[0.06] p-3"
              : "mt-4 rounded-2xl border border-teal-900/8 bg-[#f7faf9] p-4"
          }
        >
          <p
            className={
              dark
                ? "text-xs font-medium text-teal-50/95"
                : "text-sm font-medium text-[#0f1f1d]"
            }
          >
            {humanPrompts?.[active.fieldKey] ?? active.label}
          </p>
          {!dark && active.reason ? (
            <p className="mt-1 text-xs text-teal-950/45">{active.reason}</p>
          ) : null}

          {active.quickChoices && active.quickChoices.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {active.quickChoices.map((choice) => (
                <button
                  key={choice.label}
                  type="button"
                  onClick={() => onApply(active, choice.value)}
                  className={
                    dark
                      ? "rounded-full border border-teal-200/25 bg-white/5 px-2.5 py-1 text-[11px] text-teal-50/90 hover:bg-white/10"
                      : "rounded-full border border-teal-900/10 bg-white px-3 py-1.5 text-xs font-medium text-teal-950/75 transition hover:border-[#0f766e]/30 hover:bg-[#f0fdfa]"
                  }
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
                className={
                  dark
                    ? "h-10 flex-1 rounded-lg border border-teal-200/20 bg-[#0b1f1c] px-3 text-xs text-white outline-none"
                    : "h-11 flex-1 rounded-xl border border-teal-900/10 bg-white px-3.5 text-sm outline-none focus:border-[#0f766e]/35"
                }
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
                className={
                  dark
                    ? "h-10 rounded-lg bg-teal-400/90 px-3 text-xs font-semibold text-[#042f2e] disabled:opacity-40"
                    : "h-11 rounded-xl bg-[#0f766e] px-4 text-sm font-medium text-white disabled:opacity-40"
                }
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
                className={
                  dark
                    ? "h-10 flex-1 rounded-lg border border-teal-200/20 bg-[#0b1f1c] px-3 text-xs text-white outline-none placeholder:text-teal-100/30"
                    : "h-11 flex-1 rounded-xl border border-teal-900/10 bg-white px-3.5 text-sm outline-none focus:border-[#0f766e]/35"
                }
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
                className={
                  dark
                    ? "h-10 rounded-lg bg-teal-400/90 px-3 text-xs font-semibold text-[#042f2e] disabled:opacity-40"
                    : "h-11 rounded-xl bg-[#0f766e] px-4 text-sm font-medium text-white disabled:opacity-40"
                }
              >
                Ekle
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onCancel}
            className={
              dark
                ? "mt-2 text-[11px] font-medium text-teal-100/40 hover:text-teal-100/70"
                : "mt-3 text-xs font-medium text-teal-800/50 hover:text-[#0f1f1d]"
            }
          >
            Vazgeç
          </button>
        </div>
      ) : null}
    </section>
  );
}
