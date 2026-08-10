import type { ProductCondition } from "./types";

const REFURB_PATTERNS =
  /\b(refurb\w*|renewed|reconditioned|yenilenm\w*|certified refurbished)\b/i;
const USED_PATTERNS =
  /\b(used|preowned|pre-owned|ikinci el|2\. el|2 el|a kalite|second hand)\b/i;
const NEW_PATTERNS = /\b(yeni|brand new|factory new|sıfır|sifir)\b/i;

export function normalizeCondition(raw: string | null | undefined): ProductCondition {
  if (!raw?.trim()) return "UNKNOWN";
  const t = raw.toLocaleLowerCase("tr-TR");
  if (REFURB_PATTERNS.test(t)) return "REFURBISHED";
  if (USED_PATTERNS.test(t)) return "USED";
  if (NEW_PATTERNS.test(t)) return "NEW";
  return "UNKNOWN";
}

export function inferConditionFromText(text: string): ProductCondition {
  const t = text.toLocaleLowerCase("tr-TR");
  if (REFURB_PATTERNS.test(t)) return "REFURBISHED";
  if (USED_PATTERNS.test(t)) return "USED";
  if (NEW_PATTERNS.test(t)) return "NEW";
  return "UNKNOWN";
}

export function conditionCompatible(
  requested: ProductCondition,
  external: ProductCondition,
): boolean {
  if (requested === "UNKNOWN" || external === "UNKNOWN") return true;
  return requested === external;
}
