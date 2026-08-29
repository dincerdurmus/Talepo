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
      className="absolute inset-0 z-20 grid place-items-center overflow-auto bg-[rgba(7,4,15,0.72)] p-6 backdrop-blur-sm"
      data-testid="maira-answers"
    >
      <div className="grid w-full max-w-[520px] gap-4 rounded-[20px] border border-white/10 bg-[rgba(20,12,34,0.94)] p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="m-0 text-xl font-medium text-[#f2ede9]">Yanıtlarım</h2>
            <p className="mt-1.5 text-sm text-[#f2ede9]/60">
              Bir şeyi yanlış anladıysam buradan düzeltebilirsin.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-full border border-white/10 bg-white/[0.05] px-4 text-xs text-[#f2ede9] transition hover:border-white/25"
          >
            Kapat
          </button>
        </div>

        {rows.length === 0 ? (
          <p className="m-0 rounded-2xl border border-dashed border-[#e8845c]/40 bg-[#e8845c]/[0.05] px-4 py-3.5 text-sm leading-relaxed text-[#f2ede9]/60">
            Henüz kayıtlı bir cevabın yok. Soruları yanıtladıkça burada
            görünecek.
          </p>
        ) : (
          <ul className="m-0 grid list-none gap-2 p-0">
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
                    className="flex min-h-[52px] w-full items-center justify-between gap-3.5 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-left transition hover:border-[#e8845c]/45 disabled:cursor-default disabled:opacity-70"
                  >
                    <span className="text-[13px] text-[#f2ede9]/60">{row.label}</span>
                    <span className="text-right text-[15px] text-[#f2ede9]">
                      {row.displayValue}
                      {row.conflict ? (
                        <span className="ml-2 rounded-md bg-[#e8845c]/20 px-2 py-0.5 text-[11px] text-[#ffb489]">
                          Bunu yeniden kontrol edelim
                        </span>
                      ) : null}
                    </span>
                  </button>

                  {editing && control ? (
                    <div
                      className="mt-2 grid gap-2 rounded-2xl border border-[#e8845c]/25 bg-[#e8845c]/[0.06] p-3"
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
                            className={`min-h-10 rounded-xl border px-3 text-sm transition ${
                              opt.label === row.displayValue
                                ? "border-[#e8845c]/60 bg-[#e8845c]/20"
                                : "border-white/10 bg-white/[0.04] hover:border-[#e8845c]/40"
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
                            placeholder={control.customLabel ?? "Cevabınız"}
                            data-testid={`maira-edit-input-${row.fieldKey}`}
                            className="min-h-10 flex-1 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-sm text-[#f2ede9]"
                          />
                          <button
                            type="button"
                            onClick={() => commit(row.fieldKey, customDraft)}
                            className="min-h-10 rounded-xl border border-[#e8845c]/55 bg-[#e8845c]/20 px-4 text-sm"
                          >
                            Kaydet
                          </button>
                        </div>
                      ) : null}

                      {control.allowCustom && !customOpen && control.options.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setCustomOpen(true)}
                          className="justify-self-start text-xs text-[#ffb489]"
                        >
                          {control.customLabel ?? "Listede yok / Özel değer"}
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={closeEditor}
                        data-testid={`maira-edit-cancel-${row.fieldKey}`}
                        className="justify-self-start text-xs text-[#f2ede9]/50"
                      >
                        Vazgeç
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <p className="m-0 text-xs leading-relaxed text-[#f2ede9]/40">
          Bu liste kanonik cevaplarından türetilir; iç anahtar ve otorite adları
          gösterilmez.
        </p>
      </div>
    </div>
  );
}
