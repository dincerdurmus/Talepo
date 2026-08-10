import type { SemanticFieldClass } from "./types";

const KEY_PATTERNS: Array<{ pattern: RegExp; cls: SemanticFieldClass }> = [
  { pattern: /^(brand|brandPreference|marka)$/i, cls: "brand-like" },
  { pattern: /^(model|productName|modelName|modelNumber)$/i, cls: "model-like" },
  { pattern: /^(series|seri|line|productLine)$/i, cls: "series-like" },
  { pattern: /^(variant|trim|edition|version|color|colour|renk)$/i, cls: "variant-like" },
  { pattern: /^(sku|stockCode|partNumber|mpn|modelCode)$/i, cls: "sku-like" },
  { pattern: /^(gtin|ean|upc|barcode)$/i, cls: "gtin-like" },
  { pattern: /^(storage|specs|memory|ram|rom|disk|hdd|ssd)$/i, cls: "storage-like" },
  { pattern: /^(capacity|volume|weight|load|kg|litre|liter)$/i, cls: "capacity-like" },
  { pattern: /^(dimensions|size|area|roomCount|bedSize|paperWeight)$/i, cls: "size-like" },
  { pattern: /^(modelYear|year|yil|uretimYili|buildingAge)$/i, cls: "year-like" },
  { pattern: /^(condition|durum|kondisyon)$/i, cls: "condition-like" },
  { pattern: /^(partType|accessoryType|sparePart)$/i, cls: "part-type-like" },
  { pattern: /^(energyClass|energyRating)$/i, cls: "energy-like" },
  { pattern: /Type$/i, cls: "product-type-like" },
];

const LABEL_HINTS: Array<{ pattern: RegExp; cls: SemanticFieldClass }> = [
  { pattern: /marka|brand/i, cls: "brand-like" },
  { pattern: /model/i, cls: "model-like" },
  { pattern: /seri|series/i, cls: "series-like" },
  { pattern: /depolama|storage|hafıza|hafiza|gb|tb/i, cls: "storage-like" },
  { pattern: /kapasite|capacity|kg|litre/i, cls: "capacity-like" },
  { pattern: /yıl|year/i, cls: "year-like" },
  { pattern: /durum|condition/i, cls: "condition-like" },
  { pattern: /aksesuar|yedek parça|spare|part/i, cls: "part-type-like" },
];

const SKIP_PRODUCT_TYPE_KEYS = new Set([
  "needType",
  "listingType",
  "printType",
  "serviceType",
]);

export function classifyFieldKey(key: string, label?: string): SemanticFieldClass {
  for (const { pattern, cls } of KEY_PATTERNS) {
    if (pattern.test(key)) {
      if (cls === "product-type-like" && SKIP_PRODUCT_TYPE_KEYS.has(key)) continue;
      return cls;
    }
  }
  if (label) {
    for (const { pattern, cls } of LABEL_HINTS) {
      if (pattern.test(label)) return cls;
    }
  }
  return "other";
}

export function buildSemanticFieldMap(
  attributes: Record<string, string>,
  fieldLabels?: Record<string, string>,
): Record<string, SemanticFieldClass> {
  const map: Record<string, SemanticFieldClass> = {};
  for (const key of Object.keys(attributes)) {
    map[key] = classifyFieldKey(key, fieldLabels?.[key]);
  }
  return map;
}

export function pickFirstByClass(
  attributes: Record<string, string>,
  semanticFields: Record<string, SemanticFieldClass>,
  cls: SemanticFieldClass,
): string | null {
  for (const [key, value] of Object.entries(attributes)) {
    if (semanticFields[key] === cls && value?.trim()) return value.trim();
  }
  return null;
}
