/**
 * Entity role validation — prevent category words as brand, quantity as model, etc.
 */

import { TURKEY_IL_NAMES } from "@/lib/geo/turkey-districts";
import { findBrandInText, findModelInText } from "@/lib/catalog/automotive/indexes";

/**
 * Marka bağlamındaki salt-rakam modeli KANONİK katalog doğrular mı?
 * ("Alfa Romeo" + "156" → catalog model_alfa-romeo_156). Token listesi
 * (isKnownAutomotiveModelName) rakam modelleri bilerek dışladığı için
 * doğrulama katalog eşleşmesinden okunur — ikinci bir liste kurulmaz.
 */
function catalogConfirmsNumericModel(brand: string, model: string): boolean {
  try {
    const brandHit = findBrandInText(brand);
    if (!brandHit) return false;
    const hit = findModelInText(model, brandHit.record.id);
    if (!hit) return false;
    const fold = model.toLocaleLowerCase("tr-TR");
    return (
      hit.record.name.toLocaleLowerCase("tr-TR") === fold ||
      (hit.record.aliases ?? []).some(
        (a: string) => a.toLocaleLowerCase("tr-TR") === fold,
      )
    );
  } catch {
    return false;
  }
}
import {
  findLongestProductPhrase,
  tokenOverlapsProductPhrase,
} from "./product-phrase-lexicon";

const CATEGORY_WORDS = new Set([
  "matbaa",
  "baskı",
  "baski",
  "teknoloji",
  "makine",
  "otomotiv",
  "emlak",
  "hizmet",
  "hizmetler",
  "televizyon",
  "tv",
  "broşür",
  "brosur",
  "ambalaj",
  "mobilya",
  "sağlık",
  "saglik",
  "beyaz eşya",
  "beyaz esya",
]);

const PRODUCT_NOUNS = new Set([
  "televizyon",
  "tv",
  "broşür",
  "brosur",
  "kartvizit",
  "pompa",
  "pompası",
  "pompasi",
  "makinesi",
  "telefon",
  "daire",
  "araba",
]);

const PROVINCE_FOLD = new Set(
  TURKEY_IL_NAMES.map((n) => n.toLocaleLowerCase("tr-TR")),
);

export function isInvalidBrandCandidate(value: string | null | undefined): boolean {
  const t = String(value ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR");
  if (!t) return true;
  if (/^\d+$/.test(t)) return true;
  if (CATEGORY_WORDS.has(t)) return true;
  if (PROVINCE_FOLD.has(t)) return true;
  if (PRODUCT_NOUNS.has(t) && t.length < 12) return true;
  if (
    t === "bebek" ||
    t === "arabası" ||
    t === "arabasi" ||
    t === "çamaşır" ||
    t === "camasir" ||
    t === "bulaşık" ||
    t === "bulasik" ||
    t === "kahve" ||
    t === "mama" ||
    t === "puset"
  ) {
    return true;
  }
  return false;
}

export function isInvalidModelCandidate(input: {
  model: string | null | undefined;
  brand?: string | null;
  productType?: string | null;
  rawInput?: string | null;
}): boolean {
  const model = String(input.model ?? "").trim();
  if (!model) return true;
  const fold = model.toLocaleLowerCase("tr-TR");
  const brand = String(input.brand ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR");
  if (brand && fold === brand) return true;
  if (input.rawInput && fold === input.rawInput.trim().toLocaleLowerCase("tr-TR")) {
    return true;
  }
  if (CATEGORY_WORDS.has(fold)) return true;
  if (PRODUCT_NOUNS.has(fold)) return true;
  if (PROVINCE_FOLD.has(fold)) return true;
  /**
   * SALT-RAKAM MODEL yalnız KATALOG doğruluyorsa geçerlidir (98+ Faz I,
   * 2026-09-01). Eski kural her salt-rakamı reddediyordu; "Alfa Romeo 156"
   * gerçek bir katalog modelidir ve "Uyumlu model" bilgisi kullanıcı
   * yüzeyinden siliniyordu (ölçüldü). Marka bağlamı olmayan çıplak sayı
   * hâlâ reddedilir.
   */
  if (
    /^\d+$/.test(fold) &&
    !(brand && catalogConfirmsNumericModel(brand, model))
  ) {
    return true;
  }
  if (/^\d+\s*(?:adet|broşür|brosur|inç|inc|ekran)/i.test(fold)) return true;
  // Multi-word sentence / location fragment is not a model
  if (model.split(/\s+/).length >= 4) return true;
  if (/\b(?:kiralık|satılık|daire|arıyorum|istiyorum)\b/i.test(fold)) {
    return true;
  }
  // Truncated product fragment: "Serie 6 ç" (lowercase orphan only)
  if (/\s+ç$/u.test(model)) return true;
  // Quantity + product phrase
  if (
    /\b\d{2,}\b/.test(fold) &&
    PRODUCT_NOUNS.has(fold.replace(/\d+/g, "").trim())
  ) {
    return true;
  }
  const product = String(input.productType ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR");
  if (product && fold === product) return true;
  return false;
}

export function sanitizeFactRoles(input: {
  brand?: string | null;
  model?: string | null;
  productType?: string | null;
  rawInput?: string | null;
  categoryId?: string | null;
}): { brand: string | null; model: string | null; productType: string | null } {
  let brand = input.brand?.trim() || null;
  let model = input.model?.trim() || null;
  const productType = input.productType?.trim() || null;

  if (
    input.categoryId === "real-estate" ||
    input.categoryId === "services"
  ) {
    return { brand: null, model: null, productType };
  }

  const productPhrase =
    findLongestProductPhrase(input.rawInput ?? "")?.phrase ?? productType;

  if (brand && isInvalidBrandCandidate(brand)) brand = null;
  if (brand && tokenOverlapsProductPhrase(brand, productPhrase)) brand = null;

  if (
    model &&
    isInvalidModelCandidate({
      model,
      brand,
      productType: productPhrase ?? productType,
      rawInput: input.rawInput,
    })
  ) {
    model = null;
  }
  if (model && tokenOverlapsProductPhrase(model, productPhrase)) model = null;
  if (!brand) model = null;
  if (
    brand &&
    model &&
    brand.toLocaleLowerCase("tr-TR") === model.toLocaleLowerCase("tr-TR")
  ) {
    model = null;
  }
  return { brand, model, productType };
}
