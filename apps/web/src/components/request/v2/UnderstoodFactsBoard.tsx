"use client";

import { MoreHorizontal, Pencil } from "lucide-react";
import { useId, useState } from "react";

import {
  signalHelper,
  signalInput,
  signalSurface,
} from "@/components/panel/profile/ProfileSignal";
import { DONT_CARE_FIELD_KEYS } from "@/lib/request-composer/v2/display-format";
import type { EditableUnderstoodFact } from "@/lib/request-composer/v2/understood-facts";
import type { QuestionControlDef } from "@/lib/request-composer/v2/question-control-types";

type Props = {
  facts: EditableUnderstoodFact[];
  categoryLabel?: string | null;
  /** Pre-built compact line for review collapse — avoids orphan soft tokens. */
  collapsedPreview?: string | null;
  hasText: boolean;
  updating?: boolean;
  degraded?: boolean;
  /** When true, show a one-line collapsed summary. */
  collapsed?: boolean;
  onExpand?: () => void;
  onConfirmFact: (key: string) => void;
  onDismissFact: (key: string) => void;
  onEditFact: (key: string, value: string) => void;
  onDontCareFact: (key: string) => void;
  /**
   * KANONİK DÜZELTME KONTROLÜ (2026-08-30).
   *
   * Maira "Yanıtlarım" ile AYNI köprüden gelir. Kayıt bir kontrol
   * verdiğinde kalem serbest metin kutusu yerine kanonik seçenekleri
   * gösterir; böylece iki yüzey aynı cevap evrenini sunar. Kontrol yoksa
   * mevcut serbest yazma davranışı aynen korunur — uydurma seçenek
   * üretilmez.
   */
  editControl?: (key: string) => QuestionControlDef | null;
};

