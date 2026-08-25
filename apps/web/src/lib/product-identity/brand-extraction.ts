import {
  isConversationStopword,
  stripConversationRemainder,
} from "@/lib/ai/parser/negation";
import { findBrand, TECHNOLOGY_BRANDS, AUTOMOTIVE_BRANDS, APPLIANCE_BRANDS, BABY_BRANDS, FURNITURE_BRANDS, HOME_KITCHEN_BRANDS, MACHINERY_BRANDS } from "@/lib/ai/parser/brand-catalog";

import { classifyRequestedTargetRole } from "@/lib/request-understanding/requested-item-role";

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

/* ------------------------------------------------------------------ *
 *  MARKA KANIT SÖZLEŞMESİ (RC_BRAND dilimi, 2026-08-25)               *
 * ------------------------------------------------------------------ */

/**
 * Bir marka ADAYININ kanıt durumu. Ölçülen kusur: metinde geçen her büyük
 * harfli jeton `EXPLICIT / USER_EXPLICIT / 0.95` markaya dönüşüyor ve
 * routing envelope üzerinden kesin marka kanıtı üretiyordu — "RAM",
 * "Ticari", "Torna", "Kompresör", "Tekerlekli", "Toptan", "Kürek",
 * "Çelik", "Logolu", "E-ticaret" (108 senaryoluk corpus, 10 RC_BRAND).
 *
 *   VERIFIED_CATALOG  kanonik marka kataloğunda doğrulandı — kesin marka
 *                     olabilir, exact eşleşme kanıtı taşıyabilir.
 *   USER_ASSERTED     kullanıcı açık marka sözdizimi kullandı ("X marka",
 *                     "X markası", "X markalı", "marka olarak X"). Katalog
 *                     dışı olsa bile kullanıcı beyanı olarak saklanır; kanıt
 *                     etiketi USER_ASSERTED'dır, katalog doğrulaması gibi
 *                     GÖSTERİLMEZ.
 *   CANDIDATE         marka OLABİLİR ama ne katalog ne sözdizimi kanıtı var
 *                     ("Nordex klima"). Kesin marka alanına yazılamaz, exact
 *                     eşleşmeye gidemez; aday olarak korunur, silinmez.
 *   NONE              jeton marka değil: sayı/birim bağlamı, istek başındaki
 *                     ürünün kendisi, ürün önündeki morfolojik sıfat ya da
 *                     kanonik ürün/parça/hizmet sözcüğü.
 *
 * NONE kuralları GENELDİR, kelime listesi değildir:
 *   (a) SAYI KOMŞULUĞU — jetonun hemen önündeki iki jetonda rakam varsa bu
 *       bir teknik özellik bağlamıdır ("16 GB RAM").
 *   (b) İSTENEN ŞEYİN KENDİSİ — jetonu doğrudan bir talep fiili izliyorsa
 *       jeton aranan şeydir, markası değil ("Kompresör arıyorum").
 *   (c) MORFOLOJİK SIFAT — jeton -li/-lı/-lu/-lü ile bitiyor VE hemen
 *       ardından kanonik bir bütün ürün geliyorsa ürün öbeğinin
 *       niteleyicisidir ("Tekerlekli sandalye", "Logolu promosyon").
 *       Bu bir Türkçe dil kuralıdır; k→ğ yumuşaması gibi.
 *   (d) KANONİK ROL — jetonun kendisi taksonomi/rol yetkisinde ürün, parça
 *       ya da hizmet olarak tanınıyorsa marka olamaz.
 *
 * Yalnız büyük harfle başlamak marka kanıtı DEĞİLDİR: cümle başındaki her
 * Türkçe kelime büyük yazılır. Bu yüzden kanıtsız jeton silinmez ama
 * CANDIDATE'ten öteye de geçemez — "Nordex" ile "Toptan" arasındaki farkı
 * bugün hiçbir kanonik kaynak bilmiyor; ikisi de adaydır, ikisi de yanlış
 * kesinlik üretmez.
 */
export type BrandEvidenceStatus =
  | "VERIFIED_CATALOG"
  | "USER_ASSERTED"
  | "CANDIDATE"
  | "NONE";

export type BrandEvidence = { status: BrandEvidenceStatus; reason: string };

const REQUEST_VERB_RE =
  /^(?:arıyorum|ariyorum|arıyoruz|ariyoruz|lazım|lazim|istiyorum|istiyoruz|gerekiyor|gerek)$/iu;

