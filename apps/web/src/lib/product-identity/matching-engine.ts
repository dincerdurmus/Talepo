import type { NormalizedProduct } from "@/lib/price-intelligence/types";

import { detectAccessory } from "./accessory-detection";
import { conditionCompatible, inferConditionFromText } from "./condition";
import {
  collectIdentityText,
  modelIdentityTokenConflict,
} from "./model-identity-tokens";
import {
  modelSubstringMatch,
  normalizeModelText,
  qualifiersSatisfied,
  tokenOverlapRatio,
  trailingModelQualifiers,
} from "./model-normalization";
import type { MatchQualityResult, NormalizedExternalProduct, ProductIdentity } from "./types";
import {
  extractStorageFromText,
  normalizeStorageValue,
  normalizeWeightValue,
  extractWeightFromText,
  storageValuesEquivalent,
} from "./unit-normalization";

const DEFAULT_THRESHOLD = 0.4;

function isProductIdentity(
  request: ProductIdentity | NormalizedProduct,
): request is ProductIdentity {
  const c = request.condition;
  return c === "NEW" || c === "USED" || c === "REFURBISHED" || c === "UNKNOWN";
}

function asIdentity(request: ProductIdentity | NormalizedProduct): ProductIdentity {
  return isProductIdentity(request) ? request : legacyAsIdentity(request);
}

function legacyAsIdentity(normalized: NormalizedProduct): ProductIdentity {
  return {
    categoryId: normalized.categoryId,
    brand: normalized.brand,
    brandConfidence: normalized.brandConfidence ?? (normalized.brand ? 0.8 : 0),
    productType: normalized.productType ?? null,
    model: normalized.model,
    series: normalized.series ?? null,
    variant: normalized.variant,
    condition:
      normalized.condition?.toUpperCase() === "REFURBISHED"
        ? "REFURBISHED"
        : normalized.condition?.toUpperCase() === "USED"
          ? "USED"
          : normalized.condition
            ? "NEW"
            : "UNKNOWN",
    identifiers: normalized.identifiers ?? {},
    attributes: normalized.attributes,
    semanticFields: normalized.semanticFields ?? {},
    fingerprint: normalized.fingerprint,
    confidence: normalized.confidence,
    providerQuery: normalized.providerQuery ?? "",
  };
}

function requiredWeight(identity: ProductIdentity): string | null {
  for (const key of ["capacity", "weight", "load"]) {
    const val = identity.attributes[key];
    if (!val?.trim()) continue;
    const norm = normalizeWeightValue(val);
    if (norm) return norm.token;
  }
  return null;
}

const APPLIANCE_FAMILIES: Array<{ family: string; synonyms: string[] }> = [
  { family: "washer", synonyms: ["camasir", "washing", "washer", "laundry"] },
  { family: "dryer", synonyms: ["kurutma", "dryer", "drying"] },
  { family: "dishwasher", synonyms: ["bulasik", "dishwasher", "dish washer"] },
  { family: "vacuum", synonyms: ["supurge", "vacuum", "cleaner"] },
  { family: "coffee", synonyms: ["kahve", "coffee", "espresso"] },
];

function productFamilies(text: string): Set<string> {
  const normalized = normalizeModelText(text);
  const found = new Set<string>();
  for (const { family, synonyms } of APPLIANCE_FAMILIES) {
    if (synonyms.some((s) => normalized.includes(s))) found.add(family);
  }
  return found;
}

function isWasherDryerCombo(text: string): boolean {
  const n = normalizeModelText(text);
  const hasWasher = /camasir|washer|washing|yikama|yıkama/.test(n);
  const hasDryer = /kurutma|kurutmal|dryer|drying|combo|combi/.test(n);
  return hasWasher && hasDryer;
}

function isWasherOnlyRequest(text: string): boolean {
  const n = normalizeModelText(text);
  return /camasir|washer|washing|yikama|yıkama/.test(n) && !/kurutma|kurutmal|dryer|drying/.test(n);
}

function isMultiUnitListing(title: string): boolean {
  const n = normalizeModelText(title);
  return (
    /\b\d+\s*adet\b/.test(n) ||
    /\bx\s*\d+\b/.test(n) ||
    /\b\d+\s*pack\b/.test(n) ||
    /\b\d+\s*li\s+set\b/.test(n) ||
    /\b(cift|çift)\s+(akulu|akülü|adet|paket)\b/.test(n)
  );
}

function requiredStorage(identity: ProductIdentity): string | null {
  for (const key of ["storage", "specs"]) {
    const val = identity.attributes[key];
    if (!val?.trim()) continue;
    const norm = normalizeStorageValue(val);
    if (norm) return norm.token;
  }
  return null;
}

