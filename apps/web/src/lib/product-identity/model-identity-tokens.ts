import { modelTokens, normalizeModelText } from "./model-normalization";
import { extractStorageFromText, extractWeightFromText } from "./unit-normalization";

export type ModelIdentityTokenClass =
  | "ALPHA_NUMERIC_MODEL"
  | "NUMERIC_SERIES"
  | "GENERATION"
  | "QUALIFIER"
  | "SKU_LIKE";

export type ModelIdentityToken = {
  raw: string;
  normalized: string;
  class: ModelIdentityTokenClass;
  /** Grouping key for conflict detection — e.g. "v", "s", "dhp", "series" */
  family: string;
  value: string;
};

const PRODUCT_TYPE_NOISE = new Set([
  "bebek", "arabasi", "arabası", "puset", "makinesi", "makine", "machine",
  "supurge", "süpürge", "elektrikli", "kahve", "camasir", "çamaşır", "washer",
  "matkap", "drill", "telefon", "phone", "laptop", "tablet",
]);

const QUALIFIER_WORDS = new Set([
  "pro", "max", "plus", "mini", "ultra", "lite", "detect", "absolute", "slim",
  "hybrid", "dream", "premium", "standard", "cordless", "wireless",
]);

function stripNonIdentityNumbers(text: string): string {
  return normalizeModelText(text)
    .replace(/\b\d+(?:\.\d+)?\s*(gb|tb|kg|ml|l|lt|litre|liter|cm|mm|m)\b/g, " ")
    .replace(/\b\d+\s*x\s*\d+\b/g, " ")
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAlphaNumericToken(token: string): ModelIdentityToken | null {
  const compact = token.replace(/[^a-z0-9-]/g, "");

  const seriesMatch = compact.match(/^(series|seri|serisi)(\d+[a-z]?)$/);
  if (seriesMatch) {
    return {
      raw: token,
      normalized: `${seriesMatch[1]}${seriesMatch[2]}`,
      class: "NUMERIC_SERIES",
      family: "series",
      value: seriesMatch[2]!,
    };
  }

  const letterDigit = compact.match(/^([a-z]{1,4})(\d+[a-z0-9]*)$/);
  if (letterDigit) {
    return {
      raw: token,
      normalized: compact,
      class: "ALPHA_NUMERIC_MODEL",
      family: letterDigit[1]!,
      value: letterDigit[2]!,
    };
  }

  const skuLike = compact.match(/^([a-z]{2,})(\d{2,}[a-z0-9]*)$/);
  if (skuLike && compact.length >= 5) {
    return {
      raw: token,
      normalized: compact,
      class: "SKU_LIKE",
      family: skuLike[1]!,
      value: skuLike[2]!,
    };
  }

  if (/^\d{3,5}[a-z]?$/.test(compact)) {
    return {
      raw: token,
      normalized: compact,
      class: "NUMERIC_SERIES",
      family: "numeric",
      value: compact.replace(/[a-z]/g, ""),
    };
  }

  if (/^[a-z0-9-]{8,}$/.test(compact) && /\d/.test(compact) && /[a-z]/.test(compact)) {
    return {
      raw: token,
      normalized: compact,
      class: "SKU_LIKE",
      family: compact.slice(0, 3),
      value: compact,
    };
  }

  return null;
}

/**
 * Extract strong model identity tokens from product text.
 * Excludes storage, weight, dimensions, and plain years.
 */
export function extractModelIdentityTokens(text: string): ModelIdentityToken[] {
  if (!text?.trim()) return [];

  if (extractStorageFromText(text) || extractWeightFromText(text)) {
    // still parse — stripNonIdentityNumbers removes units
  }

  const stripped = stripNonIdentityNumbers(text);
  const tokens = modelTokens(stripped);
  const results: ModelIdentityToken[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (PRODUCT_TYPE_NOISE.has(token)) continue;
    if (QUALIFIER_WORDS.has(token)) {
      results.push({
        raw: token,
        normalized: token,
        class: "QUALIFIER",
        family: "qualifier",
        value: token,
      });
      continue;
    }

    const combined = i + 1 < tokens.length ? `${token}${tokens[i + 1]}` : token;
    const parsed = parseAlphaNumericToken(token) ?? parseAlphaNumericToken(combined);
    if (!parsed) continue;

    const key = `${parsed.family}:${parsed.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(parsed);
  }

  const seriesPhrase = stripped.match(/\b(series|seri|serisi)\s*(\d+[a-z]?)\b/);
  if (seriesPhrase) {
    const key = `series:${seriesPhrase[2]}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({
        raw: seriesPhrase[0],
        normalized: `series${seriesPhrase[2]}`,
        class: "NUMERIC_SERIES",
        family: "series",
        value: seriesPhrase[2]!,
      });
    }
  }

  return results.filter((t) => t.class !== "QUALIFIER");
}

export type ModelIdentityConflict = {
  conflict: boolean;
  reason?: string;
  requestToken?: ModelIdentityToken;
  externalToken?: ModelIdentityToken;
};

/**
 * Detect confident conflicting model identity between request and external title.
 * Missing external token is NOT a conflict; different token in same family IS.
 */
export function modelIdentityTokenConflict(
  requestText: string,
  externalText: string,
): ModelIdentityConflict {
  const reqTokens = extractModelIdentityTokens(requestText).filter(
    (t) => t.class !== "QUALIFIER",
  );
  const extTokens = extractModelIdentityTokens(externalText).filter(
    (t) => t.class !== "QUALIFIER",
  );

  if (reqTokens.length === 0) return { conflict: false };

  for (const req of reqTokens) {
    if (req.class === "QUALIFIER") continue;

    const extSameFamily = extTokens.filter((e) => e.family === req.family);
    if (extSameFamily.length === 0) continue;

    for (const ext of extSameFamily) {
      if (req.normalized === ext.normalized || req.value === ext.value) continue;

      if (req.class === "SKU_LIKE" && req.normalized.length >= 8) {
        if (req.normalized !== ext.normalized) {
          return {
            conflict: true,
            reason: "sku-like identity mismatch",
            requestToken: req,
            externalToken: ext,
          };
        }
        continue;
      }

      return {
        conflict: true,
        reason: `model identity mismatch (${req.family}: ${req.value} vs ${ext.value})`,
        requestToken: req,
        externalToken: ext,
      };
    }
  }

  return { conflict: false };
}

/** Collect identity-bearing text from a ProductIdentity-like object */
export function collectIdentityText(parts: {
  model?: string | null;
  series?: string | null;
  variant?: string | null;
  specs?: string | null;
}): string {
  return [parts.model, parts.series, parts.variant, parts.specs].filter(Boolean).join(" ");
}
