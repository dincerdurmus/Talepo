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
  // Kurucu kararı (2026-08-23): il çoklu seçmeli kutucuk; "Tümü" hem il hem
  // ilçe düzeyinde vardır. "Türkiye geneli" / "Konum fark etmez" çipleri yok.
  const [selectedIls, setSelectedIls] = useState<string[]>([]);
  const [allTurkey, setAllTurkey] = useState(false);
  const [ilce, setIlce] = useState("__all__");
  const [filter, setFilter] = useState("");

  const foldTr = (s: string) =>
    s
      .toLocaleLowerCase("tr-TR")
      .replace(/[çğıöşü]/g, (m) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" })[m] ?? m);

  const visibleIls = useMemo(() => {
    const f = foldTr(filter.trim());
    if (!f) return TURKEY_IL_NAMES;
    return TURKEY_IL_NAMES.filter((name) => foldTr(name).includes(f));
  }, [filter]);

  const singleIl = !allTurkey && selectedIls.length === 1 ? selectedIls[0]! : null;
  const districts = useMemo(
    () => (singleIl ? getDistrictsForProvince(singleIl) : []),
    [singleIl],
  );

  const toggleIl = (name: string) => {
    setAllTurkey(false);
    setIlce("__all__");
    setSelectedIls((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  };

  const canSave = allTurkey || selectedIls.length > 0;

  const commit = () => {
    if (allTurkey) {
      props.onAnswer("nationwide");
      return;
    }
    if (singleIl) {
      props.onAnswer(
        ilce && ilce !== "__all__" ? `${singleIl} / ${ilce}` : singleIl,
      );
      return;
    }
    if (selectedIls.length > 0) {
      props.onAnswer(selectedIls.join(", "));
    }
  };

  const checkboxRow =
    "flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-sm text-[#0f1f1d]/80 hover:bg-[#f0fdfa]";
  const checkboxBox =
    "h-4 w-4 shrink-0 rounded border-[#0f1f1d]/20 text-[#0f766e] focus:ring-[#0f766e]/25";

  return (
    <div className="mt-3 space-y-3" data-testid="control-location-picker">
      {props.control.softOptions.length > 0 ? (
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
      ) : null}
      <div>
        <label className={signalLabel} htmlFor="composer-il-filter">
          İl — birden fazla seçebilirsiniz
        </label>
        <input
          id="composer-il-filter"
          type="search"
          className={signalInput}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="İl ara…"
        />
        <div className="mt-2 max-h-52 space-y-0.5 overflow-y-auto rounded-xl border border-[#0f1f1d]/8 bg-white p-1.5">
          <label className={`${checkboxRow} font-semibold`}>
            <input
              type="checkbox"
              className={checkboxBox}
              checked={allTurkey}
              onChange={() => {
                setAllTurkey((prev) => !prev);
                setSelectedIls([]);
                setIlce("__all__");
              }}
            />
            Tümü (Türkiye geneli)
          </label>
          {visibleIls.map((name) => (
            <label key={name} className={checkboxRow}>
              <input
                type="checkbox"
                className={checkboxBox}
                checked={selectedIls.includes(name)}
                onChange={() => toggleIl(name)}
              />
              {name}
            </label>
          ))}
          {visibleIls.length === 0 ? (
            <p className="px-2.5 py-2 text-xs text-[#0f1f1d]/45">
              Bu aramayla eşleşen il yok.
            </p>
          ) : null}
        </div>
      </div>
      {singleIl ? (
        <div>
          <label className={signalLabel} htmlFor="composer-ilce">
            İlçe
          </label>
          <select
            id="composer-ilce"
            className={signalInput}
            value={ilce}
            onChange={(e) => setIlce(e.target.value)}
          >
            <option value="__all__">Tümü</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <button
        type="button"
        disabled={!canSave}
        className="min-h-11 rounded-xl bg-[#0f766e] px-4 text-sm font-medium text-white transition hover:bg-[#115e59] disabled:cursor-not-allowed disabled:opacity-40"
        onClick={commit}
      >
        Kaydet
      </button>
    </div>
  );
}

function MoneyRangeControl(props: {
  control: QuestionControlDef;
  onAnswer: (value: string) => void;
}) {
  // Kurucu kararı (2026-08-23): tek bütçe alanı, tıklamadan açık gelir;
  // tek alternatif "Teklifleri görmek istiyorum".
  const [amount, setAmount] = useState("");
  // Yazarken binlik ayracı: 30000 değil 30.000 görünür.
  const formatLive = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    return digits ? new Intl.NumberFormat("tr-TR").format(Number(digits)) : "";
  };
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

  const digits = amount.replace(/\D/g, "");

  return (
    <div className="mt-3 space-y-3" data-testid="control-money-range-form">
      <div>
        <label className={signalLabel} htmlFor="budget-amount">
          {basisLabel ? `${basisLabel} bütçe (TL)` : "Bütçe (TL)"}
        </label>
        <input
          id="budget-amount"
          inputMode="numeric"
          autoComplete="off"
          className={signalInput}
          value={amount}
          onChange={(e) => setAmount(formatLive(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && digits) {
              props.onAnswer(`${formatLive(digits)} TL`);
            }
          }}
          placeholder="Örn. 50.000"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!digits}
          className="min-h-11 rounded-xl bg-[#0f766e] px-4 text-sm font-medium text-white transition hover:bg-[#115e59] disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => {
            if (!digits) return;
            props.onAnswer(`${formatLive(digits)} TL`);
          }}
        >
          Kaydet
        </button>
        <span className="text-xs text-[#0f1f1d]/40">veya</span>
        {props.control.options
          .filter((opt) => opt.value === "open_to_offers")
          .map((opt) => (
            <OptionChip
              key={opt.value}
              label={opt.label}
              soft
              onClick={() => props.onAnswer(opt.value)}
            />
          ))}
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
      <div className="flex items-center justify-between gap-2">
        <h2
          id={`${baseId}-heading`}
          className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0f766e]/80"
        >
          <span
            className="inline-block h-[3px] w-3.5 rounded-full bg-gradient-to-r from-[#0f766e] to-[#7cc4ff]"
            aria-hidden
          />
          Son birkaç detay
        </h2>
        {typeof remainingCriticalCount === "number" &&
        remainingCriticalCount > 0 ? (
          <p className="rounded-full bg-[#e3f1f2] px-2.5 py-0.5 text-[11px] font-semibold text-[#0f5f59]">
            Yayına {remainingCriticalCount} soru
          </p>
        ) : (
          <p className="rounded-full bg-[#e7f5ee] px-2.5 py-0.5 text-[11px] font-semibold text-[#1e7f4f]">
            ✓ Yayına hazır
          </p>
        )}
      </div>
      <p className="mt-1 text-xs leading-5 text-[#0f1f1d]/45">
        Cevapladıkça teklifler isabetli gelir — istemediğini atlayabilirsin.
      </p>

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
                className={`min-h-9 max-w-[9.5rem] truncate rounded-full border px-3 text-[12px] font-medium transition-colors ${
                  selected
                    ? "border-transparent bg-[#0f766e] text-white shadow-[0_4px_14px_rgba(15,118,110,0.3)]"
                    : "border-[#0f1f1d]/10 bg-white text-[#0f1f1d]/55 hover:border-[#0f766e]/30 hover:text-[#0f1f1d]"
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
        className="mt-3 border-t border-[#0f1f1d]/6 pt-3.5"
        data-testid={`composer-question-${active.fieldKey}`}
        data-field-key={active.fieldKey}
        data-control-type={control?.controlType ?? "text_fallback"}
      >
        <p
          className="text-[15px] font-semibold leading-6 tracking-[-0.01em] text-[#0f1f1d]"
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
