import {
  formatNeighborhoodsLabel,
  parseNeighborhoods,
} from "@/lib/geo/neighborhoods";
import {
  REQUEST_CATEGORIES,
  getCategoryById,
  type DynamicFieldOption,
} from "@/lib/request-category-engine";

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
  software: "Yazılım / proje",
  hardware: "Donanım (satın alma)",
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

  return FIELD_ENUM_LABELS[value] || value;
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
  if (value.jsonValue) return JSON.stringify(value.jsonValue);
  return "—";
}
