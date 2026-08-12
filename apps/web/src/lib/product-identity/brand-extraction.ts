import {
  isConversationStopword,
  stripConversationRemainder,
} from "@/lib/ai/parser/negation";

import { defaultBrandMemory } from "./brand-memory";
import { extractModelIdentityTokens } from "./model-identity-tokens";
import { normalizeModelText } from "./model-normalization";
import { stripTrailingCapacitySuffix } from "./unit-normalization";

/** Generic product nouns — never treated as brand candidates */
const GENERIC_LEADING_NOUNS = new Set([
  "telefon", "phone", "smartphone", "mobile", "laptop", "notebook", "tablet",
  "computer", "bilgisayar", "makine", "machine", "device", "cihaz", "product",
  "urun", "ürün", "model", "type", "new", "yeni",
  "ofis", "ev", "daire", "konut", "salon", "mutfak",
]);

const QUALIFIER_TOKENS = new Set([
  "pro", "max", "plus", "mini", "ultra", "lite", "detect", "absolute", "slim",
  "hybrid", "dream", "premium", "standard", "cordless", "wireless",
]);

export type BrandExtractionResult = {
  brand: string | null;
  remainder: string;
  confidence: number;
  source: "structured" | "memory" | "inferred" | "none";
};

/** Mixed-case brand token: DeWalt, LaCie, iRobot */
function isMixedCaseBrandToken(token: string): boolean {
  return /^[A-Z][a-z]*[A-Z][a-zA-Z0-9&.-]+$/.test(token);
}

/** Lowercase-leading brand: eufy */
function isLowercaseBrandToken(token: string): boolean {
  return /^[a-z][a-z0-9&.-]{2,}$/.test(token) && token === token.toLowerCase();
}

/** Internal-capital brand starting lowercase: iRobot */
function isLeadingLowerBrandToken(token: string): boolean {
  return /^[a-z][A-Z][a-zA-Z0-9&.-]+$/.test(token);
}

function isTitleCaseToken(token: string): boolean {
  return (
    /^[A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ0-9&.-]+$/.test(token) ||
    /^[A-Z0-9]{2,}$/.test(token) ||
    isMixedCaseBrandToken(token) ||
    isLowercaseBrandToken(token) ||
    isLeadingLowerBrandToken(token)
  );
}

function isQualifierToken(token: string): boolean {
  return QUALIFIER_TOKENS.has(token.toLocaleLowerCase("tr-TR"));
}

function isEmbeddedProductLineToken(token: string): boolean {
  // Generic lowercase-leading product lines: iPhone, iPad, eufyCam-style (not brand extension)
  return /^i[A-Z][a-zA-Z0-9+]+$/.test(token);
}

function isModelLikeToken(token: string): boolean {
  if (/^[A-Za-z]{1,3}\d+[A-Za-z0-9]*$/.test(token)) return true;
  if (extractModelIdentityTokens(token).some((t) => t.class !== "QUALIFIER")) return true;
  return false;
}

/**
 * Product-family line token (Galaxy, Roomba, LatteGo, Urban) —
 * generic: TitleCase token immediately before model-like content.
 */
function isProductFamilyLineToken(token: string, nextToken?: string): boolean {
  if (!/^[A-Z][a-zA-Z0-9+]+$/.test(token)) return false;
  if (isModelLikeToken(token)) return false;
  if (!nextToken) return false;
  return isModelLikeToken(nextToken) || /^\d/.test(nextToken);
}

function isBrandCandidateToken(token: string): boolean {
  if (/^(19|20)\d{2}$/.test(token.trim())) return false;
  if (isConversationStopword(token)) return false;
  return isTitleCaseToken(token) && !GENERIC_LEADING_NOUNS.has(token.toLocaleLowerCase("tr-TR"));
}

/**
 * Generic brand candidate from free text — no known-brand dictionary.
 */
export function extractBrandFromText(text: string): BrandExtractionResult {
  const trimmed = stripTrailingCapacitySuffix(text.trim());
  if (!trimmed) return { brand: null, remainder: "", confidence: 0, source: "none" };

  const memoryHit = defaultBrandMemory.resolve(trimmed.split(/\s+/)[0] ?? "");
  if (memoryHit.canonical && memoryHit.confidence >= 0.8) {
    const brand = memoryHit.canonical;
    const remainder = stripConversationRemainder(trimmed.slice(brand.length).trim());
    return { brand, remainder: remainder || "", confidence: memoryHit.confidence, source: "memory" };
  }

  const words = trimmed.split(/\s+/);
  const candidates: string[] = [];

  for (let i = 0; i < Math.min(words.length, 3); i++) {
    const word = words[i]!;
    const next = words[i + 1];

    if (!isBrandCandidateToken(word)) break;
    const lower = word.toLocaleLowerCase("tr-TR");
    if (GENERIC_LEADING_NOUNS.has(lower)) break;
    if (isModelLikeToken(word)) break;

    // Product-line token belongs to model, not brand (Apple / iPhone 15)
    if (candidates.length >= 1 && isEmbeddedProductLineToken(word)) break;

    // Second+ token before a qualifier belongs to model (LaCie / Rugged Mini)
    if (candidates.length >= 1 && next && isQualifierToken(next)) break;

    candidates.push(word);

    if (next && isProductFamilyLineToken(next, words[i + 2])) break;
    if (candidates.length >= 1 && next && isModelLikeToken(next)) break;
    if (candidates.length >= 2) break;
  }

  if (candidates.length === 0) {
    return { brand: null, remainder: trimmed, confidence: 0, source: "none" };
  }

  const brand = candidates.join(" ");
  const remainder = stripConversationRemainder(trimmed.slice(brand.length).trim());
  let confidence = 0.55;
  if (
    isMixedCaseBrandToken(brand) ||
    isLowercaseBrandToken(brand) ||
    isLeadingLowerBrandToken(brand)
  ) {
    confidence = 0.75;
  }
  if (candidates.length === 1 && brand.length <= 3) confidence = 0.35;

  return { brand, remainder: remainder || trimmed, confidence, source: "inferred" };
}

/** Split combined product string into brand + model — generic, no enum */
export function splitProductNameString(value: string): {
  brand: string | null;
  model: string | null;
} {
  const result = extractBrandFromText(value);
  return {
    brand: result.brand,
    model: result.remainder || null,
  };
}

/** @deprecated alias — use splitProductNameString */
export const parseConsumerProductName = splitProductNameString;
