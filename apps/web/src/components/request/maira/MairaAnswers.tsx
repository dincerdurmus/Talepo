"use client";

/**
 * YANITLARIM — İKİNCİ DEPO DEĞİL, TÜRETİLMİŞ GÖRÜNÜM.
 *
 * Bu bileşen hiçbir cevap tutmaz. Aldığı satırlar kanonik alan torbasından
 * `projectUserAnswers` ile türetilir; tekilleştirme, öncelik ve çelişki kararı
 * orada verilir. Burada yalnız gösterim ve "bu satıra dön" isteği vardır.
 *
 * Bir satıra dokunmak ilgili KANONİK soruyu yeniden açar; düzenleme mevcut
 * cevap işleyicisinden geçer. Eski ve yeni cevap birlikte tutulmaz.
 *
 * GÖRSEL DİL (kurucu, 2026-09-01): eski mor/turuncu kart reddedildi
 * ("2000'li yıllardan kalma"). Yeni yüzey sahnenin kendi dilidir — sağdan
 * süzülen koyu cam panel, teal vurgu, mikro-tipografi. Mantık ve test
 * kimlikleri DEĞİŞMEDİ; yalnız sunum katmanı yenilendi.
 */
import { useState } from "react";

import type { QuestionControlDef } from "@/lib/request-composer/v2/question-control-types";
import type { UserAnswerRow } from "@/lib/request-composer/v2/answer-apply-plan";

type Props = {
  rows: UserAnswerRow[];
  open: boolean;
  onClose: () => void;
  /**
   * Satırın düzenleme yüzeyi. Seçenekler ve serbest cevap izni KANONİK
   * kontrol kaydından gelir; bu bileşen kendi çözücüsünü kurmaz ve hiçbir
   * seçenek üretmez. Kayıt bir kontrol veremiyorsa satır düzenlenemez.
   */
  editControl: (fieldKey: string) => QuestionControlDef | null;
  /** Kaydetme mevcut kanonik cevap işleyicisine gider. */
  onEdit: (fieldKey: string, value: string) => void;
};

const SHEET_CSS = `
@keyframes maira-sheet-in {
  from { opacity: 0; transform: translateX(24px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes maira-veil-in { from { opacity: 0 } to { opacity: 1 } }
.maira-answers-veil { animation: maira-veil-in 0.3s ease-out both; }
.maira-answers-sheet { animation: maira-sheet-in 0.4s cubic-bezier(0.22,0.61,0.36,1) both; }
@media (prefers-reduced-motion: reduce) {
  .maira-answers-veil, .maira-answers-sheet { animation: none; }
}
`;

