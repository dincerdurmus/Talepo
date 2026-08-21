"use client";

import { useId, useMemo, useState } from "react";

import {
  signalHelper,
  signalInput,
  signalLabel,
  signalSurface,
} from "@/components/panel/profile/ProfileSignal";
import type { FocusedQuestion } from "@/lib/request-composer/v2/focused-questions";
import type { QuestionControlDef } from "@/lib/request-composer/v2/question-control-types";
import {
  getDistrictsForProvince,
  TURKEY_IL_NAMES,
} from "@/lib/geo/turkey-districts";

type Props = {
  questions: FocusedQuestion[];
  draftByKey: Record<string, string>;
  onDraftChange: (fieldKey: string, value: string) => void;
  onAnswer: (fieldKey: string, value: string) => void;
  onSkip: (fieldKey: string) => void;
  healthNotice?: boolean;
  collapsed?: boolean;
  onExpand?: () => void;
  remainingCriticalCount?: number;
};

function OptionChip(props: {
  label: string;
  selected?: boolean;
  onClick: () => void;
  soft?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={props.selected ?? false}
      className={`inline-flex min-h-11 max-w-full items-center justify-center rounded-xl border px-3.5 py-2 text-left text-sm font-medium leading-snug transition-colors sm:min-h-10 ${
        props.selected
          ? "border-[#0f766e] bg-[#dff6ef] text-[#0f5f59] ring-1 ring-[#0f766e]/35"
          : props.soft
            ? "border-teal-900/10 bg-white text-teal-950/65 hover:bg-[#f7faf9]"
            : "border-teal-900/12 bg-[#f7faf9] text-[#0f1f1d] hover:border-[#0f766e]/30 hover:bg-[#f0fdfa]"
      }`}
      onClick={props.onClick}
    >
      {props.selected ? (
        <span className="mr-1.5 shrink-0 text-[#0f766e]" aria-hidden>
          ✓
        </span>
      ) : null}
      <span className="min-w-0 whitespace-normal break-words">{props.label}</span>
    </button>
  );
}

