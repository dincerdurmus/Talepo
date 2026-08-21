import {
  isConversationStopword,
  stripConversationRemainder,
} from "@/lib/ai/parser/negation";
import { findBrand, TECHNOLOGY_BRANDS, AUTOMOTIVE_BRANDS, APPLIANCE_BRANDS, BABY_BRANDS, FURNITURE_BRANDS, HOME_KITCHEN_BRANDS, MACHINERY_BRANDS } from "@/lib/ai/parser/brand-catalog";

import { defaultBrandMemory } from "./brand-memory";
import { extractModelIdentityTokens } from "./model-identity-tokens";
import { stripTrailingCapacitySuffix } from "./unit-normalization";
import {
  findLongestProductPhrase,
  stripProductPhraseSpan,
  tokenOverlapsProductPhrase,
} from "@/lib/request-composer/v2/product-phrase-lexicon";

/** Generic product nouns — never treated as brand candidates */
const GENERIC_LEADING_NOUNS = new Set([
  "telefon", "phone", "smartphone", "mobile", "laptop", "notebook", "tablet",
  "computer", "bilgisayar", "makine", "machine", "device", "cihaz", "product",
  "urun", "ürün", "model", "type", "new", "yeni",
  "ofis", "ev", "daire", "konut", "salon", "mutfak",
  "bebek", "çocuk", "cocuk", "arabası", "arabasi", "puset",
  "çamaşır", "camasir", "bulaşık", "bulasik", "kahve",
  "koltuğu", "koltugu", "sandalye", "sandalyesi",
  "kartvizit", "broşür", "brosur", "logo", "tasarım", "tasarim",
  "matbaa", "baskı", "baski", "hizmet", "teknoloji", "otomotiv", "emlak",
]);

const QUALIFIER_TOKENS = new Set([
  "pro", "max", "plus", "mini", "ultra", "lite", "detect", "absolute", "slim",
  "hybrid", "dream", "premium", "standard", "cordless", "wireless",
]);

export type BrandExtractionResult = {
  brand: string | null;
  remainder: string;
  confidence: number;
  source: "structured" | "memory" | "catalog" | "inferred" | "none";
  productPhrase?: string | null;
};

/** Mixed-case brand token: DeWalt, LaCie, iRobot */
function isMixedCaseBrandToken(token: string): boolean {
  return /^[A-Z][a-z]*[A-Z][a-zA-Z0-9&.-]+$/.test(token);
}

/** Internal-capital brand starting lowercase: iRobot */
function isLeadingLowerBrandToken(token: string): boolean {
  return /^[a-z][A-Z][a-zA-Z0-9&.-]+$/.test(token);
}

/**
 * Title-case / proper-name brand shape.
 * Pure lowercase tokens (eufy-style) require catalog/memory — never inferred alone.
 */
function isTitleCaseBrandToken(token: string): boolean {
  return (
    /^[A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ0-9&.-]+$/.test(token) ||
    /^[A-Z0-9]{2,}$/.test(token) ||
    isMixedCaseBrandToken(token) ||
    isLeadingLowerBrandToken(token)
  );
}

function isQualifierToken(token: string): boolean {
  return QUALIFIER_TOKENS.has(token.toLocaleLowerCase("tr-TR"));
}

function isEmbeddedProductLineToken(token: string): boolean {
  return /^i[A-Z][a-zA-Z0-9+]+$/.test(token);
}

function isModelLikeToken(token: string): boolean {
  if (/^[A-Za-z]{1,3}\d+[A-Za-z0-9]*$/.test(token)) return true;
  if (extractModelIdentityTokens(token).some((t) => t.class !== "QUALIFIER")) {
    return true;
  }
  return false;
}

function isProductFamilyLineToken(token: string, nextToken?: string): boolean {
  if (!/^[A-Z][a-zA-Z0-9+]+$/.test(token)) return false;
  if (isModelLikeToken(token)) return false;
  if (!nextToken) return false;
  return isModelLikeToken(nextToken) || /^\d/.test(nextToken);
}

function isBrandCandidateToken(token: string): boolean {
  const trimmed = token.trim();
  if (/^\d+$/.test(trimmed)) return false;
  if (/^(19|20)\d{2}$/.test(trimmed)) return false;
  if (isConversationStopword(token)) return false;
  const lower = trimmed.toLocaleLowerCase("tr-TR");
  if (GENERIC_LEADING_NOUNS.has(lower)) return false;
  // Inferred path: require proper-name shape (not pure lowercase)
  return isTitleCaseBrandToken(trimmed);
}

