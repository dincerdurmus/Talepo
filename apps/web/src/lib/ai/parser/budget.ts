import { formatTrNumber, parseTrNumber } from "@/lib/format/tr-number";

export type DetectedBudget = {
  /** Canonical amount for scoring / offer helpers (range → max). */
  amount: number;
  min?: number;
  max?: number;
  /** Form / AI panel display, e.g. "50.000 TL" or "10.000 – 50.000 TL". */
  display: string;
};

const QUANTITY_UNIT_RE =
  /^(?:adet|tane|kutu|masa|sandalye|parça|parca|kişi|kisi|paket|koli|metre|mt|m2|m²|cm|mm|kg|gr|gram|litre|lt|gün|gun|hafta|ay)\b/i;

const NON_MONEY_CONTEXT_RE =
  /^(?:model|yıl|yil|yaş|yas|kat|km)\b/i;

function normalizeMoneyMultiplier(
  raw: string | undefined,
): "bin" | "milyon" | undefined {
  if (!raw) return undefined;
  const key = raw.toLocaleLowerCase("tr-TR");
  if (key.startsWith("bin")) return "bin";
  if (key.startsWith("milyon")) return "milyon";
  return undefined;
}

function applyMoneyMultiplier(
  base: number,
  multiplier: string | undefined,
): number {
  const key = normalizeMoneyMultiplier(multiplier);
  if (key === "bin") return base * 1_000;
  if (key === "milyon") return base * 1_000_000;
  return base;
}

function parseMoneyToken(
  raw: string,
  multiplier?: string,
): number | undefined {
  const base = parseTrNumber(raw);
  if (!Number.isFinite(base) || base <= 0) return undefined;

  const amount = applyMoneyMultiplier(base, multiplier);
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  // Calendar years are not budgets.
  if (!multiplier && amount >= 1900 && amount <= 2100) return undefined;
  return Math.round(amount);
}

function looksLikeQuantityContext(after: string): boolean {
  const trimmed = after.trimStart();
  return QUANTITY_UNIT_RE.test(trimmed) || NON_MONEY_CONTEXT_RE.test(trimmed);
}

function formatBudgetDisplay(min: number, max?: number): string {
  if (max != null && max !== min) {
    return `${formatTrNumber(min)} – ${formatTrNumber(max)} TL`;
  }
  return `${formatTrNumber(min)} TL`;
}

function buildDetectedBudget(min: number, max?: number): DetectedBudget {
  const lo = max != null ? Math.min(min, max) : min;
  const hi = max != null ? Math.max(min, max) : min;
  return {
    amount: hi,
    min: max != null ? lo : undefined,
    max: max != null ? hi : undefined,
    display: formatBudgetDisplay(lo, max != null ? hi : undefined),
  };
}

type BudgetCandidate = {
  amount: number;
  min?: number;
  max?: number;
  score: number;
};

/**
 * Extract a stated budget/price from Turkish free text.
 * Prefers currency / "bin" / budget keywords; avoids bare quantity numbers.
 */