function modelCore(identity: ProductIdentity): string | null {
  if (!identity.model?.trim()) return null;
  return normalizeModelText(identity.model)
    .replace(/\b\d+(?:\.\d+)?\s*(gb|tb|kg)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Primary generation/index numbers — excludes storage/capacity (legacy helper) */
function extractGenerationNumbers(text: string): string[] {
  const stripped = normalizeModelText(text)
    .replace(/\b\d+(?:\.\d+)?\s*(gb|tb|kg|ml|l|lt|litre|liter|cm|mm|m)\b/g, "")
    .replace(/\b\d+\s*x\s*\d+\b/g, "");
  return stripped.split(" ").filter((t) => /^\d{1,2}[a-z]?$/.test(t));
}

function generationMismatch(requestModel: string, title: string): boolean {
  const reqNums = extractGenerationNumbers(requestModel);
  if (reqNums.length === 0) return false;

  const primary = reqNums[0]!;
  const titleNums = extractGenerationNumbers(title).filter((n) => n === primary || /^\d{1,2}$/.test(n));

  for (const tn of titleNums) {
    if (tn !== primary) return true;
  }
  return false;
}

function compareIdentifiers(
  request: ProductIdentity,
  external: NormalizedExternalProduct,
): { score: number; mismatch: boolean } {
  const ids = request.identifiers;
  let score = 0;
  let mismatch = false;

  const pairs: Array<[string | null | undefined, string | null | undefined]> = [
    [ids.sku, external.identifiers.sku],
    [ids.gtin, external.identifiers.gtin],
    [ids.ean, external.identifiers.ean],
    [ids.upc, external.identifiers.upc],
    [ids.mpn, external.identifiers.mpn],
  ];

  for (const [req, ext] of pairs) {
    if (!req?.trim()) continue;
    if (!ext?.trim()) continue;
    if (req.trim().toLocaleLowerCase("tr-TR") === ext.trim().toLocaleLowerCase("tr-TR")) {
      score = 1;
    } else {
      mismatch = true;
    }
  }

  return { score, mismatch };
}

/**
 * Provider-independent product matching engine.
 * Hard reject on confident mismatches; missing info lowers score only.
 */
export function matchProductToExternal(
  request: ProductIdentity | NormalizedProduct,
  external: NormalizedExternalProduct,
  threshold = DEFAULT_THRESHOLD,
): MatchQualityResult {
  const identity = asIdentity(request);
  const reasons: string[] = [];
  const mismatches: string[] = [];

  const layers = {
    identityScore: 0,
    attributeScore: 0,
    titleScore: 0,
    conditionScore: 0,
    identifierScore: 0,
  };

  const accessory = detectAccessory({
    title: external.title,
    productType: external.productType,
    partType: identity.attributes.partType ?? identity.attributes.accessoryType,
    requestModel: identity.model,
  });
  if (accessory.isAccessory) {
    return {
      score: 0,
      passed: false,
      hardReject: true,
      reasons: [`accessory: ${accessory.reason}`],
      mismatches: ["accessory"],
      layers,
    };
  }

  if (isMultiUnitListing(external.title)) {
    return {
      score: 0,
      passed: false,
      hardReject: true,
      reasons: ["multi-unit listing"],
      mismatches: ["bundle"],
      layers,
    };
  }

  const idCompare = compareIdentifiers(identity, external);
  layers.identifierScore = idCompare.score;
  if (idCompare.mismatch) {
    return {
      score: 0,
      passed: false,
      hardReject: true,
      reasons: ["identifier mismatch"],
      mismatches: ["identifier"],
      layers,
    };
  }
  if (idCompare.score > 0) reasons.push("identifier match");

  if (identity.brand && identity.brandConfidence >= 0.5) {
    const brandNorm = normalizeModelText(identity.brand);
    const titleNorm = normalizeModelText(external.title);
    if (titleNorm.includes(brandNorm)) {
      layers.identityScore += 0.3;
    } else if (tokenOverlapRatio(identity.brand, external.title) > 0.3) {
      layers.identityScore += 0.15;
    } else if (identity.brandConfidence >= 0.8) {
      mismatches.push("brand");
      return {
        score: 0,
        passed: false,
        hardReject: true,
        reasons: ["brand mismatch"],
        mismatches,
        layers,
      };
    }
  }

  const core = modelCore(identity);
  const identityText = collectIdentityText({
    model: identity.model,
    series: identity.series,
    variant: identity.variant,
    specs: identity.attributes.specs,
  });

  const tokenConflict = modelIdentityTokenConflict(
    identityText || core || "",
    external.title,
  );
  if (tokenConflict.conflict) {
    mismatches.push("model identity");
    return {
      score: 0,
      passed: false,
      hardReject: true,
      reasons: [tokenConflict.reason ?? "model identity mismatch"],
      mismatches,
      layers,
    };
  }

  if (core) {
    if (generationMismatch(core, external.title)) {
      mismatches.push("model generation");
      return {
        score: 0,
        passed: false,
        hardReject: true,
        reasons: ["model generation mismatch"],
        mismatches,
        layers,
      };
    }

    if (modelSubstringMatch(core, external.title)) {
      layers.identityScore += 0.3;
    } else if (tokenOverlapRatio(core, external.title) > 0.85) {
      layers.identityScore += 0.3;
    } else if (tokenOverlapRatio(core, external.title) > 0.4) {
      layers.identityScore += 0.15;
    }

    if (trailingModelQualifiers(core).length > 0 && !qualifiersSatisfied(core, external.title)) {
      mismatches.push("model qualifiers");
      layers.identityScore = Math.min(layers.identityScore, 0.15);
    }
  }

  if (identity.variant) {
    if (normalizeModelText(external.title).includes(normalizeModelText(identity.variant))) {
      layers.attributeScore += 0.15;
    }
  }
  if (identity.series) {
    if (normalizeModelText(external.title).includes(normalizeModelText(identity.series))) {
      layers.attributeScore += 0.1;
    }
  }

  const reqStorage = requiredStorage(identity);
  const titleStorage =
    extractStorageFromText(external.title) ?? external.attributes.storage ?? null;

  if (reqStorage) {
    if (titleStorage && storageValuesEquivalent(reqStorage, titleStorage)) {
      layers.attributeScore += 0.08;
    } else if (titleStorage && !storageValuesEquivalent(reqStorage, titleStorage)) {
      mismatches.push("storage");
    }
  }

  if (identity.providerQuery) {
    layers.titleScore += tokenOverlapRatio(identity.providerQuery, external.title) * 0.2;
  }

  const extCondition =
    external.condition !== "UNKNOWN"
      ? external.condition
      : inferConditionFromText(external.title);
  if (conditionCompatible(identity.condition, extCondition)) {
    layers.conditionScore = 0.05;
  }

  let score =
    layers.identityScore +
    layers.attributeScore +
    layers.titleScore +
    layers.conditionScore +
    layers.identifierScore;

  if (/\bvs\b/.test(normalizeModelText(external.title))) {
    score = Math.min(score, 0.39);
    reasons.push("comparison listing");
  }

  const reqWeight = requiredWeight(identity);
  const titleWeight =
    extractWeightFromText(external.title) ?? external.attributes.weight ?? null;

  const productTypeRaw =
    identity.productType ??
    identity.attributes.applianceType ??
    identity.attributes.kitchenProductType ??
    identity.attributes.machineType ??
    null;

  if (productTypeRaw?.trim()) {
    const reqFamilies = productFamilies(productTypeRaw);
    const titleFamilies = productFamilies(external.title);
    if (reqFamilies.size > 0 && titleFamilies.size > 0) {
      const overlap = [...reqFamilies].some((f) => titleFamilies.has(f));
      if (!overlap) {
        mismatches.push("product-type");
        score = Math.min(score, 0.35);
        reasons.push("product type mismatch");
      }
    }
    if (isWasherOnlyRequest(productTypeRaw) && isWasherDryerCombo(external.title)) {
      mismatches.push("product-type");
      return {
        score: 0,
        passed: false,
        hardReject: true,
        reasons: ["washer-dryer combo mismatch"],
        mismatches,
        layers,
      };
    }
  }

  if (reqWeight) {
    if (titleWeight && titleWeight === reqWeight) {
      layers.attributeScore += 0.08;
    } else if (titleWeight && titleWeight !== reqWeight) {
      mismatches.push("capacity");
      score = Math.min(score, 0.35);
      reasons.push("wrong capacity");
    } else if (!titleWeight) {
      score = Math.min(score, 0.39);
      reasons.push("capacity not specified");
    }
  }

  if (reqStorage) {
    if (!titleStorage) {
      score = Math.min(score, 0.39);
      reasons.push("storage not specified in listing");
    } else if (!storageValuesEquivalent(reqStorage, titleStorage)) {
      score = Math.min(score, 0.25);
      reasons.push("wrong storage");
    }
  }

  if (core && trailingModelQualifiers(core).length > 0 && !qualifiersSatisfied(core, external.title)) {
    score = Math.min(score, 0.39);
    reasons.push("missing model qualifiers");
  }

  if (extCondition === "REFURBISHED" && identity.condition !== "REFURBISHED") {
    score = Math.min(score, 0.25);
    reasons.push("refurbished listing");
  }
  if (extCondition === "USED" && identity.condition === "NEW") {
    score = Math.min(score, 0.25);
    reasons.push("used listing");
  }

  score = Math.round(Math.min(1, score) * 1000) / 1000;

  return {
    score,
    passed: score >= threshold && mismatches.length === 0,
    hardReject: false,
    reasons,
    mismatches,
    layers,
  };
}

export function matchProductsToExternal(
  request: ProductIdentity | NormalizedProduct,
  externals: NormalizedExternalProduct[],
  threshold = DEFAULT_THRESHOLD,
): Array<{ external: NormalizedExternalProduct; result: MatchQualityResult }> {
  return externals.map((external) => ({
    external,
    result: matchProductToExternal(request, external, threshold),
  }));
}