function catalogBrandInText(text: string): string | null {
  return (
    findBrand(text, BABY_BRANDS) ??
    findBrand(text, APPLIANCE_BRANDS) ??
    findBrand(text, TECHNOLOGY_BRANDS) ??
    findBrand(text, AUTOMOTIVE_BRANDS) ??
    findBrand(text, MACHINERY_BRANDS) ??
    findBrand(text, FURNITURE_BRANDS) ??
    findBrand(text, HOME_KITCHEN_BRANDS) ??
    null
  );
}

function isNoiseModelToken(token: string): boolean {
  const fold = token.toLocaleLowerCase("tr-TR").replace(/[’']/g, "");
  if (!fold) return true;
  if (isConversationStopword(fold)) return true;
  // Keep bare model numbers (Serie 6, SM 74); reject calendar years only.
  if (/^(19|20)\d{2}$/.test(fold)) return true;
  if (/^(tl|try|bin|bin\s*tl|bütçem|butcem|fiyat|ile|icin|için|ve|veya)$/i.test(fold)) {
    return true;
  }
  // Province / district noise — model tokens are rarely Turkish place names mid-phrase
  if (
    /^(istanbul|ankara|izmir|bursa|antalya|kadikoy|kadıköy|cankaya|çankaya|besiktas|beşiktaş)$/i.test(
      fold.normalize("NFD").replace(/\p{M}/gu, ""),
    )
  ) {
    return true;
  }
  return false;
}

/** Tokens immediately after brand, stopping before product / location / budget noise. */
function modelTokensAfterBrand(
  text: string,
  brand: string,
  productPhrase: string | null,
): string {
  const words = text.split(/\s+/).filter(Boolean);
  const brandParts = brand.split(/\s+/).filter(Boolean);
  if (!brandParts.length) return "";

  let brandIdx = -1;
  for (let i = 0; i <= words.length - brandParts.length; i++) {
    let match = true;
    for (let j = 0; j < brandParts.length; j++) {
      if (
        words[i + j]!.toLocaleLowerCase("tr-TR") !==
        brandParts[j]!.toLocaleLowerCase("tr-TR")
      ) {
        match = false;
        break;
      }
    }
    if (match) {
      brandIdx = i;
      break;
    }
  }
  if (brandIdx < 0) return "";

  const out: string[] = [];
  for (let i = brandIdx + brandParts.length; i < words.length; i++) {
    const w = words[i]!;
    if (isNoiseModelToken(w)) break;
    if (tokenOverlapsProductPhrase(w, productPhrase)) break;
    // Stop at budget clause start
    if (/^bütçe|^butce|^fiyat/i.test(w)) break;
    out.push(w.replace(/[.,;:]+$/g, ""));
    if (out.length >= 4) break;
  }
  return out.join(" ").trim();
}

/**
 * Brand candidate from free text.
 * Product phrases are reserved first; brand requires catalog/memory/evidence.
 */
export function extractBrandFromText(text: string): BrandExtractionResult {
  const trimmed = stripTrailingCapacitySuffix(text.trim());
  if (!trimmed) {
    return { brand: null, remainder: "", confidence: 0, source: "none" };
  }

  const productHit = findLongestProductPhrase(trimmed);
  const { remainder: withoutProduct } = stripProductPhraseSpan(trimmed);
  const searchText = withoutProduct.trim() || "";

  // If only product + request stopwords remain, no brand/model.
  const cleanedSearch = stripConversationRemainder(searchText);
  if (!cleanedSearch) {
    return {
      brand: null,
      remainder: "",
      confidence: 0,
      source: "none",
      productPhrase: productHit?.phrase ?? null,
    };
  }

  // Catalog evidence on remaining text (or full text before strip for "Chicco … bebek arabası")
  const catalogHit =
    catalogBrandInText(cleanedSearch) ?? catalogBrandInText(trimmed);
  if (catalogHit && !tokenOverlapsProductPhrase(catalogHit, productHit?.phrase)) {
    const modelRemainder = modelTokensAfterBrand(
      cleanedSearch,
      catalogHit,
      productHit?.phrase ?? null,
    );
    return {
      brand: catalogHit,
      remainder: modelRemainder,
      confidence: 0.92,
      source: "catalog",
      productPhrase: productHit?.phrase ?? null,
    };
  }

  const firstToken = cleanedSearch.split(/\s+/)[0] ?? "";
  const memoryHit = defaultBrandMemory.resolve(firstToken);
  if (
    memoryHit.canonical &&
    memoryHit.confidence >= 0.8 &&
    !tokenOverlapsProductPhrase(memoryHit.canonical, productHit?.phrase)
  ) {
    const brand = memoryHit.canonical;
    const remainder = stripConversationRemainder(
      cleanedSearch.slice(firstToken.length).trim(),
    );
    const safeRemainder =
      remainder && !tokenOverlapsProductPhrase(remainder, productHit?.phrase)
        ? remainder
        : "";
    return {
      brand,
      remainder: safeRemainder,
      confidence: memoryHit.confidence,
      source: "memory",
      productPhrase: productHit?.phrase ?? null,
    };
  }

  // Explicit "X marka"
  const markaMatch = cleanedSearch.match(
    /^([A-ZÀ-ÖØ-Ý][\p{L}0-9&.-]{1,30})\s+marka\b/iu,
  );
  if (markaMatch?.[1]) {
    const brand = markaMatch[1]!;
    if (!tokenOverlapsProductPhrase(brand, productHit?.phrase)) {
      const remainder = stripConversationRemainder(
        cleanedSearch.slice(markaMatch[0]!.length).trim(),
      );
      return {
        brand,
        remainder:
          remainder &&
          !tokenOverlapsProductPhrase(remainder, productHit?.phrase)
            ? remainder
            : "",
        confidence: 0.9,
        source: "inferred",
        productPhrase: productHit?.phrase ?? null,
      };
    }
  }

  const words = cleanedSearch.split(/\s+/);
  const candidates: string[] = [];

  for (let i = 0; i < Math.min(words.length, 3); i++) {
    const word = words[i]!;
    const next = words[i + 1];

    if (!isBrandCandidateToken(word)) break;
    if (tokenOverlapsProductPhrase(word, productHit?.phrase)) break;
    if (isModelLikeToken(word)) break;

    if (candidates.length >= 1 && isEmbeddedProductLineToken(word)) break;
    if (candidates.length >= 1 && next && isQualifierToken(next)) break;

    candidates.push(word);

    if (next && isProductFamilyLineToken(next, words[i + 2])) break;
    if (candidates.length >= 1 && next && isModelLikeToken(next)) break;
    if (candidates.length >= 2) break;
  }

  if (candidates.length === 0) {
    return {
      brand: null,
      remainder: "",
      confidence: 0,
      source: "none",
      productPhrase: productHit?.phrase ?? null,
    };
  }

  const brand = candidates.join(" ");
  if (tokenOverlapsProductPhrase(brand, productHit?.phrase)) {
    return {
      brand: null,
      remainder: "",
      confidence: 0,
      source: "none",
      productPhrase: productHit?.phrase ?? null,
    };
  }

  const after = stripConversationRemainder(
    cleanedSearch.slice(brand.length).trim(),
  );
  const remainder =
    after && !tokenOverlapsProductPhrase(after, productHit?.phrase)
      ? after
      : "";

  let confidence = 0.55;
  if (isMixedCaseBrandToken(brand) || isLeadingLowerBrandToken(brand)) {
    confidence = 0.75;
  }
  if (candidates.length === 1 && brand.length <= 3) confidence = 0.35;

  return {
    brand,
    remainder,
    confidence,
    source: "inferred",
    productPhrase: productHit?.phrase ?? null,
  };
}

/** Split combined product string into brand + model — never splits product phrases. */
export function splitProductNameString(value: string): {
  brand: string | null;
  model: string | null;
} {
  const phrase = findLongestProductPhrase(value);
  if (phrase && foldEqualsProduct(value, phrase.phrase)) {
    return { brand: null, model: null };
  }
  const result = extractBrandFromText(value);
  if (!result.brand) return { brand: null, model: null };
  return {
    brand: result.brand,
    model: result.remainder || null,
  };
}

/** @deprecated alias — use splitProductNameString */
export const parseConsumerProductName = splitProductNameString;

function foldEqualsProduct(raw: string, phrase: string): boolean {
  const a = raw
    .toLocaleLowerCase("tr-TR")
    .replace(/\b(?:arıyorum|ariyorum|istiyorum|lazım|lazim)\b/giu, "")
    .replace(/\s+/g, " ")
    .trim();
  const b = phrase.toLocaleLowerCase("tr-TR").trim();
  return a === b || a.includes(b);
}
