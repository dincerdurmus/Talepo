import { extractModelIdentityTokens } from "./model-identity-tokens";
import { normalizeModelText } from "./model-normalization";
import { isKnownPartNoun } from "@/lib/ai/parser/part-nouns";
import { isCanonicalProductTypePhrase } from "@/lib/taxonomy/phrase-classification";

const PRODUCT_TYPE_VOCAB = new Set([
  "bebek", "arabasi", "arabası", "puset", "makinesi", "makine", "machine",
  "supurge", "süpürge", "süpürge", "elektrikli", "kahve", "camasir", "çamaşır",
  "washer", "dryer", "kurutma", "bulaşık", "bulasik", "dishwasher",
  "matkap", "drill", "telefon", "phone", "sandalyesi", "sandalye",
  "katlanir", "katlanır", "arabasi", "puset",
  "akulu", "akülü", "sarjli", "şarjlı", "cordless",
  "televizyon", "tv", "smart", "qled", "oled", "inç", "inc", "inch",
  "ekran", "ekranlı", "ekranli",
]);

const DESCRIPTIVE_FIELD_KEYS = [
  "features",
  "specs",
  "productName",
  "modelDetails",
  "variantDetails",
  "solutionType",
] as const;

export type ModelCandidate = {
  value: string;
  score: number;
  source: string;
};

function scoreCandidate(
  value: string,
  source: string,
  hasStructuredModel: boolean,
  hasProductTypeOnly: boolean,
): number {
  let score = 0;
  const norm = normalizeModelText(value);
  const words = norm.split(" ").filter(Boolean);

  if (hasStructuredModel) score -= 2;

  const identityTokens = extractModelIdentityTokens(value);
  if (identityTokens.some((t) => t.class === "ALPHA_NUMERIC_MODEL" || t.class === "SKU_LIKE")) {
    score += 4;
  }
  if (identityTokens.some((t) => t.class === "NUMERIC_SERIES")) score += 2;

  const typeWordRatio =
    words.filter((w) => PRODUCT_TYPE_VOCAB.has(w)).length / Math.max(1, words.length);
  if (typeWordRatio >= 0.5) score -= 4;

  if (/^[A-Z]/.test(value.trim()) && words.length <= 4) score += 2;
  if (/\b\d+\b/.test(value)) score += 1;
  if (words.length === 1 && words[0]!.length >= 4 && !PRODUCT_TYPE_VOCAB.has(words[0]!)) {
    score += 2;
  }

  if (source === "features" || source === "productName") score += 1;

  // Promote short family names when only productType is structured (e.g. Urban Plus in features)
  if (hasProductTypeOnly && typeWordRatio < 0.3 && words.length >= 1 && words.length <= 3) {
    score += 3;
  }

  return score;
}

/** Extract model/variant candidates from descriptive structured fields */
export function extractModelCandidatesFromAttributes(
  attributes: Record<string, string>,
  hasStructuredModel: boolean,
  hasProductTypeOnly = false,
): ModelCandidate[] {
  const candidates: ModelCandidate[] = [];

  for (const key of DESCRIPTIVE_FIELD_KEYS) {
    const raw = attributes[key]?.trim();
    if (!raw) continue;

    if (key === "specs" && /^(series|seri|serisi)\s*\d/i.test(raw)) continue;

    const phrases = raw.match(/\b([A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ0-9]+(?:\s+[A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ0-9+]+){0,3})\b/g) ?? [];
    for (const phrase of phrases) {
      const score = scoreCandidate(phrase, key, hasStructuredModel, hasProductTypeOnly);
      if (score >= 3) candidates.push({ value: phrase.trim(), score, source: key });
    }

    const alnum = raw.match(/\b([A-Za-z]{1,4}\d+[A-Za-z0-9+-]*)\b/g) ?? [];
    for (const token of alnum) {
      const score = scoreCandidate(token, key, hasStructuredModel, hasProductTypeOnly) + 1;
      if (score >= 4) candidates.push({ value: token.trim(), score, source: key });
    }

    if (phrases.length === 0 && alnum.length === 0) {
      const score = scoreCandidate(raw, key, hasStructuredModel, hasProductTypeOnly);
      if (score >= 4) candidates.push({ value: raw, score, source: key });
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}

/**
 * Turkish instrument-noun suffixes: temizleyici(si), nemlendirici, kurutucu,
 * karıştırıcı, süpürgesi… Words built this way name WHAT a device is, never
 * which model it is — without this, "hava temizleyicisi" was stored as
 * "Model: hava temizleyicisi". Morphology beats hand-extending the vocab list
 * one product at a time.
 */
const INSTRUMENT_SUFFIX =
  /(?:leyici|layıcı|layici|leyicisi|layıcısı|layicisi|ıcı|ici|ucu|ücü|ucusu|icisi|ıcısı|ücüsü|gesi|gası)$/;

function isProductTypeWord(word: string): boolean {
  if (PRODUCT_TYPE_VOCAB.has(word)) return true;
  return word.length >= 5 && INSTRUMENT_SUFFIX.test(word);
}

export function isProductTypePhrase(value: string): boolean {
  const words = normalizeModelText(value).split(" ").filter(Boolean);
  if (words.length === 0) return false;
  /**
   * KANONİK TAKSONOMİ ÖNCE (1B).
   *
   * `PRODUCT_TYPE_VOCAB` elle yazılmış ~40 kelimelik bir listedir ve sistemde
   * ZATEN tanımlı ürünleri kaçırıyordu: "fırın" `data/taxonomy` içinde
   * `PRODUCT_TYPE | Fırın` olarak duruyor olmasına rağmen burada tanınmıyor,
   * bu yüzden "Siemens fırın için termostat" talebinde "fırın" MODEL alanına
   * düşüyordu. Çözüm listeyi tek tek büyütmek değil, kanonik kaynağa sormaktır.
   *
   * Yalnız İFADENİN TAMAMI sorulur; kelime kelime sorulsaydı 1238 ürün
   * türünün tüm sözcükleri aşağıdaki 0.4 oranını bozardı. Tam ifade eşleşmesi
   * "156", "SM 74", "C180" gibi gerçek model jetonlarına dokunmaz — onlar
   * taksonomide düğüm değildir ve aşağıdaki mevcut mantığa düşerler.
   */
  if (isCanonicalProductTypePhrase(value)) return true;
  const hits = words.filter(isProductTypeWord).length;
  return hits / words.length >= 0.4;
}

/** Trim trailing product-type words from a model string (e.g. DCD996 akülü matkap → DCD996) */
export function stripTrailingProductTypeFromModel(model: string): string {
  const words = model.trim().split(/\s+/);
  while (words.length > 1) {
    const last = words[words.length - 1]!.toLocaleLowerCase("tr-TR");
    if (PRODUCT_TYPE_VOCAB.has(last) || isKnownPartNoun(last) || /makinesi$|makine$/.test(last)) {
      words.pop();
    } else {
      break;
    }
  }
  return words.join(" ").trim();
}
