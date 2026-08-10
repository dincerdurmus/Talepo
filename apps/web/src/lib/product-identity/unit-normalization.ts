export type StorageUnit = "gb" | "tb";

export type NormalizedCapacity =
  | { kind: "storage"; valueGb: number; raw: string }
  | { kind: "weight"; valueKg: number; raw: string }
  | { kind: "dimension"; raw: string }
  | { kind: "unknown"; raw: string };

/** 256GB / 256 GB / 256gb → { valueGb: 256, token: "256gb" } */
export function normalizeStorageValue(input: string): { token: string; valueGb: number } | null {
  const compact = input.toLocaleLowerCase("tr-TR").replace(/\s+/g, "");
  const match = compact.match(/^(\d+(?:\.\d+)?)(gb|tb)$/);
  if (!match) return null;
  const num = Number.parseFloat(match[1]!);
  const unit = match[2] as StorageUnit;
  const valueGb = unit === "tb" ? num * 1024 : num;
  const token = `${Math.round(num)}${unit}`;
  return { token, valueGb };
}

export function extractStorageFromText(text: string): string | null {
  const match = text.match(/\b(\d+(?:\.\d+)?)\s*(gb|tb)\b/i);
  if (!match) return null;
  return normalizeStorageValue(`${match[1]}${match[2]}`)?.token ?? null;
}

/** 9kg / 9 kg → weight */
export function normalizeWeightValue(input: string): { token: string; valueKg: number } | null {
  const match = input.toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").match(/(\d+(?:\.\d+)?)\s*kg/);
  if (!match) return null;
  const valueKg = Number.parseFloat(match[1]!);
  return { token: `${valueKg}kg`, valueKg };
}

export function extractWeightFromText(text: string): string | null {
  return normalizeWeightValue(text)?.token ?? null;
}

/** 160x80 / 160 x 80 cm */
export function normalizeDimensionValue(input: string): string | null {
  const match = input.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
  if (!match) return null;
  return `${match[1]}x${match[2]}`;
}

export function storageValuesEquivalent(a: string, b: string): boolean {
  const na = normalizeStorageValue(a);
  const nb = normalizeStorageValue(b);
  if (!na || !nb) return false;
  return na.token === nb.token;
}

export function stripTrailingCapacitySuffix(text: string): string {
  return text.replace(/\s+\d+(?:\.\d+)?\s*(gb|tb|kg|ml|l|lt|litre|liter)\b.*$/i, "").trim();
}
