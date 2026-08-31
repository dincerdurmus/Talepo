/**
 * Generic model / product text normalization.
 * No brand-specific rules — handles joined alphanumeric tokens.
 */

function baseNormalize(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeModelText(value: string): string {
  const trimmed = value.trim();
  const isCompactModelCode =
    /^[A-Za-z0-9-]{10,}$/.test(trimmed) &&
    !/\s/.test(trimmed) &&
    /\d/.test(trimmed) &&
    /[A-Za-z]/.test(trimmed);

  if (isCompactModelCode) {
    return trimmed
      .toLocaleLowerCase("tr-TR")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  }

  const raw = trimmed
    .replace(/([a-z]{2,})([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z]{2,})(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2");

  let s = baseNormalize(raw);

  // Joined qualifier tokens (ProMax, ProPlus) — generic product language, not brand-specific
  s = s
    .replace(/\bpromax\b/g, "pro max")
    .replace(/\bproplus\b/g, "pro plus")
    .replace(/\bultrawide\b/g, "ultra wide");

  // Letter+digit boundaries within tokens (iphone15 → iphone 15) — skip long SKU-like codes
  s = s.replace(/\b([a-z]{1,6})(\d+)\b/g, (_, letters: string, digits: string) => {
    if (letters.length === 1) return `${letters}${digits}`;
    if (letters.length >= 4 && digits.length >= 3) return `${letters}${digits}`;
    return `${letters} ${digits}`;
  });

  // Digit+letter word starts (15pro → 15 pro)
  s = s.replace(/\b(\d+)([a-z]{2,})\b/g, "$1 $2");

  s = s.replace(/\b(seri|serisi|serie)\b/g, "series");

  return s.replace(/\s+/g, " ").trim();
}

export function modelTokens(value: string): string[] {
  return normalizeModelText(value)
    .split(" ")
    .filter((t) => t.length >= 1);
}

/** Tokens after the last numeric cluster — variant qualifiers (pro, max, detect, hybrid, dream…) */
export function trailingModelQualifiers(model: string): string[] {
  const parts = modelTokens(model);
  if (parts.length === 0) return [];

  let lastNumIdx = -1;
  for (let i = 0; i < parts.length; i++) {
    if (/^\d/.test(parts[i]!)) lastNumIdx = i;
  }

  if (lastNumIdx === -1) return parts.slice(1);
  return parts.slice(lastNumIdx + 1).filter((t) => t.length >= 2);
}

export function tokenOverlapRatio(a: string, b: string): number {
  const ta = new Set(modelTokens(a));
  const tb = new Set(modelTokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) {
    if (tb.has(t)) shared++;
  }
  return shared / Math.max(ta.size, tb.size);
}

export function modelSubstringMatch(requestModel: string, title: string): boolean {
  const rm = normalizeModelText(requestModel);
  const tt = normalizeModelText(title);
  if (!rm || !tt) return false;
  return tt.includes(rm);
}

export function qualifiersSatisfied(requestModel: string, title: string): boolean {
  const qualifiers = trailingModelQualifiers(requestModel);
  if (qualifiers.length === 0) return true;
  const tt = normalizeModelText(title);
  return qualifiers.every((q) => tt.includes(q));
}
