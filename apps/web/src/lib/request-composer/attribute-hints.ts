/**
 * Thin attribute helpers for hybrid state — not a second intent/category brain.
 * Fills screenSize / resolution / productType cues from raw text when present.
 */

import { resolveTaxonomyAlias, ensureTaxonomyLoaded } from "@/lib/taxonomy";

const PRODUCT_HINTS: Array<{ keys: RegExp; productType: string; taxonomyQuery: string }> = [
  {
    keys: /\b(televizyon|televizyona|televizyonu|\btv\b)\b/i,
    productType: "televizyon",
    taxonomyQuery: "televizyon",
  },
  {
    keys: /\b(süpürge|supurge|vacuum)\b/i,
    productType: "supurge",
    taxonomyQuery: "süpürge",
  },
];

export function extractScreenSize(raw: string): string | null {
  const m = raw.match(
    /\b(\d{2,3})\s*(?:["”']|inç|inc|inch|ekran(?:lı|li)?)\b/i,
  );
  if (m?.[1]) return m[1];
  // "105 ekran" / "140'lık ekran"
  const m2 = raw.match(/\b(\d{2,3})\s*['’]?l[ıi]k\s*ekran\b/i);
  return m2?.[1] ?? null;
}

export function extractResolution(raw: string): string | null {
  const fold = raw.toLocaleLowerCase("tr-TR");
  if (/\b8k\b/.test(fold)) return "8K";
  if (/\b4k\b/.test(fold) || /\buhd\b/.test(fold)) return "4K";
  if (/\bfull\s*hd\b/.test(fold) || /\bfhd\b/.test(fold)) return "Full HD";
  if (/\bhd\b/.test(fold)) return "HD";
  return null;
}

export function extractProductTypeHint(raw: string): {
  productType: string;
  taxonomyNodeId: string | null;
} | null {
  ensureTaxonomyLoaded();
  for (const hint of PRODUCT_HINTS) {
    if (!hint.keys.test(raw)) continue;
    const hit = resolveTaxonomyAlias(hint.taxonomyQuery);
    const taxonomyNodeId =
      hit && !hit.ambiguous ? hit.node.id : null;
    return { productType: hint.productType, taxonomyNodeId };
  }
  return null;
}

/** Strip trailing "marka" from identity tokens like "Arçelik marka". */
export function cleanBrandToken(brand: string | null | undefined): string | null {
  if (!brand?.trim()) return null;
  let b = brand.trim();
  b = b.replace(/\s+marka\b/gi, "").trim();
  // Reject tokens that are clearly product types, not brands
  const fold = b.toLocaleLowerCase("tr-TR");
  if (
    fold === "televizyon" ||
    fold === "tv" ||
    fold === "süpürge" ||
    fold === "supurge"
  ) {
    return null;
  }
  return b || null;
}

/** Reject year-like or bare screen-size numbers as model. */
export function cleanModelToken(
  model: string | null | undefined,
  opts?: { screenSize?: string | null },
): string | null {
  if (!model?.trim()) return null;
  const m = model.trim();
  if (/^(19|20)\d{2}$/.test(m)) return null;
  if (opts?.screenSize && m === opts.screenSize) return null;
  if (/^\d{2,3}$/.test(m) && Number(m) >= 32 && Number(m) <= 120) return null;
  const fold = m.toLocaleLowerCase("tr-TR");
  if (
    fold.includes("istiyorum") ||
    fold.includes("arıyorum") ||
    fold.includes("ariyorum") ||
    fold.includes("almak")
  ) {
    return null;
  }
  return m;
}
