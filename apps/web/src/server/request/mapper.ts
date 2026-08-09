import { FieldType } from "@/generated/prisma/enums";

import type { CreateRequestInput, RequestFieldInput } from "./request-schema";

export function parseMoney(value?: string) {
  if (!value) return undefined;

  const normalized = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");

  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? amount : undefined;
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
