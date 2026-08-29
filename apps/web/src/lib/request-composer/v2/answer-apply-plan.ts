/**
 * CEVAP UYGULAMA PLANI — TEK KARAR YERİ, SIFIR REACT.
 *
 * `/talep` ekranında bir soruya verilen cevabın nereye yazılacağına bugüne
 * kadar `TalepOlusturForm` içindeki `applyBrainQuestion` closure'ı karar
 * veriyordu. Karar oradayken iki şey imkânsızdı: React olmadan ölçmek ve
 * ikinci bir görünümün (Maira) aynı yolu kullandığını kanıtlamak.
 *
 * Bu modül o kararı — ve YALNIZ kararı — taşır. Hiçbir setter, hook ya da
 * bileşen bilmez; bir ETKİ PLANI döndürür. Planı uygulamak çağıranın işidir,
 * böylece kanonik yazma yolları (`applyQuickOption`, ortak alan taslağı,
 * dinamik alan taslağı) tek sahibinde kalır ve ikinci bir cevap deposu
 * doğmaz.
 *
 * Maira ile standart görünüm aynı planı üretip aynı şekilde uygular; iki
 * yüzeyin ayrışması bu yüzden yapısal olarak mümkün değildir.
 */
import type { FieldValueKind } from "@/lib/request-composer/types";
import type { CanonicalFieldState } from "@/lib/request-composer/types";
import { softStatusFromAnswerValue } from "./question-scheduler";
import {
  composerFieldDisplayValue,
  composerFieldLabel,
} from "./display-format";
import { listAllProfiles } from "./question-profiles";

/** Ortak alan taslağının kabul ettiği anahtarlar. */
export type PlanCommonFieldKey =
  | "title"
  | "quantity"
  | "city"
  | "delivery"
  | "budget";

export type AnswerEffect =
  /** Kanonik duruma yaz — `hybrid.applyQuickOption` ile birebir aynı imza. */
  | {
      kind: "canonical";
      fieldKey: string;
      value: string;
      isAny: boolean;
      valueKind?: FieldValueKind;
    }
  /** Ortak alan taslağı (yayın kapılarının okuduğu dize). */
  | { kind: "common"; fieldKey: PlanCommonFieldKey; value: string }
  /** Dinamik / profil alanı taslağı. */
  | { kind: "dynamic"; fieldKey: string; value: string }
  /** Serbest metne ekleme — yalnız `needDescription` için. */
  | { kind: "appendText"; value: string }
  /**
   * Şehir filtresi: emlak ayrıştırması ve il/ilçe kuralları sayfanın kendi
   * otoritesindedir; plan yalnız "bu değerle şehir filtresini uygula" der.
   */
  | { kind: "cityFilter"; value: string };

export type AnswerApplyPlan = {
  /** Normalleştirilmiş alan anahtarı (`deliveryDays` → `delivery`). */
  fieldKey: string;
  effects: AnswerEffect[];
  /** Etki üretilmediyse nedeni — çağıran defterleri buna göre günceller. */
  noop: null | "optional_skip" | "empty_value";
};

const EMPTY = (fieldKey: string, noop: AnswerApplyPlan["noop"]): AnswerApplyPlan => ({
  fieldKey,
  effects: [],
  noop,
});

/* ------------------------------------------------------------------ *
 * Saf biçimlendiriciler. `applyBrainQuestion` içinden buraya TAŞINDI;
 * kopyalanmadı — çağıran tarafta ikinci bir sürümü yoktur.
 * ------------------------------------------------------------------ */
export function formatBudgetDigits(raw: string): string {
  const [wholeRaw, decimal] = raw.replace(/\s/g, "").split(",");
  const whole = wholeRaw.replace(/\./g, "").replace(/\D/g, "");
  if (!whole) return raw;
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decimal != null ? `${grouped},${decimal.replace(/\D/g, "")}` : grouped;
}

export function formatBudgetAnswer(value: string): string {
  if (!/^\s*(?:₺\s*)?\d[\d.\s]*(?:,\d{1,2})?\s*(?:tl|₺)?\s*$/iu.test(value)) {
    return value.trim();
  }
  const amount = value.replace(/₺|tl/giu, "").trim();
  return `${formatBudgetDigits(amount)} TL`;
}

export function formatQuantityAnswer(value: string): string {
  if (!/^\s*\d[\d.\s]*(?:\s*adet)?\s*$/iu.test(value)) return value.trim();
  const amount = value.replace(/adet/giu, "").trim();
  return `${formatBudgetDigits(amount)} adet`;
}

