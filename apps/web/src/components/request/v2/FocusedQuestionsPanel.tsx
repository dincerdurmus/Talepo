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

/**
 * ÖNERİ ROZETİ — TEK GÖRÜNÜM (D2 blokeri B4/B2, 2026-08-26).
 *
 * Öneri hiçbir kontrol tipinde "seçilmiş cevap" görünümü almaz; kendi
 * rozetiyle, seçim dilinin dışında durur. `id` verilmesinin nedeni
 * erişilebilirlik: kontrolün kendisi `aria-describedby` ile bu açıklamaya
 * bağlanır, böylece doğrudan düğmeye atlayan klavye kullanıcısı da "bu bir
 * öneri, henüz kaydedilmedi" bilgisini duyar.
 */
function SuggestionBadge(props: {
  id: string;
  fieldKey: string;
  value?: string;
  label?: string;
}) {
  const label = (props.label ?? "").trim();
  if (!label) return null;
  return (
    <div
      id={props.id}
      className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-teal-900/20 bg-[#f7faf9] px-3 py-2"
      data-testid={`suggestion-badge-${props.fieldKey}`}
      data-suggested-value={props.value}
      data-suggested-label={label}
    >
      <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-[#0f766e] ring-1 ring-[#0f766e]/25">
        Talepo önerisi
      </span>
      <span className="text-sm font-medium text-[#0f1f1d]">{label}</span>
      <span className="w-full text-xs leading-5 text-[#0f1f1d]/55">
        Henüz kaydetmedik — doğruysa aşağıdan seçin, değilse başka bir seçenek
        işaretleyin.
      </span>
    </div>
  );
}

function OptionChip(props: {
  label: string;
  selected?: boolean;
  onClick: () => void;
  soft?: boolean;
  describedBy?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={props.selected ?? false}
      aria-describedby={props.describedBy}
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

/**
 * YARIM KALAN GİRDİ SORU DEĞİŞİMİNDE KAYBOLMAZ (D2 blokeri B3, 2026-08-26).
 *
 * Kontroller her soru değişiminde `key={active.fieldKey}` ile yeniden kurulur
 * — bu, eski sorunun state'inin yeni soruya sızmasını engelleyen korumadır ve
 * kaldırılmaz. Bedeli, bileşen içi `useState`'in remount'ta sıfırlanmasıydı:
 * kullanıcı bütçenin yarısını yazıp başka soruya geçince yazdığı kayboluyordu.
 *
 * Çözüm state'i bileşenden ÇIKARMAK: taslak, fieldKey'e bağlı olarak EBEVEYN
 * tarafında (`draftByKey`) tutulur. Böylece hem sızıntı korunur hem de geri
 * dönen kullanıcı yazdığını bulur.
 */
type LocationDraft = {
  ils: string[];
  all: boolean;
  ilce: string;
  filter: string;
};

const EMPTY_LOCATION_DRAFT: LocationDraft = {
  ils: [],
  all: false,
  ilce: "__all__",
  filter: "",
};

function parseLocationDraft(raw: string): LocationDraft {
  if (!raw?.trim()) return EMPTY_LOCATION_DRAFT;
  try {
    const parsed = JSON.parse(raw) as Partial<LocationDraft>;
    return {
      ils: Array.isArray(parsed.ils) ? parsed.ils.map(String) : [],
      all: Boolean(parsed.all),
      ilce: typeof parsed.ilce === "string" ? parsed.ilce : "__all__",
      filter: typeof parsed.filter === "string" ? parsed.filter : "",
    };
  } catch {
    // Taslak bozuksa kullanıcı yazısı kaybolmasın diye filtreye düşürülür.
    return { ...EMPTY_LOCATION_DRAFT, filter: raw };
  }
}

function LocationPickerControl(props: {
  control: QuestionControlDef;
  onAnswer: (value: string) => void;
  isRealEstate?: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  suggestionId?: string;
}) {
  // Kurucu kararı (2026-08-23): il çoklu seçmeli kutucuk; "Tümü" hem il hem
  // ilçe düzeyinde vardır. "Türkiye geneli" / "Konum fark etmez" çipleri yok.
  const parsed = parseLocationDraft(props.draft);
  const { onDraftChange } = props;
  const patchDraft = (patch: Partial<LocationDraft>) => {
    onDraftChange(JSON.stringify({ ...parsed, ...patch }));
  };
  const selectedIls = parsed.ils;
  const allTurkey = parsed.all;
  const ilce = parsed.ilce;
  const filter = parsed.filter;
  const setIlce = (value: string) => patchDraft({ ilce: value });
  const setFilter = (value: string) => patchDraft({ filter: value });

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
  // Taslak her render'da çözüldüğü için manuel memo korunamıyor; arama zaten
  // hazır bir haritadan okunuyor, doğrudan çağrılır.
  const districts = singleIl ? getDistrictsForProvince(singleIl) : [];

  const toggleIl = (name: string) => {
    // Taslak tek yazımla güncellenir: üç ayrı setter aynı anlık görüntüyü
    // okuduğu için yalnız sonuncusu kalırdı.
    patchDraft({
      all: false,
      ilce: "__all__",
      ils: selectedIls.includes(name)
        ? selectedIls.filter((n) => n !== name)
        : [...selectedIls, name],
    });
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
    <div className="mt-3 space-y-3" data-testid="control-location-picker" aria-describedby={props.suggestionId}>
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
          İl (birden fazla seçebilirsiniz)
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
              onChange={() =>
                patchDraft({ all: !allTurkey, ils: [], ilce: "__all__" })
              }
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
  draft: string;
  onDraftChange: (value: string) => void;
  suggestionId?: string;
}) {
  // Kurucu kararı (2026-08-23): tek bütçe alanı, tıklamadan açık gelir;
  // tek alternatif "Teklifleri görmek istiyorum".
  // Yarım kalan tutar ebeveyn taslağında durur (B3) — remount silmez.
  const amount = props.draft ?? "";
  const setAmount = props.onDraftChange;
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
          aria-describedby={props.suggestionId}
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

/**
 * ÖNERİ, SEÇİM GİBİ GÖRÜNEMEZ (KB-17 / D2 blokeri B2).
 *
 * İlk sürümde öneri, eşleşen seçeneği `OptionChip.selected` ile işaretliyordu.
 * O yol `aria-pressed="true"`, ✓ ikonu ve dolu zemin üretir — üçü de "bu cevap
 * KAYDEDİLDİ" der. Oysa hiçbir şey kaydedilmemiştir: ekran okuyucu kullanıcıya
 * olmayan bir onayı bildirir, gören kullanıcı da soruyu cevaplanmış sanıp
 * geçebilir. Öneri artık kendi rozetiyle, seçim dilinin DIŞINDA gösterilir;
 * seçili görünüm yalnız gerçek bir dokunuştan sonra oluşur.
 */
function ChoiceControl(props: {
  control: QuestionControlDef;
  fieldKey: string;
  draft: string;
  onDraftChange: (v: string) => void;
  onAnswer: (value: string) => void;
  baseId: string;
  suggestedValue?: string;
  suggestedLabel?: string;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const primary = props.control.options;
  const soft = props.control.softOptions;
  // Kullanıcıya ETİKET gösterilir; slug ("vehicle") asla ekrana çıkmaz.
  const suggestionLabel = (props.suggestedLabel ?? "").trim();
  // Seçenek düğmeleri öneri açıklamasına bağlanır (erişilebilirlik).
  const suggestionId = `${props.baseId}-suggestion`;
  const describedBy = suggestionLabel ? suggestionId : undefined;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mt-3 space-y-3" data-testid={`control-${props.control.controlType}`}>
      <SuggestionBadge
        id={suggestionId}
        fieldKey={props.fieldKey}
        value={props.suggestedValue}
        label={suggestionLabel}
      />
      {primary.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {primary.map((opt) => (
            <OptionChip
              key={opt.value}
              label={opt.label}
              describedBy={describedBy}
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
          className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0f766e]/80"
        >
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
        Cevapladıkça teklifler isabetli gelir. İstemediğini atlayabilirsin.
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

        {/*
          KONTROL BİLEŞENLERİ SORU BAŞINA YENİDEN KURULUR (D2 blokeri B4).
          `key` olmadan React aynı ağaç konumundaki aynı bileşeni yeniden
          kullanır: bir soruda açılan "özel değer" / tarih paneli ya da yarım
          kalan konum seçimi bir SONRAKİ soruya taşınır ve kullanıcı yanlış
          alana cevap verebilir. `key={active.fieldKey}` her soru değişiminde
          tam remount yaptırır ve iç state'i sıfırlar.
        */}
        {control?.controlType === "location_picker" ? (
          <>
            <SuggestionBadge
              id={`${baseId}-suggestion`}
              fieldKey={active.fieldKey}
              value={active.suggestedValue}
              label={active.suggestedLabel}
            />
            <LocationPickerControl
              key={active.fieldKey}
              control={control}
              isRealEstate={active.categoryId === "real-estate"}
              onAnswer={commit}
              draft={draftByKey[active.fieldKey] ?? ""}
              onDraftChange={(v) => onDraftChange(active.fieldKey, v)}
              suggestionId={
                active.suggestedLabel ? `${baseId}-suggestion` : undefined
              }
            />
          </>
        ) : control?.controlType === "money_range" ? (
          <>
            <SuggestionBadge
              id={`${baseId}-suggestion`}
              fieldKey={active.fieldKey}
              value={active.suggestedValue}
              label={active.suggestedLabel}
            />
            <MoneyRangeControl
              key={active.fieldKey}
              control={control}
              onAnswer={commit}
              draft={draftByKey[active.fieldKey] ?? ""}
              onDraftChange={(v) => onDraftChange(active.fieldKey, v)}
              suggestionId={
                active.suggestedLabel ? `${baseId}-suggestion` : undefined
              }
            />
          </>
        ) : control ? (
          <ChoiceControl
            key={active.fieldKey}
            control={control}
            fieldKey={active.fieldKey}
            draft={draftByKey[active.fieldKey] ?? ""}
            onDraftChange={(v) => onDraftChange(active.fieldKey, v)}
            onAnswer={commit}
            baseId={baseId}
            suggestedValue={active.suggestedValue}
            suggestedLabel={active.suggestedLabel}
          />
        ) : (
          <ChoiceControl
            key={active.fieldKey}
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
            suggestedValue={active.suggestedValue}
            suggestedLabel={active.suggestedLabel}
          />
        )}
      </div>
    </section>
  );
}
