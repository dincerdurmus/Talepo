/**
 * Thin attribute helpers for hybrid state — not a second intent/category brain.
 * Fills screenSize / resolution / productType cues from raw text when present.
 */

import { findTechnologyProduct } from "@/lib/ai/parser/brand-catalog";
import { isConversationStopword } from "@/lib/ai/parser/negation";
import { hasFurnitureObjectNoun } from "@/lib/ai/parser/category";
import {
  looksLikeTelevisionScreenContext,
  typicalTelevisionSizeInText,
} from "@/lib/request-understanding/number-role";
import { resolveTaxonomyAlias, ensureTaxonomyLoaded } from "@/lib/taxonomy";

const PRODUCT_HINTS: Array<{
  keys: RegExp;
  productType: string;
  taxonomyQuery: string;
  categoryId?: string;
}> = [
  {
    keys: /\b(televizyon|televizyona|televizyonu|\btv\b)\b/i,
    productType: "televizyon",
    taxonomyQuery: "televizyon",
  },
  {
    keys: /\b(dizüstü|dizustu|laptop|notebook)\b/i,
    productType: "dizüstü bilgisayar",
    taxonomyQuery: "dizüstü bilgisayar",
  },
  {
    keys: /\b(masaüstü|masaustu)\s*(bilgisayar|pc)?\b|\bdesktop\b/i,
    productType: "masaüstü bilgisayar",
    taxonomyQuery: "masaüstü bilgisayar",
  },
  {
    keys: /\b(cep\s*telefonu|akıllı\s*telefon|akilli\s*telefon|smartphone|iphone)\b/i,
    productType: "cep telefonu",
    taxonomyQuery: "cep telefonu",
  },
  {
    keys: /\b(tablet|ipad)\b/i,
    productType: "tablet",
    taxonomyQuery: "tablet",
  },
  {
    // Avoid \\b — TR letters like ş break ASCII word boundaries
    keys: /şaraplık/i,
    productType: "şaraplık",
    taxonomyQuery: "şaraplık",
    categoryId: "furniture",
  },
  {
    keys: /koltuk\s*takımı|köşe\s*koltuk/i,
    productType: "koltuk takımı",
    taxonomyQuery: "koltuk takımı",
  },
  {
    keys: /\b(süpürge|supurge|vacuum)\b/i,
    productType: "supurge",
    taxonomyQuery: "Elektrikli Süpürge",
  },
  {
    keys: /buzdolabı|buzdolabi/i,
    productType: "Buzdolabı",
    taxonomyQuery: "Buzdolabı",
  },
  {
    keys: /çamaşır\s*makinesi|camasir\s*makinesi/i,
    productType: "Çamaşır Makinesi",
    taxonomyQuery: "Çamaşır Makinesi",
  },
  {
    keys: /bulaşık\s*makinesi|bulasik\s*makinesi/i,
    productType: "Bulaşık Makinesi",
    taxonomyQuery: "Bulaşık Makinesi",
  },
  {
    keys: /mikrodalga/i,
    productType: "Mikrodalga Fırın",
    taxonomyQuery: "Mikrodalga Fırın",
  },
  {
    keys: /şarap\s*dolabı|sarap\s*dolabi/i,
    productType: "Şarap Dolabı",
    taxonomyQuery: "Şarap Dolabı",
  },
  {
    keys: /\bklima\b/i,
    productType: "Klima",
    taxonomyQuery: "Klima",
  },
  {
    keys: /airfryer|fritöz|fritoz/i,
    productType: "Fritöz & Airfryer",
    taxonomyQuery: "Fritöz & Airfryer",
  },
];