const COMMON_KEYS = new Set<string>([
  "title",
  "quantity",
  "city",
  "delivery",
  "budget",
]);

function isCommon(key: string): key is PlanCommonFieldKey {
  return COMMON_KEYS.has(key);
}

/**
 * Bir soruya verilen ham cevabı, uygulanacak etkilere çevirir.
 *
 * `currentText` yalnız `needDescription` için gerekir (serbest metne ekleme).
 * Verilmezse o dal yeni metni tek başına döndürür.
 */
export function planAnswerApplication(input: {
  fieldKey: string;
  rawValue: string;
  currentText?: string;
}): AnswerApplyPlan {
  const field =
    input.fieldKey === "deliveryDays" ? "delivery" : input.fieldKey;
  const rawValue = input.rawValue ?? "";
  const soft = softStatusFromAnswerValue(rawValue);

  if (soft === "skip_optional" || rawValue.trim() === "skip") {
    return EMPTY(field, "optional_skip");
  }

  let typed =
    field === "budget"
      ? formatBudgetAnswer(rawValue)
      : field === "quantity"
        ? formatQuantityAnswer(rawValue)
        : rawValue.trim();
  if (!typed) return EMPTY(field, "empty_value");

  if (soft === "open_to_offers" && field === "budget") {
    typed = "Teklifleri görmek istiyorum";
    return {
      fieldKey: field,
      noop: null,
      effects: [
        { kind: "canonical", fieldKey: field, value: typed, isAny: false },
        { kind: "common", fieldKey: "budget", value: typed },
      ],
    };
  }

  /* Konum kaçışları — kanonik etiket saklanır, ilçe UYDURULMAZ. */
  const locationFold = rawValue.trim().toLocaleLowerCase("tr-TR");
  if (field === "city") {
    if (
      locationFold === "nationwide" ||
      locationFold === "türkiye geneli" ||
      locationFold === "turkiye geneli"
    ) {
      return {
        fieldKey: field,
        noop: null,
        effects: [{ kind: "common", fieldKey: "city", value: "Türkiye geneli" }],
      };
    }
    if (locationFold === "remote" || locationFold === "uzaktan") {
      return {
        fieldKey: field,
        noop: null,
        effects: [
          { kind: "common", fieldKey: "city", value: "Uzaktan" },
          { kind: "dynamic", fieldKey: "locationMode", value: "remote" },
        ],
      };
    }
    if (
      locationFold === "no_location_preference" ||
      locationFold === "konum fark etmez"
    ) {
      return {
        fieldKey: field,
        noop: null,
        effects: [
          { kind: "common", fieldKey: "city", value: "Konum fark etmez" },
        ],
      };
    }
  }

  /**
   * "HENÜZ BİLMİYORUM" — kanonik mod taşınır, etiket taşınmaz (D3f Dilim 1).
   * Ortak alan taslağının metni AYNEN korunur: yayın kapıları o dizeyi okur.
   */
  if (soft === "unknown") {
    const label = "Henüz bilmiyorum";
    const effects: AnswerEffect[] = [
      {
        kind: "canonical",
        fieldKey: field,
        value: label,
        isAny: false,
        valueKind: "UNKNOWN",
      },
    ];
    if (field === "budget" || field === "quantity" || field === "delivery") {
      effects.push({ kind: "common", fieldKey: field, value: label });
    } else if (field === "city") {
      effects.push({ kind: "common", fieldKey: "city", value: label });
    } else {
      effects.push({ kind: "dynamic", fieldKey: field, value: label });
    }
    return { fieldKey: field, noop: null, effects };
  }

  /**
   * "FARK ETMEZ" VE "ESNEK" DEĞER DEĞİLDİR (B2, 2026-08-27).
   * İkisi de aynı kanonik anlamı taşır: bağlayıcı tercih YOK → `kind: "ANY"`.
   * Görünen etiket yalnız arayüz sunumudur ve taslak metninde kalır.
   */
  if (soft === "no_preference" || soft === "flexible") {
    const label = soft === "flexible" ? "Esnek" : "Fark etmez";
    const effects: AnswerEffect[] = [
      {
        kind: "canonical",
        fieldKey: field,
        value: label,
        isAny: true,
        valueKind: "ANY",
      },
    ];
    if (field === "delivery") {
      effects.push({ kind: "common", fieldKey: "delivery", value: label });
    } else if (field === "city") {
      effects.push({
        kind: "common",
        fieldKey: "city",
        value: "Konum fark etmez",
      });
    } else if (field === "quantity" || field === "budget" || field === "title") {
      effects.push({ kind: "common", fieldKey: field, value: label });
    } else {
      effects.push({ kind: "dynamic", fieldKey: field, value: label });
    }
    return { fieldKey: field, noop: null, effects };
  }

  if (field === "locationMode") {
    return {
      fieldKey: field,
      noop: null,
      effects: [
        { kind: "dynamic", fieldKey: "locationMode", value: typed },
        { kind: "canonical", fieldKey: "locationMode", value: typed, isAny: false },
      ],
    };
  }

  if (field === "needDescription") {
    const current = (input.currentText ?? "").trim();
    return {
      fieldKey: field,
      noop: null,
      effects: [
        { kind: "appendText", value: current ? `${current} ${typed}` : typed },
      ],
    };
  }

  /* Kanonik indirgeyici — tarama / hızlı seçim ile AYNI yol. */
  const canonicalValue =
    field === "delivery" && /^\d+$/.test(typed) ? `${typed} gün` : typed;
  const effects: AnswerEffect[] = [
    { kind: "canonical", fieldKey: field, value: canonicalValue, isAny: false },
  ];

  if (field === "delivery") {
    effects.push({ kind: "common", fieldKey: "delivery", value: canonicalValue });
  } else if (field === "city") {
    effects.push({ kind: "cityFilter", value: typed });
  } else if (isCommon(field)) {
    effects.push({ kind: "common", fieldKey: field, value: typed });
  } else {
    effects.push({ kind: "dynamic", fieldKey: field, value: typed });
  }

  return { fieldKey: field, noop: null, effects };
}