function foldTr(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/[ç]/g, "c")
    .replace(/[ğ]/g, "g")
    .replace(/[ı]/g, "i")
    .replace(/[ö]/g, "o")
    .replace(/[ş]/g, "s")
    .replace(/[ü]/g, "u");
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Açık marka beyanının JETONUNU çıkarır (RC_BRAND takip dilimi).
 *
 * Ölçülen açık: kimlik katmanı küçük harfli jetonları hiç marka adayı
 * yapmıyor; "eufy marka bebek arabası" beyanı kanıt kapısına ulaşamıyordu.
 * Beyan dilbilgisi yazım biçiminden bağımsızdır: "X marka", "X markası",
 * "X markalı", "marka olarak X". Jeton ORİJİNAL yazımıyla döner; kanıt
 * sınıflandırması yine `classifyBrandEvidence`e aittir.
 */
export function extractAssertedBrand(rawInput: string): string | null {
  const words = String(rawInput ?? "")
    .split(/[^\p{L}\p{N}&.+-]+/u)
    .filter(Boolean);
  const isMarka = (w: string) => /^marka(?:s[ıi]|l[ıi])?$/u.test(foldTr(w));
  for (let i = 0; i < words.length; i++) {
    if (!isMarka(words[i]!)) continue;
    // "marka olarak X"
    if (foldTr(words[i]!) === "marka" && foldTr(words[i + 1] ?? "") === "olarak") {
      const cand = words[i + 2];
      if (cand && cand.length >= 2 && !isMarka(cand)) return cand;
    }
    // "X marka(sı/lı)"
    const cand = words[i - 1];
    if (cand && cand.length >= 2 && !isMarka(cand) && !/^\d+$/.test(cand)) {
      return cand;
    }
  }
  return null;
}

export function classifyBrandEvidence(
  rawInput: string,
  token: unknown,
): BrandEvidence {
  const value = String(token ?? "").trim();
  if (!value) return { status: "NONE", reason: "empty" };
  const raw = String(rawInput ?? "");

  // 1) Kanonik katalog doğrulaması.
  if (catalogBrandInText(value)) {
    return { status: "VERIFIED_CATALOG", reason: "catalog" };
  }

  // 2) Açık kullanıcı sözdizimi — Türkçe ek ve büyük/küçük harf katlanır.
  const fr = foldTr(raw);
  const ft = escapeRe(foldTr(value));
  if (
    new RegExp(`(?:^|[^a-z0-9])${ft}\\s+marka(?:s[ıi]|l[ıi])?(?:[^a-z0-9]|$)`).test(fr) ||
    new RegExp(`marka(?:s[ıi])?\\s+olarak\\s+${ft}(?:[^a-z0-9]|$)`).test(fr) ||
    new RegExp(`(?:^|[^a-z0-9])${ft}\\s+markal[ıi]`).test(fr)
  ) {
    return { status: "USER_ASSERTED", reason: "brand-syntax" };
  }

  const words = raw.split(/[^\p{L}\p{N}+.-]+/u).filter(Boolean);
  const idx = words.findIndex((w) => foldTr(w) === foldTr(value));
  const next = idx >= 0 ? words[idx + 1] : undefined;
  const prev1 = idx >= 1 ? words[idx - 1] : undefined;
  const prev2 = idx >= 2 ? words[idx - 2] : undefined;

  // NONE (a): sayı komşuluğu — teknik özellik bağlamı.
  if ([prev1, prev2].some((w) => w && /\d/.test(w))) {
    return { status: "NONE", reason: "spec-context" };
  }

  // NONE (b): jetonu talep fiili izliyor — aranan şeyin kendisi.
  if (next && REQUEST_VERB_RE.test(next)) {
    return { status: "NONE", reason: "requested-head" };
  }

  // NONE (c): morfolojik sıfat + ardından kanonik bütün ürün.
  if (
    /l[ıiuü]$/u.test(value.toLocaleLowerCase("tr-TR")) &&
    next &&
    classifyRequestedTargetRole(next).role === "WHOLE_PRODUCT"
  ) {
    return { status: "NONE", reason: "adjective-of-product" };
  }

  // NONE (d): jetonun kendisi kanonik ürün/parça/hizmet.
  if (classifyRequestedTargetRole(value).role !== "UNKNOWN") {
    return { status: "NONE", reason: "canonical-role" };
  }

  return { status: "CANDIDATE", reason: "no-evidence" };
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