export function MairaAnswers({
  rows,
  open,
  onClose,
  editControl,
  onEdit,
}: Props) {
  /* Yalnız hangi satırın açık olduğu ve yazılmakta olan taslak — cevap değil. */
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [customDraft, setCustomDraft] = useState("");
  const [customOpen, setCustomOpen] = useState(false);

  if (!open) return null;

  const closeEditor = () => {
    setEditingKey(null);
    setCustomDraft("");
    setCustomOpen(false);
  };
  const commit = (fieldKey: string, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onEdit(fieldKey, trimmed);
    closeEditor();
  };

  return (
    <div
      className="maira-answers-veil absolute inset-0 z-20 bg-[#02070c]/60 backdrop-blur-[6px]"
      data-testid="maira-answers"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <style>{SHEET_CSS}</style>
      <div className="maira-answers-sheet absolute inset-y-0 right-0 flex w-full max-w-[440px] flex-col border-l border-white/[0.07] bg-[#070d13]/95">
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-7 pb-5 pt-7">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#2dd4bf]/80">
              Yanıtlarım
            </p>
            <p className="mt-1.5 text-sm text-white/45">
              Bir şeyi yanlış anladıysam buradan düzeltebilirsin.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="grid h-9 w-9 flex-none place-items-center rounded-full border border-white/10 text-white/60 transition hover:border-white/30 hover:text-white"
          >
            <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none" aria-hidden>
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {rows.length === 0 ? (
            <p className="m-3 rounded-2xl border border-dashed border-white/12 px-4 py-4 text-sm leading-relaxed text-white/45">
              Henüz kayıtlı bir cevabın yok. Soruları yanıtladıkça burada
              görünecek.
            </p>
          ) : (
            <ul className="m-0 grid list-none gap-1 p-0">
              {rows.map((row) => {
                const control = editControl(row.fieldKey);
                const editing = editingKey === row.fieldKey;
                return (
                  <li key={row.fieldKey}>
                    <button
                      type="button"
                      disabled={!control}
                      onClick={() => {
                        if (!control) return;
                        setEditingKey(editing ? null : row.fieldKey);
                        setCustomOpen(false);
                        setCustomDraft("");
                      }}
                      aria-expanded={editing}
                      data-testid={`maira-answer-${row.fieldKey}`}
                      className={`group flex min-h-[58px] w-full items-center justify-between gap-4 rounded-xl px-3.5 py-3 text-left transition ${
                        editing
                          ? "bg-[#2dd4bf]/[0.08]"
                          : "hover:bg-white/[0.04]"
                      } disabled:cursor-default`}
                    >
                      <span className="min-w-0">
                        <span className="block text-[10px] font-medium uppercase tracking-[0.14em] text-white/35">
                          {row.label}
                        </span>
                        <span className="mt-0.5 block truncate text-[15px] font-medium text-white/90">
                          {row.displayValue}
                        </span>
                        {row.conflict ? (
                          <span className="mt-1 inline-block rounded-md bg-[#f59e0b]/15 px-2 py-0.5 text-[11px] text-[#fbbf24]">
                            Bunu yeniden kontrol edelim
                          </span>
                        ) : null}
                      </span>
                      {control ? (
                        <span
                          className={`flex-none text-[12px] transition ${
                            editing
                              ? "text-[#2dd4bf]"
                              : "text-white/0 group-hover:text-white/50"
                          }`}
                        >
                          {editing ? "Düzenleniyor" : "Düzenle"}
                        </span>
                      ) : null}
                    </button>

                    {editing && control ? (
                      <div
                        className="mb-2 mt-1 grid gap-2.5 rounded-xl border border-[#2dd4bf]/20 bg-[#2dd4bf]/[0.05] p-3.5"
                        data-testid={`maira-edit-${row.fieldKey}`}
                      >
                        <div className="flex flex-wrap gap-2">
                          {[...control.options, ...control.softOptions].map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                if (opt.opensCustom || opt.value === "__custom__") {
                                  setCustomOpen(true);
                                  return;
                                }
                                commit(row.fieldKey, opt.value);
                              }}
                              className={`min-h-10 rounded-lg border px-3.5 text-[13px] transition ${
                                opt.label === row.displayValue
                                  ? "border-[#2dd4bf]/60 bg-[#2dd4bf]/15 text-[#a7f3ec]"
                                  : "border-white/10 bg-white/[0.03] text-white/80 hover:border-[#2dd4bf]/40 hover:text-white"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>

                        {customOpen || control.options.length === 0 ? (
                          <div className="flex gap-2">
                            <input
                              value={customDraft}
                              onChange={(e) => setCustomDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commit(row.fieldKey, customDraft);
                              }}
                              placeholder={control.customLabel ?? "Cevabınız"}
                              data-testid={`maira-edit-input-${row.fieldKey}`}
                              className="min-h-10 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-[#2dd4bf]/50"
                            />
                            <button
                              type="button"
                              onClick={() => commit(row.fieldKey, customDraft)}
                              className="min-h-10 rounded-lg bg-[#2dd4bf] px-4 text-[13px] font-medium text-[#03110e] transition hover:bg-[#5eead4]"
                            >
                              Kaydet
                            </button>
                          </div>
                        ) : null}

                        <div className="flex items-center gap-4">
                          {control.allowCustom && !customOpen && control.options.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setCustomOpen(true)}
                              className="text-[12px] text-[#2dd4bf] transition hover:text-[#5eead4]"
                            >
                              {control.customLabel ?? "Listede yok / Özel değer"}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={closeEditor}
                            data-testid={`maira-edit-cancel-${row.fieldKey}`}
                            className="text-[12px] text-white/40 transition hover:text-white/70"
                          >
                            Vazgeç
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <p className="border-t border-white/[0.06] px-7 py-4 text-[11px] leading-relaxed text-white/30">
          Bu liste kanonik cevaplarından türetilir; iç anahtar ve otorite adları
          gösterilmez.
        </p>
      </div>
    </div>
  );
}
