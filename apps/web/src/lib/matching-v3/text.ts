/** Shared TR-aware text folding for matching-v3 (no invented semantics). */

export function foldText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(value: string | null | undefined): string[] {
  const folded = foldText(value);
  if (!folded) return [];
  return folded
    .split(/[\s,./\-_+:;|()[\]{}]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

export function includesToken(haystack: string, needle: string): boolean {
  const h = foldText(haystack);
  const n = foldText(needle);
  if (!h || !n) return false;
  if (h.includes(n)) return true;
  const tokens = new Set(tokenize(h));
  return tokenize(n).every((t) => tokens.has(t) || h.includes(t));
}

/** Stricter product/phrase overlap — short generic tokens alone do not match. */
const GENERIC_PRODUCT_STEMS = new Set([
  "pompa",
  "pompası",
  "pompasi",
  "makine",
  "ürün",
  "urun",
  "parça",
  "parca",
  "cihaz",
  "sistem",
  "servis",
  "hizmet",
]);

export function productsCompatible(
  requestProduct: string | null | undefined,
  supplierProduct: string | null | undefined,
): boolean {
  const req = foldText(requestProduct);
  const sup = foldText(supplierProduct);
  if (!req || !sup) return false;
  if (req === sup) return true;
  if (req.includes(sup) && sup.length >= 6 && !GENERIC_PRODUCT_STEMS.has(sup)) return true;
  if (sup.includes(req) && req.length >= 6 && !GENERIC_PRODUCT_STEMS.has(req)) return true;

  const reqTokens = tokenize(req).filter((t) => t.length >= 3 && !GENERIC_PRODUCT_STEMS.has(t));
  const supTokens = new Set(
    tokenize(sup).filter((t) => t.length >= 3 && !GENERIC_PRODUCT_STEMS.has(t)),
  );
  if (reqTokens.length === 0 || supTokens.size === 0) return false;

  const overlap = reqTokens.filter((t) => {
    if (supTokens.has(t)) return true;
    for (const s of supTokens) {
      if ((s.includes(t) || t.includes(s)) && Math.min(s.length, t.length) >= 6) {
        return true;
      }
    }
    return false;
  });

  if (overlap.length >= 2) return true;
  if (overlap.length === 1 && overlap[0]!.length >= 6) return true;
  return false;
}

export function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = foldText(v);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}