function LocationPickerControl(props: {
  control: QuestionControlDef;
  onAnswer: (value: string) => void;
  isRealEstate?: boolean;
}) {
  const [il, setIl] = useState("");
  const [ilce, setIlce] = useState("");
  const districts = useMemo(
    () => (il ? getDistrictsForProvince(il) : []),
    [il],
  );

  return (
    <div className="mt-3 space-y-3" data-testid="control-location-picker">
      <div className="flex flex-wrap gap-2">
        {props.control.softOptions.map((opt) => (
          <OptionChip
            key={opt.value}
            label={opt.label}
            soft
            onClick={() => props.onAnswer(opt.value)}
          />
        ))}
      </div>
      <div>
        <label className={signalLabel} htmlFor="composer-il">
          İl
        </label>
        <select
          id="composer-il"
          className={signalInput}
          value={il}
          onChange={(e) => {
            setIl(e.target.value);
            setIlce("");
          }}
        >
          <option value="">İl seçin</option>
          {TURKEY_IL_NAMES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      {il ? (
        <div>
          <label className={signalLabel} htmlFor="composer-ilce">
            İlçe
          </label>
          <select
            id="composer-ilce"
            className={signalInput}
            value={ilce}
            onChange={(e) => {
              const next = e.target.value;
              setIlce(next);
              if (next) props.onAnswer(`${il} / ${next}`);
            }}
          >
            <option value="">İlçe seçin</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}

function MoneyRangeControl(props: {
  control: QuestionControlDef;
  onAnswer: (value: string) => void;
}) {
  const [mode, setMode] = useState<"menu" | "range">("menu");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const basisLabel =
    props.control.budgetBasis === "monthly"
      ? "Aylık"
      : props.control.budgetBasis === "per_unit"
        ? "Adet başı"
        : props.control.budgetBasis === "service"
          ? "Hizmet"
          : props.control.budgetBasis === "daily"
            ? "Günlük"
            : props.control.budgetBasis === "total"
              ? "Toplam"
              : null;

  if (mode === "menu") {
    return (
        <div className="mt-3 flex flex-wrap gap-2" data-testid="control-money-range">
        {props.control.options.map((opt) => (
          <OptionChip
            key={opt.value}
            label={opt.label}
            soft={opt.soft}
            onClick={() => {
              if (opt.opensCustom || opt.value === "__budget_range__") {
                setMode("range");
                return;
              }
              props.onAnswer(opt.value);
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3" data-testid="control-money-range-form">
      <p className="text-xs text-teal-950/55">
        {basisLabel
          ? `${basisLabel} bütçe · ${props.control.currency ?? "TRY"}`
          : props.control.currency ?? "TRY"}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={signalLabel} htmlFor="budget-min">
            Minimum
          </label>
          <input
            id="budget-min"
            inputMode="numeric"
            className={signalInput}
            value={min}
            onChange={(e) => setMin(e.target.value)}
            placeholder="Örn. 20000"
          />
        </div>
        <div>
          <label className={signalLabel} htmlFor="budget-max">
            Maksimum
          </label>
          <input
            id="budget-max"
            inputMode="numeric"
            className={signalInput}
            value={max}
            onChange={(e) => setMax(e.target.value)}
            placeholder="Örn. 30000"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="min-h-11 rounded-xl bg-[#0f766e] px-4 text-sm font-medium text-white"
          onClick={() => {
            const a = min.replace(/\D/g, "");
            const b = max.replace(/\D/g, "");
            if (!a && !b) return;
            const fmt = (n: string) =>
              new Intl.NumberFormat("tr-TR").format(Number(n));
            if (a && b) props.onAnswer(`${fmt(a)}–${fmt(b)} TL`);
            else props.onAnswer(`${fmt(a || b)} TL`);
          }}
        >
          Kaydet
        </button>
        <button
          type="button"
          className="min-h-11 rounded-xl px-3 text-sm text-teal-950/60"
          onClick={() => setMode("menu")}
        >
          Geri
        </button>
      </div>
    </div>
  );
}

function ChoiceControl(props: {
  control: QuestionControlDef;
  fieldKey: string;
  draft: string;
  onDraftChange: (v: string) => void;
  onAnswer: (value: string) => void;
  baseId: string;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const primary = props.control.options;
  const soft = props.control.softOptions;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mt-3 space-y-3" data-testid={`control-${props.control.controlType}`}>
      {primary.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {primary.map((opt) => (
            <OptionChip
              key={opt.value}
              label={opt.label}
              onClick={() => {
                if (opt.opensCustom || opt.value === "__custom__") {
                  setCustomOpen(true);
                  setDateOpen(false);
                  return;
                }
                if (opt.value === "__date__") {
                  setDateOpen(true);
                  setCustomOpen(false);
                  return;
                }
                props.onAnswer(opt.value);
              }}
            />
          ))}
        </div>
      ) : null}

      {dateOpen ? (
        <div>
          <label className={signalLabel} htmlFor={`${props.baseId}-date`}>
            Tarih
          </label>
          <input
            id={`${props.baseId}-date`}
            type="date"
            min={today}
            className={signalInput}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              if (v < today) return;
              props.onAnswer(v);
            }}
          />
        </div>
      ) : null}

      {customOpen ||
      (props.control.controlType === "text_fallback" &&
        primary.length === 0) ||
      (props.control.controlType === "searchable_entity" &&
        primary.length === 0 &&
        !soft.some((s) => s.opensCustom)) ? (
        <div>
          <label className={signalLabel} htmlFor={`${props.baseId}-custom`}>
            {props.control.customLabel ?? "Özel değer"}
          </label>
          <input
            id={`${props.baseId}-custom`}
            className={signalInput}
            value={props.draft}
            onChange={(e) => props.onDraftChange(e.target.value)}
            placeholder={props.control.placeholder ?? "Yazın"}
            inputMode={
              props.control.controlType === "number_presets" ||
              props.control.unit === "adet"
                ? "numeric"
                : "text"
            }
          />
          <button
            type="button"
            className="mt-2 min-h-11 rounded-xl bg-[#0f766e] px-4 text-sm font-medium text-white"
            onClick={() => {
              const v = props.draft.trim();
              if (!v) return;
              const withUnit =
                props.control.unit &&
                props.control.controlType === "number_presets" &&
                /^\d/.test(v) &&
                !v.includes(props.control.unit)
                  ? `${v} ${props.control.unit}`
                  : v;
              props.onAnswer(withUnit);
              setCustomOpen(false);
            }}
          >
            Kaydet
          </button>
        </div>
      ) : props.control.allowCustom &&
        !customOpen &&
        props.control.controlType !== "money_range" &&
        props.control.controlType !== "location_picker" &&
        !primary.some((o) => o.opensCustom) ? (
        <button
          type="button"
          className="min-h-10 text-xs font-medium text-[#0f766e]"
          onClick={() => setCustomOpen(true)}
        >
          {props.control.customLabel ?? "Listede yok / Özel değer"}
        </button>
      ) : null}

      {soft.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 border-t border-teal-950/[0.06] pt-3">
          {soft.map((opt) => (
            <OptionChip
              key={opt.value}
              label={opt.label}
              soft
              onClick={() => {
                if (opt.opensCustom) {
                  setCustomOpen(true);
                  return;
                }
                props.onAnswer(opt.value);
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function FocusedQuestionsPanel({
  questions,
  draftByKey,
  onDraftChange,
  onAnswer,
  onSkip,
  healthNotice = false,
  collapsed = false,
  onExpand,
  remainingCriticalCount,
}: Props) {
  const baseId = useId();
  const questionKey = questions.map((q) => q.fieldKey).join("|");
  const [activeBySet, setActiveBySet] = useState({ key: "", index: 0 });
  const activeIndex =
    activeBySet.key === questionKey ? activeBySet.index : 0;

  if (questions.length === 0) return null;

  if (collapsed) {
    const answeredHint =
      typeof remainingCriticalCount === "number" && remainingCriticalCount === 0
        ? "Bilgiler tamam"
        : null;
    return (
      <section className={`mt-3 ${signalSurface} px-3.5 py-2.5`}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-teal-950/70">
            {answeredHint ??
              (typeof remainingCriticalCount === "number" &&
              remainingCriticalCount > 0
                ? `${remainingCriticalCount} kritik soru kaldı`
                : "Bilgileri gözden geçirebilirsiniz")}
          </p>
          {onExpand ? (
            <button
              type="button"
              className="min-h-10 text-xs font-medium text-[#0f766e]"
              onClick={onExpand}
            >
              Bilgileri düzenle
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  const safeIndex = Math.min(activeIndex, questions.length - 1);
  const active = questions[safeIndex]!;
  const control = active.control;

  function commit(value: string) {
    if (value === "skip" || value === "skip_optional") {
      onSkip(active.fieldKey);
      return;
    }
    onAnswer(active.fieldKey, value);
    // Advance to next unanswered in this group
    if (safeIndex < questions.length - 1) {
      setActiveBySet({ key: questionKey, index: safeIndex + 1 });
    }
  }

  return (
    <section
      aria-labelledby={`${baseId}-heading`}
      data-testid="composer-questions"
      className={`mt-3 ${signalSurface} px-3.5 py-3.5 sm:px-4 sm:py-4`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2
          id={`${baseId}-heading`}
          className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#0f766e]/70"
        >
          Birkaç netleştirme
        </h2>
        <p className="text-[11px] text-teal-950/45">
          {typeof remainingCriticalCount === "number" &&
          remainingCriticalCount > 0
            ? `${remainingCriticalCount} kritik soru kaldı`
            : null}
        </p>
      </div>

      {healthNotice ? (
        <p
          role="note"
          className="mt-2 rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs leading-5 text-amber-950/80"
        >
          Sağlık taleplerinde kişisel sağlık bilgisi paylaşmayın.
        </p>
      ) : null}

      {questions.length > 1 ? (
        <div
          role="tablist"
          aria-label="Bu gruptaki sorular"
          className="mt-2.5 flex flex-wrap gap-1"
        >
          {questions.map((q, index) => {
            const selected = index === safeIndex;
            return (
              <button
                key={q.fieldKey}
                type="button"
                role="tab"
                aria-selected={selected}
                title={q.summaryLabel ?? q.label}
                className={`min-h-9 max-w-[9.5rem] truncate rounded-full border px-2.5 text-[11px] font-medium ${
                  selected
                    ? "border-[#0f766e]/35 bg-[#dff6ef] text-[#0f5f59]"
                    : "border-teal-900/10 bg-white text-teal-950/50"
                }`}
                onClick={() => setActiveBySet({ key: questionKey, index })}
              >
                {q.summaryLabel ?? q.label ?? index + 1}
              </button>
            );
          })}
        </div>
      ) : null}

      <div
        className="mt-3 rounded-[14px] border border-teal-950/[0.08] bg-white/90 px-3.5 py-3"
        data-testid={`composer-question-${active.fieldKey}`}
        data-field-key={active.fieldKey}
        data-control-type={control?.controlType ?? "text_fallback"}
      >
        <p
          className="text-sm font-semibold leading-6 text-[#0f1f1d]"
          data-testid="composer-question-prompt"
        >
          {active.humanPrompt}
        </p>
        {active.helper ? <p className={signalHelper}>{active.helper}</p> : null}

        {control?.controlType === "location_picker" ? (
          <LocationPickerControl
            control={control}
            isRealEstate={active.categoryId === "real-estate"}
            onAnswer={commit}
          />
        ) : control?.controlType === "money_range" ? (
          <MoneyRangeControl control={control} onAnswer={commit} />
        ) : control ? (
          <ChoiceControl
            control={control}
            fieldKey={active.fieldKey}
            draft={draftByKey[active.fieldKey] ?? ""}
            onDraftChange={(v) => onDraftChange(active.fieldKey, v)}
            onAnswer={commit}
            baseId={baseId}
          />
        ) : (
          <ChoiceControl
            control={{
              controlType: "text_fallback",
              options: [],
              softOptions: (active.escapeChoices ?? []).map((e) => ({
                label: e.label,
                value: e.value,
                soft: true,
              })),
              allowCustom: true,
              commitOnSelect: false,
              placeholder: active.placeholder,
            }}
            fieldKey={active.fieldKey}
            draft={draftByKey[active.fieldKey] ?? ""}
            onDraftChange={(v) => onDraftChange(active.fieldKey, v)}
            onAnswer={commit}
            baseId={baseId}
          />
        )}
      </div>
    </section>
  );
}
