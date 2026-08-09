import { FieldType } from "@/generated/prisma/enums";

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

export function mapFieldType(field: RequestFieldInput) {
  if (field.type === "number") return FieldType.DECIMAL;
  if (field.type === "select") return FieldType.SINGLE_SELECT;
  return FieldType.SHORT_TEXT;
}

export function mapFieldValue(field: RequestFieldInput) {
  if (!field.value) return null;

  if (field.type === "number") {
    const numberValue = Number(field.value.replace(",", "."));
    if (Number.isFinite(numberValue)) {
      return { numberValue };
    }
  }

  return { textValue: field.value };
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