/* ================================================================== *
 * "YANITLARIM" PROJEKSİYONU — İKİNCİ DEPO DEĞİL, TÜRETİM.
 *
 * Kullanıcının verdiği cevaplar iki kapta yaşıyor: kanonik alan torbası
 * (`hybrid.state.fields`) ve ortak alan taslağı (`commonDraft`). Bu iki kap
 * KÖR biçimde birleştirilmez — aynı alan iki tarafta da varsa TEK satır
 * üretilir ve öncelik açıktır: KANONİK KAZANIR. Taslak farklı bir şey
 * söylüyorsa bu sessizce gizlenmez; satır `conflict` taşır.
 *
 * Yalnız kullanıcı kaynaklı cevaplar listelenir: çıkarım (`INFERRED`) cevap
 * değildir (KB-17). Değer taşımayan bilinçli cevaplar (`ANY` / `UNKNOWN` /
 * `NOT_APPLICABLE`) cevaptır ve listeden düşmez.
 * ================================================================== */
export type UserAnswerRow = {
  fieldKey: string;
  /** Kullanıcıya gösterilen ad — iç anahtar asla ekrana çıkmaz. */
  label: string;
  displayValue: string;
  mode: FieldValueKind;
  /** Satırın hangi kaptan geldiği; taslakta kalanlar kanoniğe taşınmalıdır. */
  source: "canonical" | "draft";
  /** Kanonik ile taslak çelişiyorsa gizlenmez, taşınır. */
  conflict?: { draftValue: string };
};

const NON_VALUE_LABEL: Partial<Record<FieldValueKind, string>> = {
  ANY: "Fark etmez",
  UNKNOWN: "Henüz bilmiyorum",
  NOT_APPLICABLE: "Uygulanamaz",
};

/**
 * KULLANICIYA GÖSTERİLEN AD — İÇ ANAHTAR ASLA EKRANA ÇIKMAZ.
 *
 * `composerFieldLabel` tanımadığı anahtarı AYNEN geri verir; tarayıcı
 * turunda (2026-08-30) `fridgeType` bu yüzden ham anahtar olarak görünüyordu.
 * İkinci bir etiket tablosu kurulmaz: soru profilinin kendi `summaryLabel`
 * kaydı okunur. O da yoksa satır gösterilmez — uydurma ad üretilmez.
 */
