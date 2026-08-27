import {
  formatNeighborhoodsLabel,
  parseNeighborhoods,
} from "@/lib/geo/neighborhoods";
import {
  REQUEST_CATEGORIES,
  getCategoryById,
  type DynamicFieldOption,
} from "@/lib/request-category-engine";
import type { FieldValueKind } from "@/lib/request-composer";
import { persistedAnswerModeOf } from "@/server/request/mapper";

/**
 * Fallback Turkish labels for stored English select enums (e.g. needType).
 * Prefer category / form field options when available — those are category-accurate.
 */
const FIELD_ENUM_LABELS: Record<string, string> = {
  vehicle: "Aracın kendisi (satın alma)",
  part: "Yedek parça",
  service: "Bakım / servis",
  tire: "Lastik / jant",
  machine: "Makine (satın alma)",
  software: "Yazılım",
  hardware: "Donanım",
  accessory: "Aksesuar / parça",
  television: "Televizyon",
  televizyon: "Televizyon",
  tv: "Televizyon",
  phone: "Telefon",
  telefon: "Telefon",
  laptop: "Dizüstü bilgisayar",
  tablet: "Tablet",
};

function asOptionList(options: unknown): DynamicFieldOption[] {
  if (!Array.isArray(options)) return [];
  return options.filter(
    (item): item is DynamicFieldOption =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as DynamicFieldOption).label === "string" &&
      typeof (item as DynamicFieldOption).value === "string",
  );
}

function labelFromOptions(
  value: string,
  options: DynamicFieldOption[],
): string | undefined {
  return options.find((option) => option.value === value)?.label;
}

/**
 * Map a stored select value (often an English enum) to its Turkish display label.
 */
export function resolveFieldOptionLabel(input: {
  value: string;
  fieldKey?: string;
  categoryId?: string | null;
  options?: unknown;
}): string {
  const value = input.value.trim();
  if (!value) return value;

  const fromStored = labelFromOptions(value, asOptionList(input.options));
  if (fromStored) return fromStored;

  if (input.categoryId && input.fieldKey) {
    const field = getCategoryById(input.categoryId)?.fields.find(
      (item) => item.key === input.fieldKey,
    );
    const fromCategory = labelFromOptions(value, field?.options ?? []);
    if (fromCategory) return fromCategory;
  }

  if (input.fieldKey) {
    for (const category of REQUEST_CATEGORIES) {
      if (input.categoryId && category.id !== input.categoryId) continue;
      const field = category.fields.find((item) => item.key === input.fieldKey);
      const fromEngine = labelFromOptions(value, field?.options ?? []);
      if (fromEngine) return fromEngine;
    }
  }

  return FIELD_ENUM_LABELS[value] || FIELD_ENUM_LABELS[value.toLocaleLowerCase("tr-TR")] || value;
}

/**
 * Screen-size display: keep the user's unit when present (inç vs ekran).
 * Stored value is typically a bare number from extraction.
 */
export function formatScreenSizeDisplay(
  sizeValue: string,
  rawInput?: string | null,
): string {
  const n = sizeValue.trim();
  if (!n) return n;
  if (/\s/.test(n) && /(?:inç|inc|inch|ekran)/i.test(n)) return n;

  const raw = (rawInput ?? "").toLocaleLowerCase("tr-TR");
  const sizeRe = new RegExp(
    `(?:^|[^0-9])${n}\\s*(?:["”']|inç|inc|inch|ekran(?:lı|li)?)`,
    "i",
  );
  const hit = raw.match(sizeRe);
  if (hit?.[0]) {
    if (/ekran/i.test(hit[0])) return `${n} ekran`;
    return `${n} inç`;
  }
  if (/\b(?:inç|inc|inch|["”'])\b/.test(raw) || /["”']/.test(raw)) {
    return `${n} inç`;
  }
  if (/\bekran\b/.test(raw)) return `${n} ekran`;
  // TV sizes without explicit unit still read naturally as inches in TR commerce.
  return `${n} inç`;
}

export function displayRequestFieldValue(value: {
  textValue: string | null;
  numberValue: unknown;
  booleanValue: boolean | null;
  dateValue: Date | null;
  jsonValue: unknown;
  field?: {
    key?: string;
    options?: unknown;
  };
  categoryId?: string | null;
}): string {
  if (value.textValue) {
    if (value.field?.key === "neighborhoods") {
      const mahalleler = parseNeighborhoods(value.textValue);
      return mahalleler.length
        ? formatNeighborhoodsLabel(mahalleler)
        : value.textValue;
    }
    return resolveFieldOptionLabel({
      value: value.textValue,
      fieldKey: value.field?.key,
      categoryId: value.categoryId,
      options: value.field?.options,
    });
  }
  if (value.numberValue !== null && value.numberValue !== undefined) {
    return String(value.numberValue);
  }
  if (value.booleanValue !== null && value.booleanValue !== undefined) {
    return value.booleanValue ? "Evet" : "Hayır";
  }
  if (value.dateValue) {
    return new Intl.DateTimeFormat("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(value.dateValue);
  }
  /**
   * KALICI CEVAP MODU İNSAN DİLİNDE GÖSTERİLİR (D3f Dilim 3b, 2026-08-28).
   *
   * Dilim 3b'den beri bilinçli "Bilmiyorum" / "Uygulanamaz" / "Fark etmez"
   * cevabı `jsonValue = { mode }` olarak kalıcılaşıyor. Bu satır ham JSON'u
   * ekrana basıyordu; kullanıcıya ve firmaya `{"mode":"UNKNOWN"}` göstermek
   * kabul edilemez. Etiket YALNIZ burada, gösterim sınırında üretilir — kayıt
   * tarafında hâlâ hiçbir yerelleştirilmiş metin saklanmaz.
   */
  const answerMode = persistedAnswerModeOf(value.jsonValue);
  if (answerMode) return ANSWER_MODE_LABEL[answerMode];
  /* Tanınmayan/bozuk JSON ham gösterilmez; ölçülemeyen kayıt boş kalır. */
  return "—";
}

/** Değer taşımayan cevabın kullanıcıya gösterilen karşılığı. */
const ANSWER_MODE_LABEL: Record<
  Exclude<FieldValueKind, "VALUE">,
  string
> = {
  UNKNOWN: "Bilmiyorum",
  NOT_APPLICABLE: "Uygulanamaz",
  ANY: "Fark etmez",
};
