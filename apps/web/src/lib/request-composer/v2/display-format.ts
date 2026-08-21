/**
 * Composer-facing display helpers on top of field-display authority.
 */

import {
  formatScreenSizeDisplay,
  resolveFieldOptionLabel,
} from "@/lib/field-display";
import { fieldLabel } from "@/lib/request-composer/ui-helpers";

const PRODUCT_KEYS = new Set([
  "productType",
  "applianceType",
  "furnitureType",
  "propertyType",
]);

/** Preference-style fields where “Fark etmez” is meaningful. */
export const DONT_CARE_FIELD_KEYS = new Set([
  "brand",
  "model",
  "condition",
  "color",
  "budget",
  "fuel",
  "transmission",
  "bodyType",
  "material",
  "printType",
  "resolution",
]);

export function composerFieldLabel(key: string, isPartNeed = false): string {
  if (key === "screenSize") return "Ekran boyutu";
  if (key === "needType") return "Talep türü";
  if (isPartNeed && key === "brand") return "Uyumlu marka";
  if (isPartNeed && key === "model") return "Uyumlu model";
  if (isPartNeed && key === "condition") return "Parça durumu";
  return fieldLabel(key);
}

export function composerFieldDisplayValue(input: {
  key: string;
  value: string;
  categoryId?: string | null;
  rawInput?: string | null;
}): string {
  const raw = input.value.trim();
  if (!raw) return raw;
  if (/^fark\s*etmez$/i.test(raw) || raw === "Farketmez") return "Fark etmez";

  if (input.key === "screenSize") {
    return formatScreenSizeDisplay(raw, input.rawInput);
  }

  const resolved = resolveFieldOptionLabel({
    value: raw,
    fieldKey: input.key,
    categoryId: input.categoryId,
  });

  // Title-case common product nouns shown as lowercase extracts.
  if (PRODUCT_KEYS.has(input.key) || input.key === "needType") {
    return titleCaseTr(resolved);
  }
  return resolved;
}

function titleCaseTr(value: string): string {
  const t = value.trim();
  if (!t) return t;
  // Keep multi-word engine labels as-is when already mixed / sentence case.
  if (t !== t.toLocaleLowerCase("tr-TR")) return t;
  return t.charAt(0).toLocaleUpperCase("tr-TR") + t.slice(1);
}

/**
 * Drop redundant needType when a concrete product/appliance type is already shown.
 */
export function shouldHideNeedTypeFact(keys: string[]): boolean {
  return keys.some((k) => PRODUCT_KEYS.has(k));
}

/** Uncertain only when tone asks for check and value is not already a clear product noun. */
export function isActionableUncertainty(input: {
  key: string;
  tone: "understood" | "check" | "unsure";
  displayValue: string;
}): boolean {
  if (input.tone === "understood") return false;
  if (input.key === "needType") return false;
  return true;
}
