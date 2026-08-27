import { FieldType } from "@/generated/prisma/enums";
import type { CommonFieldKey } from "@/lib/request-category-engine";
import { isFieldValueKind, type FieldValueKind } from "@/lib/request-composer";

import type { CreateRequestInput, RequestFieldInput } from "./request-schema";

/** Parse a single Turkish money token → number (e.g. "40.000", "50 bin"). */
export function parseMoney(value?: string) {
  if (!value) return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  // "50 bin" / "2 milyon"
  const wordMatch = trimmed.match(
    /^([\d.,]+)\s*(bin|milyon|mln)?(?:\s*tl)?$/i,
  );
  if (wordMatch) {
    const base = Number(
      wordMatch[1]
        .replace(/\.(?=\d{3}(?:\D|$))/g, "")
        .replace(",", "."),
    );
    if (!Number.isFinite(base) || base < 0) return undefined;
    const mult = (wordMatch[2] || "").toLowerCase();
    const amount =
      mult === "bin" ? base * 1_000 : mult.startsWith("mil") ? base * 1_000_000 : base;
    return amount;
  }

  const normalized = trimmed
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");

  /**
   * RAKAM YOKSA PARA DA YOK (D3f Dilim 3a, 2026-08-28).
   *
   * Bu satır rakam-dışı her karakteri siliyordu; `"Teklifleri görmek
   * istiyorum"` boş dizeye iniyor, `Number("")` = `0` üretiyor ve `0 >= 0`
   * olduğu için GEÇERLİ bir bütçe sayılıyordu. Ölçüldü: kurucunun tek bütçe
   * kaçışı her yayında `budgetMin = budgetMax = 0` olarak kalıcılaşıyordu ve
   * bu kolonu `routing-envelope` okuyor.
   *
   * Kullanıcının yazdığı gerçek `"0"` bilinçli bir cevaptır ve düşmez; ayrım
   * "sonuç sıfır mı?" değil, "girdide rakam var mı?" sorusudur.
   */
  if (!/\d/.test(normalized)) return undefined;

  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? amount : undefined;
}

/** Parse budget field that may be a range: "10.000 – 50.000 TL", "10-50 bin". */
export function parseBudgetRange(value?: string): {
  min?: number;
  max?: number;
} {
  if (!value?.trim()) return {};

  const text = value.trim();

  const rangeMatch = text.match(
    /([\d.,]+)\s*(bin|milyon|mln)?\s*(?:–|-|—|ile|to|~)\s*([\d.,]+)\s*(bin|milyon|mln)?/i,
  );
  if (rangeMatch) {
    const leftUnit = (rangeMatch[2] || rangeMatch[4] || "").toLowerCase();
    const rightUnit = (rangeMatch[4] || rangeMatch[2] || "").toLowerCase();
    const min = parseMoney(
      `${rangeMatch[1]}${leftUnit ? ` ${leftUnit}` : ""}`,
    );
    const max = parseMoney(
      `${rangeMatch[3]}${rightUnit ? ` ${rightUnit}` : ""}`,
    );
    if (min != null && max != null) {
      return min <= max ? { min, max } : { min: max, max: min };
    }
    if (min != null) return { min, max: min };
    if (max != null) return { min: max, max };
  }

  const untilMatch = text.match(
    /(?:kadar|altı|altında|max|maks\.?)\s*([\d.,]+\s*(?:bin|milyon|mln)?)/i,
  );
  if (untilMatch) {
    const max = parseMoney(untilMatch[1]);
    if (max != null) return { min: undefined, max };
  }

  const fromMatch = text.match(
    /(?:üzeri|üstünde|min\.?|en az)\s*([\d.,]+\s*(?:bin|milyon|mln)?)/i,
  );
  if (fromMatch) {
    const min = parseMoney(fromMatch[1]);
    if (min != null) return { min, max: undefined };
  }

  const single = parseMoney(text);
  if (single != null) return { min: single, max: single };
  return {};
}

export function parseDeliveryDeadline(value?: string) {
  if (!value) return undefined;

  const match = value.match(/(\d{1,4})/);
  if (!match) return undefined;

  const days = Number(match[1]);
  if (!Number.isFinite(days) || days <= 0 || days > 3650) return undefined;

  const deadline = new Date();
  deadline.setDate(deadline.getDate() + days);
  return deadline;
}