export function extractScreenSize(raw: string): string | null {
  const m = raw.match(
    /\b(\d{2,3})\s*(?:["”']|inç|inc|inch|ekran(?:lı|li)?)\b/i,
  );
  if (m?.[1]) return m[1];
  // "105 ekran" / "140'lık ekran"
  const m2 = raw.match(/\b(\d{2,3})\s*['’]?l[ıi]k\s*ekran\b/i);
  if (m2?.[1]) return m2[1];
  if (looksLikeTelevisionScreenContext(raw)) {
    return typicalTelevisionSizeInText(raw);
  }
  return null;
}

export function extractResolution(raw: string): string | null {
  const fold = raw.toLocaleLowerCase("tr-TR");
  if (/\b8k\b/.test(fold)) return "8K";
  if (/\b4k\b/.test(fold) || /\buhd\b/.test(fold)) return "4K";
  if (/\bfull\s*hd\b/.test(fold) || /\bfhd\b/.test(fold)) return "Full HD";
  if (/\bhd\b/.test(fold)) return "HD";
  return null;
}

function taxonomyHintFromKnownTechProduct(raw: string): {
  productType: string;
  taxonomyNodeId: string | null;
} | null {
  const tech = findTechnologyProduct(raw);
  if (!tech) return null;
  const f = tech.canonical.toLocaleLowerCase("tr-TR");
  let taxonomyQuery: string | null = null;
  let productType: string | null = null;
  if (f.includes("macbook")) {
    taxonomyQuery = "dizüstü bilgisayar";
    productType = "dizüstü bilgisayar";
  } else if (f.includes("ipad")) {
    taxonomyQuery = "tablet";
    productType = "tablet";
  } else if (f.includes("airpods")) {
    taxonomyQuery = "Kulaklık / TWS";
    productType = "kulaklık";
  } else if (
    f.includes("iphone") ||
    f.includes("galaxy") ||
    f.includes("pixel") ||
    f.includes("redmi") ||
    f.includes("poco") ||
    f.startsWith("xiaomi") ||
    f.includes("huawei") ||
    f.includes("honor")
  ) {
    taxonomyQuery = "cep telefonu";
    productType = "cep telefonu";
  }
  if (!taxonomyQuery || !productType) return null;
  const hit = resolveTaxonomyAlias(taxonomyQuery, "technology");
  return {
    productType,
    taxonomyNodeId: hit && !hit.ambiguous ? hit.node.id : null,
  };
}

export function extractProductTypeHint(raw: string): {
  productType: string;
  taxonomyNodeId: string | null;
} | null {
  ensureTaxonomyLoaded();
  for (const hint of PRODUCT_HINTS) {
    if (!hint.keys.test(raw)) continue;
    const hit = resolveTaxonomyAlias(hint.taxonomyQuery, hint.categoryId);
    const taxonomyNodeId =
      hit && !hit.ambiguous ? hit.node.id : null;
    return { productType: hint.productType, taxonomyNodeId };
  }

  if (looksLikeTelevisionScreenContext(raw)) {
    const hit = resolveTaxonomyAlias("televizyon");
    return {
      productType: "televizyon",
      taxonomyNodeId: hit && !hit.ambiguous ? hit.node.id : null,
    };
  }

  // Known device identity (catalog) → hardware leaf. Not example-specific:
  // "samsung s24" has no "telefon" token, but findTechnologyProduct already
  // resolved Galaxy S24. TV-size context above wins for "samsung 55".
  const fromKnownDevice = taxonomyHintFromKnownTechProduct(raw);
  if (fromKnownDevice) return fromKnownDevice;

  // Free-text product leaves: longer phrases beat single tokens
  // (so "ofis koltuğu" is furniture, not a bare "ofis" real-estate leaf).
  const stop = /^(arıyorum|ariyorum|istiyorum|almak|satın|bir|ve|için|lütfen)$/i;
  const tokens = raw
    .split(/[\s,.;:!?]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !stop.test(t));

  const LOCATION_USE_CONTEXT = new Set([
    "ofis",
    "ev",
    "daire",
    "salon",
    "mutfak",
    "konut",
  ]);

  const tryAlias = (phrase: string) => {
    const hit = resolveTaxonomyAlias(phrase);
    if (
      hit &&
      !hit.ambiguous &&
      (hit.node.nodeType === "PRODUCT_TYPE" ||
        hit.node.nodeType === "SERVICE_TYPE" ||
        hit.node.nodeType === "COMMODITY_TYPE" ||
        hit.node.nodeType === "PART_TYPE")
    ) {
      if (
        LOCATION_USE_CONTEXT.has(phrase.toLocaleLowerCase("tr-TR")) &&
        hasFurnitureObjectNoun(raw)
      ) {
        return null;
      }
      return {
        productType: hit.node.canonicalName,
        taxonomyNodeId: hit.node.id,
      };
    }
    return null;
  };

  for (let n = Math.min(3, tokens.length); n >= 1; n--) {
    for (let i = 0; i + n <= tokens.length; i++) {
      const phrase = tokens.slice(i, i + n).join(" ");
      if (n === 1 && phrase.length < 4) continue;
      const hit = tryAlias(phrase);
      if (hit) return hit;
    }
  }
  return null;
}

/** Strip trailing "marka" from identity tokens like "Arçelik marka". */
export function cleanBrandToken(brand: string | null | undefined): string | null {
  if (!brand?.trim()) return null;
  let b = brand.trim();
  b = b.replace(/\s+marka\b/gi, "").trim();
  // Reject tokens that are clearly product types / categories, not brands
  const fold = b.toLocaleLowerCase("tr-TR");
  if (
    fold === "televizyon" ||
    fold === "tv" ||
    fold === "süpürge" ||
    fold === "supurge" ||
    fold === "emlak" ||
    fold === "gayrimenkul" ||
    fold === "konut" ||
    fold === "ev" ||
    fold === "mobilya" ||
    fold === "ev mobilyası" ||
    fold === "ev mobilyasi" ||
    fold === "ofis mobilyaları" ||
    fold === "ofis mobilyalari" ||
    fold === "web sitesi" ||
    fold === "websitesi" ||
    fold === "yazılım" ||
    fold === "yazilim" ||
    fold === "donanım" ||
    fold === "donanim" ||
    fold === "teknoloji" ||
    fold === "e-ticaret sitesi" ||
    fold === "eticaret sitesi" ||
    fold === "hosting" ||
    fold === "landing page" ||
    fold.includes("hizmet") ||
    fold === "yedek" ||
    fold === "yedek parça" ||
    fold === "yedek parca" ||
    fold === "parça" ||
    fold === "parca" ||
    fold === "otomotiv" ||
    fold === "araç" ||
    fold === "arac" ||
    fold === "ürün" ||
    fold === "urun"
  ) {
    return null;
  }
  return b || null;
}

export function isGenericCompatibilityNoun(
  value: string | null | undefined,
): boolean {
  const fold = value?.trim().toLocaleLowerCase("tr-TR") ?? "";
  return (
    fold === "yedek" ||
    fold === "yedek parça" ||
    fold === "yedek parca" ||
    fold === "parça" ||
    fold === "parca" ||
    fold === "otomotiv" ||
    fold === "araç" ||
    fold === "arac"
  );
}

/**
 * Remove already-expressed request clauses from a parent identity token.
 * "çamaşır makinesi için pompa arıyorum" + part=pompa → "çamaşır makinesi"
 */
export function stripRequestedItemClause(
  identity: string | null | undefined,
  requestedItem?: string | null,
): string | null {
  if (!identity?.trim()) return null;
  let s = identity.trim();
  s = s.replace(/\s*(arıyorum|ariyorum|istiyorum)\s*[.!?]*$/i, "").trim();
  if (requestedItem?.trim()) {
    const item = requestedItem
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    s = s
      .replace(new RegExp(`\\s*için\\s+${item}$`, "i"), "")
      .trim();
  }
  return s || null;
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
  if (isConversationStopword(m)) return null;
  const fold = m.toLocaleLowerCase("tr-TR");
  if (
    fold.includes("istiyorum") ||
    fold.includes("arıyorum") ||
    fold.includes("ariyorum") ||
    fold.includes("almak")
  ) {
    const stripped = stripRequestedItemClause(m);
    if (!stripped || stripped.toLocaleLowerCase("tr-TR") === fold) return null;
    return stripped;
  }
  if (/\biçin\b/i.test(m)) {
    const stripped = stripRequestedItemClause(m);
    if (stripped && stripped.length < m.length) return stripped;
  }
  return m;
}