function humanLabel(fieldKey: string): string | null {
  const known = composerFieldLabel(fieldKey);
  if (known && known !== fieldKey) return known;
  /**
   * Etiket ürün/kategori kapsamından bağımsızdır: `fridgeType` her koşulda
   * "Buzdolabı tipi"dir. Bu yüzden kapsam süzgeci UYGULANMAZ, kayıt alan
   * anahtarıyla okunur — aksi hâlde ürün tipi çözülmemişken satır adsız kalıp
   * düşüyordu (ölçüldü 2026-08-30).
   */
  const summary = listAllProfiles()
    .find((d) => d.fieldKey === fieldKey)
    ?.summaryLabel?.trim();
  return summary ? summary : null;
}

function isUserProvenance(p: string | null | undefined): boolean {
  return p === "EXPLICIT_TEXT" || p === "EXPLICIT_BROWSE";
}

export function projectUserAnswers(input: {
  fields: Record<string, CanonicalFieldState>;
  commonDraft: Record<string, string>;
  touchedCommonKeys: string[];
  categoryId: string | null;
  rawInput?: string | null;
  /**
   * Kullanıcının METNİNDE açıkça beyan ettiği, henüz kanonik alan
   * üretmeyen ortak bilgiler (ör. konum). Bunlar cevaptır ve listeden
   * düşmemelidir; çıkarım buraya konmaz.
   */
  explicitCommon?: Record<string, string>;
}): UserAnswerRow[] {
  const rows: UserAnswerRow[] = [];
  const seen = new Set<string>();
  /** Aynı ad + aynı değer ikinci kez satır üretmez. */
  const shown = new Set<string>();
  const draft = input.commonDraft ?? {};
  const touched = new Set(input.touchedCommonKeys ?? []);

  for (const [fieldKey, field] of Object.entries(input.fields ?? {})) {
    if (!field) continue;
    if (fieldKey === "title") continue;
    const mode = field.kind;
    let displayValue = "";
    if (mode === "VALUE") {
      if (!isUserProvenance(field.provenance)) continue;
      const raw = String(field.value ?? "").trim();
      if (!raw) continue;
      displayValue = composerFieldDisplayValue({
        key: fieldKey,
        value: raw,
        categoryId: input.categoryId,
        rawInput: input.rawInput ?? null,
      });
    } else {
      if (!isUserProvenance(field.provenance)) continue;
      displayValue = NON_VALUE_LABEL[mode] ?? "";
      if (!displayValue) continue;
    }

    const draftValue = String(draft[fieldKey] ?? "").trim();
    const conflict =
      touched.has(fieldKey) && draftValue && draftValue !== displayValue
        ? { draftValue }
        : undefined;

    const label = humanLabel(fieldKey);
    if (!label) continue;
    const pair = `${label}=${displayValue}`;
    if (shown.has(pair)) {
      seen.add(fieldKey);
      continue;
    }
    shown.add(pair);
    rows.push({
      fieldKey,
      label,
      displayValue,
      mode,
      source: "canonical",
      ...(conflict ? { conflict } : {}),
    });
    seen.add(fieldKey);
  }

  /* Metinde açıkça beyan edilmiş, kanonik alanı henüz olmayan ortak bilgiler. */
  for (const [fieldKey, value] of Object.entries(input.explicitCommon ?? {})) {
    if (seen.has(fieldKey) || !String(value ?? "").trim()) continue;
    const label = humanLabel(fieldKey);
    if (!label) continue;
    const displayValue = composerFieldDisplayValue({
      key: fieldKey,
      value: String(value).trim(),
      categoryId: input.categoryId,
      rawInput: input.rawInput ?? null,
    });
    const pair = `${label}=${displayValue}`;
    if (shown.has(pair)) { seen.add(fieldKey); continue; }
    shown.add(pair);
    rows.push({ fieldKey, label, displayValue, mode: "VALUE", source: "draft" });
    seen.add(fieldKey);
  }

  /* Yalnız taslakta duran, kullanıcının DOKUNDUĞU ortak alanlar. */
  for (const fieldKey of touched) {
    if (seen.has(fieldKey) || fieldKey === "title") continue;
    const value = String(draft[fieldKey] ?? "").trim();
    if (!value) continue;
    const label = humanLabel(fieldKey);
    if (!label) continue;
    const displayValue = composerFieldDisplayValue({
      key: fieldKey,
      value,
      categoryId: input.categoryId,
      rawInput: input.rawInput ?? null,
    });
    const pair = `${label}=${displayValue}`;
    if (shown.has(pair)) { seen.add(fieldKey); continue; }
    shown.add(pair);
    rows.push({ fieldKey, label, displayValue, mode: "VALUE", source: "draft" });
    seen.add(fieldKey);
  }

  return rows;
}