/* ------------------------------------------------------------------ *
 * DEDICATED KOLON KARARI — STRUCTURED CEVAP OTORİTEDİR (D3f Dilim 3a)
 * ------------------------------------------------------------------ */

/**
 * ÜÇ AYRI SONUÇ, TEK SÖZLEŞME.
 *
 *   `undefined` → DOKUNMA. Kullanıcı bu alana cevap göndermedi; update'te
 *                 mevcut değer korunur (Prisma `undefined`'ı no-op sayar).
 *   `null`      → TEMİZLE. Kullanıcı bilinçli olarak değer taşımayan bir
 *                 cevap verdi; kolonda sahte bir değer duramaz.
 *   değer       → YAZ.
 */
type DedicatedDecision<T> = T | null | undefined;

/** Yazma yollarının ortak, Prisma'sız payload görünümü. */
export type DedicatedFieldInput = {
  budget?: string | null;
  city?: string | null;
  delivery?: string | null;
  fields?: ReadonlyArray<{ key?: unknown; mode?: unknown }> | null;
};

/**
 * Bir ortak alanın DOĞRULANMIŞ cevap modu (yoksa `undefined`).
 *
 * Karar YALNIZ structured `mode` alanından okunur. Kullanıcının ekranda
 * gördüğü metin ("Konum fark etmez", "Teklifleri görmek istiyorum") bir
 * sözleşme değildir ve burada hiç ayrıştırılmaz. Tanınmayan bir mod yok
 * sayılır: geçersiz mod bir kolonu temizleyemez.
 */
function answerModeFor(
  input: DedicatedFieldInput,
  key: CommonFieldKey,
): FieldValueKind | undefined {
  for (const field of input.fields ?? []) {
    if (field?.key !== key) continue;
    if (!isFieldValueKind(field.mode)) continue;
    return field.mode;
  }
  return undefined;
}

/** Payload'daki ham taslak metin — alan adı eşleşmesi tek yerde durur. */
const DEDICATED_RAW: Record<
  Extract<CommonFieldKey, "budget" | "city" | "delivery">,
  (input: DedicatedFieldInput) => string | null | undefined
> = {
  budget: (input) => input.budget,
  city: (input) => input.city,
  delivery: (input) => input.delivery,
};

/**
 * ORTAK ALAN KOLON KARARI — TEK ÇEKİRDEK.
 *
 * Alan adına özel bir politika dalı YOKTUR: üç alan da aynı sırayı izler ve
 * yalnız kendi ayrıştırıcılarıyla ayrışır. Ayrıştırıcı bir değer
 * üretemiyorsa kolona DOKUNULMAZ (mevcut davranış) — sahte tarih ya da sahte
 * tutar üretmek, hiç yazmamaktan daha pahalıdır.
 */
function resolveDedicated<T>(
  input: DedicatedFieldInput,
  key: Extract<CommonFieldKey, "budget" | "city" | "delivery">,
  parse: (raw: string) => T | undefined,
): DedicatedDecision<T> {
  const mode = answerModeFor(input, key);
  if (mode !== undefined && mode !== "VALUE") return null;

  const raw = DEDICATED_RAW[key](input);
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  return parse(raw) ?? undefined;
}

/** Bütçe kolonlarının kararı (`budgetMin` / `budgetMax`). */
export function resolveDedicatedBudget(input: DedicatedFieldInput): {
  min: DedicatedDecision<number>;
  max: DedicatedDecision<number>;
} {
  const range = resolveDedicated(input, "budget", (raw) => {
    const parsed = parseBudgetRange(raw);
    if (parsed.min === undefined && parsed.max === undefined) return undefined;
    return parsed;
  });
  if (range === null) return { min: null, max: null };
  if (range === undefined) return { min: undefined, max: undefined };
  return { min: range.min, max: range.max };
}

/** Şehir kolonunun kararı. */
export function resolveDedicatedCity(
  input: DedicatedFieldInput,
): DedicatedDecision<string> {
  return resolveDedicated(input, "city", (raw) => raw);
}