export function extractBudgetFromText(text: string): DetectedBudget | undefined {
  const source = text.replace(/\u00a0/g, " ");
  const candidates: BudgetCandidate[] = [];

  const afterOf = (match: RegExpMatchArray) =>
    source.slice((match.index ?? 0) + match[0].length);

  const pushSingle = (
    amount: number | undefined,
    score: number,
    after: string,
  ) => {
    if (amount == null || amount < 50) return;
    // Quantity units win over weak money guesses; currency/keyword hits stay.
    if (looksLikeQuantityContext(after) && score < 80) return;
    candidates.push({ amount, score });
  };

  const pushRange = (
    left: number | undefined,
    right: number | undefined,
    score: number,
    after: string,
  ) => {
    if (left == null || right == null) return;
    if (looksLikeQuantityContext(after) && score < 80) return;
    const lo = Math.min(left, right);
    const hi = Math.max(left, right);
    candidates.push({ amount: hi, min: lo, max: hi, score });
  };

  // Shared trailing multiplier: "10-50 bin", "20 – 40 bin TL"
  for (const match of source.matchAll(
    /(\d[\d.,]*)\s*(?:[-–—]|ile)\s*(\d[\d.,]*)\s*(bin|milyon)(?:e|a)?\s*(?:tl|₺|try|lira)?\b/gi,
  )) {
    pushRange(
      parseMoneyToken(match[1], match[3]),
      parseMoneyToken(match[2], match[3]),
      110,
      afterOf(match),
    );
  }

  // Per-side / plain ranges: "10.000 – 50.000 TL", "20 bin - 40 bin"
  for (const match of source.matchAll(
    /(\d[\d.,]*)\s*(bin|milyon)?(?:e|a)?\s*(?:tl|₺|try|lira)?\s*(?:[-–—]|ile)\s*(\d[\d.,]*)\s*(bin|milyon)?(?:e|a)?\s*(?:tl|₺|try|lira)?\b/gi,
  )) {
    const leftMult = match[2];
    const rightMult = match[4];
    // Already covered by shared-multiplier pattern above.
    if (!leftMult && rightMult) continue;
    pushRange(
      parseMoneyToken(match[1], leftMult),
      parseMoneyToken(match[3], rightMult),
      105,
      afterOf(match),
    );
  }

  // Amount + optional multiplier + currency
  for (const match of source.matchAll(
    /(\d[\d.,]*)\s*(bin|milyon)?(?:e|a)?\s*(tl|₺|try|lira)\b/gi,
  )) {
    pushSingle(parseMoneyToken(match[1], match[2]), 100, afterOf(match));
  }

  // Currency first: "₺50.000", "TL 40 bin"
  for (const match of source.matchAll(
    /(?:tl|₺|try|lira)\s*(\d[\d.,]*)\s*(bin|milyon)?(?:e|a)?\b/gi,
  )) {
    pushSingle(parseMoneyToken(match[1], match[2]), 95, afterOf(match));
  }

  // Budget / ceiling keywords
  for (const match of source.matchAll(
    /(?:bütçe(?:m|si)?|butce(?:m|si)?|fiyat(?:ı|i)?|bedel(?:i)?|ücret(?:i)?|ucret(?:i)?|tutar(?:ı|i)?|maliyet(?:i)?|max|maks|maksimum|en\s+fazla|en\s+çok|en\s+cok)\s*(?:olarak|yaklaşık|yaklasik|:)?\s*(\d[\d.,]*)\s*(bin|milyon)?(?:e|a)?\b/gi,
  )) {
    pushSingle(parseMoneyToken(match[1], match[2]), 90, afterOf(match));
  }

  // "40 bine kadar", "25.000'e kadar"
  for (const match of source.matchAll(
    /(\d[\d.,]*)\s*(bin|milyon)?(?:e|a|'e|'a|’e|’a)?\s*kadar\b/gi,
  )) {
    pushSingle(parseMoneyToken(match[1], match[2]), 88, afterOf(match));
  }

  // "50 bin" / "2 milyon" without TL
  for (const match of source.matchAll(
    /(\d[\d.,]*)\s*(bin|milyon)(?:e|a)?\b/gi,
  )) {
    pushSingle(parseMoneyToken(match[1], match[2]), 75, afterOf(match));
  }

  // Thousand-separated amounts without unit: "40.000", "1.250.000"
  for (const match of source.matchAll(/\b(\d{1,3}(?:\.\d{3})+)\b/g)) {
    pushSingle(parseMoneyToken(match[1]), 60, afterOf(match));
  }

  if (!candidates.length) return undefined;

  candidates.sort((a, b) => b.score - a.score || b.amount - a.amount);
  const best = candidates[0];
  return buildDetectedBudget(best.min ?? best.amount, best.max);
}

export function detectBudget(text: string): number | undefined {
  return extractBudgetFromText(text)?.amount;
}