export function UnderstoodFactsBoard({
  facts,
  categoryLabel,
  collapsedPreview,
  hasText,
  updating,
  degraded,
  collapsed = false,
  onExpand,
  onConfirmFact,
  onDismissFact,
  onEditFact,
  onDontCareFact,
  editControl,
}: Props) {
  const baseId = useId();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [menuKey, setMenuKey] = useState<string | null>(null);

  if (!hasText) return null;

  if (updating) {
    return (
      <section
        aria-busy="true"
        aria-live="polite"
        className={`mt-3 ${signalSurface} px-3.5 py-3 sm:px-4`}
      >
        <h2 className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#0f766e]/70">
          Talepo’nun anladıkları
        </h2>
        <p className="mt-1 text-sm text-teal-950/55">Kontrol ediliyor…</p>
      </section>
    );
  }

  if (degraded) {
    return (
      <section className={`mt-3 ${signalSurface} px-3.5 py-3 sm:px-4`}>
        <h2 className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#0f766e]/70">
          Talepo’nun anladıkları
        </h2>
        <p className="mt-1 text-sm text-teal-950/50">
          Yazınız korunuyor, kategori paneli şu an sınırlı.
        </p>
      </section>
    );
  }

  if (facts.length === 0 && !categoryLabel) return null;

  if (collapsed) {
    const preview =
      collapsedPreview?.trim() ||
      [categoryLabel, ...facts.slice(0, 3).map((f) => f.displayValue)]
        .filter(Boolean)
        .join(" · ");
    return (
      <section className={`mt-3 ${signalSurface} px-3.5 py-2.5 sm:px-4`}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#0f766e]/70">
              Anlaşılanlar
            </p>
            <p className="mt-0.5 truncate text-sm text-[#0f1f1d]">{preview}</p>
          </div>
          {onExpand ? (
            <button
              type="button"
              className="min-h-10 shrink-0 rounded-lg px-2.5 text-xs font-medium text-[#0f766e]"
              onClick={onExpand}
            >
              Düzenle
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  const understood = facts.filter((f) => f.tone === "understood");
  const needsCheck = facts.filter((f) => f.tone !== "understood");

  return (
    <section
      aria-labelledby={`${baseId}-heading`}
      className={`mt-3 ${signalSurface} px-3.5 py-3 sm:px-4`}
    >
      <h2
        id={`${baseId}-heading`}
        className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#0f766e]/70"
      >
        Talepo’nun anladıkları
      </h2>
      {categoryLabel ? (
        <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#e3f1f2] px-3 py-1 text-[13px] font-semibold text-[#0f5f59]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#0f766e]" aria-hidden />
          {categoryLabel}
        </p>
      ) : (
        <p className={signalHelper}>Kısa kontrol. Yalnız bulunan bilgiler.</p>
      )}

      {understood.length > 0 ? (
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {understood.map((fact) => (
            <FactRow
              key={fact.key}
              fact={fact}
              baseId={baseId}
              editingKey={editingKey}
              draft={draft}
              menuKey={menuKey}
              variant="compact"
              setEditingKey={setEditingKey}
              setDraft={setDraft}
              setMenuKey={setMenuKey}
              onConfirmFact={onConfirmFact}
              onDismissFact={onDismissFact}
              onEditFact={onEditFact}
              editControl={editControl}
              onDontCareFact={onDontCareFact}
            />
          ))}
        </ul>
      ) : null}

      {needsCheck.length > 0 ? (
        <ul className="mt-2.5 space-y-2">
          {needsCheck.map((fact) => (
            <FactRow
              key={fact.key}
              fact={fact}
              baseId={baseId}
              editingKey={editingKey}
              draft={draft}
              menuKey={menuKey}
              variant="check"
              setEditingKey={setEditingKey}
              setDraft={setDraft}
              setMenuKey={setMenuKey}
              onConfirmFact={onConfirmFact}
              onDismissFact={onDismissFact}
              onEditFact={onEditFact}
              editControl={editControl}
              onDontCareFact={onDontCareFact}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function FactRow({
  fact,
  baseId,
  editingKey,
  draft,
  menuKey,
  variant,
  setEditingKey,
  setDraft,
  setMenuKey,
  onConfirmFact,
  onDismissFact,
  onEditFact,
  onDontCareFact,
  editControl,
}: {
  fact: EditableUnderstoodFact;
  baseId: string;
  editingKey: string | null;
  draft: string;
  menuKey: string | null;
  variant: "compact" | "check";
  setEditingKey: (key: string | null) => void;
  setDraft: (value: string) => void;
  setMenuKey: (key: string | null) => void;
  onConfirmFact: (key: string) => void;
  onDismissFact: (key: string) => void;
  onEditFact: (key: string, value: string) => void;
  onDontCareFact: (key: string) => void;
  editControl?: (key: string) => QuestionControlDef | null;
}) {
  const editId = `${baseId}-edit-${fact.key}`;
  const isEditing = editingKey === fact.key;
  const menuOpen = menuKey === fact.key;
  const allowDontCare = DONT_CARE_FIELD_KEYS.has(fact.key);
  const control = editControl?.(fact.key) ?? null;
  const canonicalOptions = control
    ? [...control.options, ...control.softOptions].filter(
        (o) => o.value !== "__custom__",
      )
    : [];

  if (variant === "check") {
    return (
      <li className="rounded-[12px] border border-amber-200/80 bg-amber-50/70 px-3 py-2.5">
        <p className="text-[11px] font-medium text-amber-900/70">
          {fact.label}
          {fact.trustLabel ? (
            <>
              <span className="mx-1.5 opacity-40">·</span>
              {fact.trustLabel}
            </>
          ) : null}
        </p>
        {isEditing ? (
          <CanonicalOrFreeEdit
            id={editId}
            label={fact.label}
            options={canonicalOptions}
            allowCustom={control ? control.allowCustom : true}
            draft={draft}
            setDraft={setDraft}
            onPick={(value) => {
              onEditFact(fact.key, value);
              setEditingKey(null);
              setDraft("");
            }}
            onSave={() => {
              const next = draft.trim();
              if (next) onEditFact(fact.key, next);
              setEditingKey(null);
              setDraft("");
            }}
            onCancel={() => {
              setEditingKey(null);
              setDraft("");
            }}
          />
        ) : (
          <p className="mt-0.5 text-sm font-semibold text-[#0f1f1d]">
            {fact.displayValue}
          </p>
        )}
        {!isEditing ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              className="min-h-10 rounded-lg bg-[#0f766e] px-3 text-xs font-medium text-white"
              onClick={() => onConfirmFact(fact.key)}
            >
              Onayla
            </button>
            <button
              type="button"
              className="min-h-10 rounded-lg border border-teal-900/12 bg-white px-3 text-xs font-medium text-teal-950/70"
              onClick={() => {
                setEditingKey(fact.key);
                setDraft(fact.displayValue);
              }}
            >
              Düzenle
            </button>
            {allowDontCare ? (
              <button
                type="button"
                className="min-h-10 rounded-lg px-2.5 text-xs font-medium text-teal-950/55"
                onClick={() => onDontCareFact(fact.key)}
              >
                Fark etmez
              </button>
            ) : null}
          </div>
        ) : null}
      </li>
    );
  }

  return (
    <li
      className={`rounded-xl bg-[#f7faf9] px-3 py-2.5 transition-colors hover:bg-[#f0fdfa] ${
        isEditing ? "sm:col-span-2" : ""
      }`}
    >
      {isEditing ? (
        <CanonicalOrFreeEdit
          id={editId}
          label={fact.label}
          options={canonicalOptions}
          allowCustom={control ? control.allowCustom : true}
          draft={draft}
          setDraft={setDraft}
          onPick={(value) => {
            onEditFact(fact.key, value);
            setEditingKey(null);
            setDraft("");
          }}
          onSave={() => {
            const next = draft.trim();
            if (next) onEditFact(fact.key, next);
            setEditingKey(null);
            setDraft("");
          }}
          onCancel={() => {
            setEditingKey(null);
            setDraft("");
          }}
        />
      ) : (
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#0f1f1d]/40">
              {fact.label}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-[#0f1f1d] break-words">
              {fact.displayValue}
            </p>
          </div>
          <div className="relative flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              aria-label={`${fact.label} düzenle`}
              className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-teal-950/55 hover:bg-teal-950/[0.04]"
              onClick={() => {
                setEditingKey(fact.key);
                setDraft(fact.displayValue);
                setMenuKey(null);
              }}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              aria-label={`${fact.label} diğer işlemler`}
              aria-expanded={menuOpen}
              className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-teal-950/45 hover:bg-teal-950/[0.04]"
              onClick={() => setMenuKey(menuOpen ? null : fact.key)}
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden />
            </button>
            {menuOpen ? (
              <div
                role="menu"
                className="absolute bottom-11 right-0 z-30 min-w-[9rem] rounded-xl border border-[#0f1f1d]/10 bg-white py-1 shadow-[0_14px_40px_rgba(11,37,34,0.18)]"
              >
                {allowDontCare ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full px-3 py-2.5 text-left text-sm text-[#0f1f1d] hover:bg-[#f7faf9]"
                    onClick={() => {
                      onDontCareFact(fact.key);
                      setMenuKey(null);
                    }}
                  >
                    Fark etmez
                  </button>
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full px-3 py-2.5 text-left text-sm text-[#0f1f1d] hover:bg-[#f7faf9]"
                  onClick={() => {
                    onDismissFact(fact.key);
                    setMenuKey(null);
                  }}
                >
                  Kaldır
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </li>
  );
}

/**
 * DÜZELTME YÜZEYİ — KANONİK SEÇENEK VARSA ONU GÖSTERİR.
 *
 * Bu bileşen hiçbir seçenek ÜRETMEZ: aldığı liste, normal soru üretimiyle
 * aynı köprüden (`resolveEditQuestion`) gelen kanonik kontrolün kendisidir.
 * Kayıt seçenek veremiyorsa mevcut serbest yazma yolu aynen korunur;
 * kontrol serbest cevaba izin veriyorsa iki yol birlikte durur — cevap
 * evreni kapanmaz.
 */
function CanonicalOrFreeEdit({
  id,
  label,
  options,
  allowCustom,
  draft,
  setDraft,
  onPick,
  onSave,
  onCancel,
}: {
  id: string;
  label: string;
  options: { label: string; value: string }[];
  allowCustom: boolean;
  draft: string;
  setDraft: (v: string) => void;
  onPick: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  if (options.length === 0) {
    return (
      <EditInline
        id={id}
        label={label}
        draft={draft}
        setDraft={setDraft}
        onSave={onSave}
        onCancel={onCancel}
      />
    );
  }
  return (
    <div className="mt-1 flex flex-col gap-2" data-testid="fact-canonical-edit">
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className="min-h-9 rounded-full border border-teal-900/15 bg-white px-3 text-[13px] font-medium text-[#0f1f1d] hover:border-[#0f766e]/40"
            onClick={() => onPick(opt.value)}
          >
            {opt.label}
          </button>
        ))}
        <button
          type="button"
          className="min-h-9 rounded-full px-2 text-[13px] text-teal-950/60"
          onClick={onCancel}
        >
          Vazgeç
        </button>
      </div>
      {allowCustom ? (
        <EditInline
          id={id}
          label={label}
          draft={draft}
          setDraft={setDraft}
          onSave={onSave}
          onCancel={onCancel}
        />
      ) : null}
    </div>
  );
}

function EditInline({
  id,
  label,
  draft,
  setDraft,
  onSave,
  onCancel,
}: {
  id: string;
  label: string;
  draft: string;
  setDraft: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <label htmlFor={id} className="sr-only">
        {label} düzenle
      </label>
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className={`${signalInput} !mt-0 min-h-10`}
        autoFocus
      />
      <div className="flex gap-1.5">
        <button
          type="button"
          className="min-h-10 rounded-lg bg-[#0f766e] px-3 text-sm font-medium text-white"
          onClick={onSave}
        >
          Kaydet
        </button>
        <button
          type="button"
          className="min-h-10 rounded-lg border border-teal-900/15 bg-white px-3 text-sm text-teal-950/70"
          onClick={onCancel}
        >
          Vazgeç
        </button>
      </div>
    </div>
  );
}