/** Teslim tarihi kolonunun kararı. */
export function resolveDedicatedDeadline(
  input: DedicatedFieldInput,
): DedicatedDecision<Date> {
  return resolveDedicated(input, "delivery", (raw) =>
    parseDeliveryDeadline(raw),
  );
}

export function mapFieldType(field: RequestFieldInput) {
  if (field.type === "number") return FieldType.DECIMAL;
  if (field.type === "select") return FieldType.SINGLE_SELECT;
  return FieldType.SHORT_TEXT;
}

export function mapFieldValue(field: RequestFieldInput) {
  /**
   * DEĞER TAŞIMAYAN CEVAP DA BİR CEVAPTIR (D3f Dilim 3b, 2026-08-28).
   *
   * Burası yalnız `field.value` doluysa satır üretiyordu. Dilim 1'den beri
   * bilinçli "Bilmiyorum" / "Uygulanamaz" cevabı DEĞER TAŞIMADAN gelir
   * (`value: ""` + kanonik `mode`), bu yüzden kullanıcının cevabı yayın anında
   * doğru ölçülüp veritabanında KAYBOLUYORDU. `ANY` ise yalnız görünür
   * etiketiyle ("Fark etmez") `textValue` olarak yaşıyordu — kaçındığımız
   * etiket-değer kanalının ta kendisi.
   *
   * Mevcut `jsonValue Json?` kolonu kullanılır; MIGRATION GEREKMEZ. Ölçüldü:
   * bu kolonu bugün hiçbir yazma yolu doldurmuyor, dolayısıyla `{ mode }`
   * biçimi hiçbir sözleşmeyle çakışmaz. `mode` kanonik `FieldValueKind`tir —
   * yeni bir enum tanımlanmaz ve tanınmayan bir mod cevap sayılmaz.
   *
   * GÖRÜNÜR ETİKET SAKLANMAZ: mod değer taşımıyorsa `textValue` bilinçli
   * olarak `null` yazılır. `VALUE` için gereksiz `{mode:"VALUE"}` yazılmaz;
   * mevcut sözleşme yeterlidir ve eski istemcilerin davranışı birebir kalır.
   */
  const mode = isFieldValueKind(field.mode) ? field.mode : undefined;
  if (mode !== undefined && mode !== "VALUE") {
    return { textValue: null, jsonValue: { mode } };
  }

  if (!field.value) return null;

  if (field.type === "number") {
    const numberValue = Number(field.value.replace(",", "."));
    if (Number.isFinite(numberValue)) {
      return { numberValue };
    }
  }

  return { textValue: field.value };
}

/**
 * KALICI CEVAP MODUNU OKUYAN TEK YARDIMCI (D3f Dilim 3b).
 *
 * `jsonValue` güvenilmez bir JSON kolonudur: eski kayıtta alan hiç yoktur,
 * bozuk kayıtta dizi, metin ya da tanınmayan bir mod olabilir. Hiçbiri THROW
 * ETMEZ ve hiçbiri güvenilir cevap SAYILMAZ. Değer taşıyan `VALUE` modu da
 * bu kanaldan okunmaz — onun kendi kolonları vardır.
 */
export function persistedAnswerModeOf(
  jsonValue: unknown,
): Exclude<FieldValueKind, "VALUE"> | null {
  if (!jsonValue || typeof jsonValue !== "object" || Array.isArray(jsonValue)) {
    return null;
  }
  const mode = (jsonValue as { mode?: unknown }).mode;
  if (!isFieldValueKind(mode) || mode === "VALUE") return null;
  return mode;
}

export function buildAiSummary(input: CreateRequestInput) {
  if (input.aiSummary) return input.aiSummary;

  const filledFields = input.fields.filter((field) => field.value).length;
  const totalFields = input.fields.length;

  return [
    `Kategori: ${input.category.name}`,
    `Doldurulan teknik alan: ${filledFields}/${totalFields}`,
    input.quantity ? `Miktar: ${input.quantity}` : null,
    input.city ? `Şehir: ${input.city}` : null,
    input.delivery ? `Teslim: ${input.delivery}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
