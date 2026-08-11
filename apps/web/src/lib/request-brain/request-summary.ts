import type { DynamicField } from "@/lib/request-category-engine";
import type { PriceStrategyKey } from "@/lib/price-intelligence/price-strategy-registry";
import { getStrategyAttributeProfile } from "@/lib/price-intelligence/price-strategy-registry";

export type SummaryChip = {
  fieldKey: string;
  label: string;
  displayValue: string;
};

const FIELD_LABELS: Record<string, string> = {
  brand: "Marka",
  model: "Model",
  modelYear: "Model yılı",
  generation: "Nesil",
  engine: "Motor",
  mileage: "Kilometre",
  condition: "Durum",
  specs: "Özellikler",
  solutionType: "Ürün",
  productName: "Ürün",
  quantity: "Miktar",
  dimensions: "Ölçü",
  material: "Malzeme",
  printType: "Baskı",
  serviceType: "Hizmet",
  scope: "Kapsam",
  listingType: "İlan türü",
  propertyType: "Konut tipi",
  roomCount: "Oda",
  area: "m²",
  city: "Konum",
  needType: "Tür",
  part: "Parça",
  fuel: "Yakıt",
  transmission: "Vites",
};

function resolveLabel(fieldKey: string, dynamicFields: DynamicField[]): string {
  return dynamicFields.find((f) => f.key === fieldKey)?.label ?? FIELD_LABELS[fieldKey] ?? fieldKey;
}

function formatChipValue(fieldKey: string, raw: string): string {
  const v = raw.trim();
  if (!v) return v;
  if (fieldKey === "modelYear" && /^\d{4}$/.test(v)) return `${v} ve üzeri`;
  if (fieldKey === "mileage" && /^\d/.test(v)) {
    const n = v.replace(/\D/g, "");
    if (n) return `${Number(n).toLocaleString("tr-TR")} km altı`;
  }
  if (fieldKey === "needType") {
    const map: Record<string, string> = {
      vehicle: "Araç",
      part: "Parça",
      tire: "Lastik",
      service: "Servis",
      hardware: "Donanım",
      software: "Yazılım",
      machine: "Makine",
    };
    return map[v.toLowerCase()] ?? v;
  }
  return v;
}

/** Build positive request summary from understood fields — not a form grid */
export function buildRequestSummary(input: {
  title: string;
  strategy: PriceStrategyKey | null;
  fieldValues: Record<string, string>;
  city: string;
  quantity: string;
  dynamicFields: DynamicField[];
}): { headline: string; chips: SummaryChip[] } {
  const profile = input.strategy
    ? getStrategyAttributeProfile(input.strategy)
    : null;

  const priorityKeys = profile
    ? [...profile.required, ...profile.important].filter((k) => !k.includes("-like"))
    : Object.keys(input.fieldValues);

  const seen = new Set<string>();
  const chips: SummaryChip[] = [];

  const addChip = (fieldKey: string, raw: string) => {
    if (!raw.trim() || seen.has(fieldKey)) return;
    if (fieldKey === "budget" || fieldKey === "delivery") return;
    seen.add(fieldKey);
    chips.push({
      fieldKey,
      label: resolveLabel(fieldKey, input.dynamicFields),
      displayValue: formatChipValue(fieldKey, raw),
    });
  };

  for (const key of priorityKeys) {
    addChip(key, input.fieldValues[key] ?? "");
  }

  for (const [key, value] of Object.entries(input.fieldValues)) {
    addChip(key, value);
  }

  if (input.city.trim()) addChip("city", input.city);
  if (input.quantity.trim()) addChip("quantity", input.quantity);

  return {
    headline: input.title.trim() || "Talebiniz",
    chips: chips.slice(0, 8),
  };
}
