import { createHash } from "node:crypto";

import {
  buildProviderSearchQuery,
  computeNormalizationConfidence,
  selectFingerprintFieldKeys,
} from "@/lib/price-intelligence/category-registry";
import { normalizeToken } from "@/server/price-intelligence/normalize-product";

import { extractBrandFromText } from "./brand-extraction";
import {
  AUTOMOTIVE_BRANDS,
  findBrand,
  findTechnologyProduct,
  isKnownAutomotiveModelName,
  stripLeadingBrandAliases,
  TECHNOLOGY_BRANDS,
} from "@/lib/ai/parser/brand-catalog";
import { stripConversationRemainder } from "@/lib/ai/parser/negation";
import { stripTrailingPartNouns } from "@/lib/ai/parser/part-nouns";
import { looksLikeTelevisionScreenContext, looksLikeYearToken } from "@/lib/request-understanding/number-role";
import { normalizeCondition } from "./condition";
import {
  extractModelCandidatesFromAttributes,
  isProductTypePhrase,
  stripTrailingProductTypeFromModel,
} from "./identity-candidates";
import {
  buildSemanticFieldMap,
  pickFirstByClass,
} from "./semantic-fields";
import { normalizeModelText } from "./model-normalization";
import type { ProductCondition, ProductIdentity, ProductIdentifiers, SemanticFieldClass } from "./types";
import { extractStorageFromText, stripTrailingCapacitySuffix } from "./unit-normalization";
import {
  findLongestProductPhrase,
  tokenOverlapsProductPhrase,
} from "@/lib/request-composer/v2/product-phrase-lexicon";

export type BuildIdentityInput = {
  categoryId: string;
  categorySlug: string;
  title: string;
  fieldValues?: { key: string; value: string | null; label?: string }[];
  city?: string | null;
  district?: string | null;
};

function buildFingerprint(input: {
  categorySlug: string;
  brand: string | null;
  model: string | null;
  series: string | null;
  attributes: Record<string, string>;
}): string | null {
  const parts: string[] = [input.categorySlug];
  if (input.brand) parts.push(normalizeToken(input.brand));
  if (input.model) parts.push(normalizeModelText(input.model));
  if (input.series) parts.push(normalizeModelText(input.series));

  const fpKeys = selectFingerprintFieldKeys(input.categorySlug, input.attributes, 6);
  for (const key of fpKeys) {
    const val = input.attributes[key];
    if (val?.trim()) parts.push(`${key}:${normalizeToken(val)}`);
  }

  if (parts.length <= 1) return null;
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 24);
}

function extractIdentifiers(
  attributes: Record<string, string>,
  semanticFields: Record<string, SemanticFieldClass>,
): ProductIdentifiers {
  return {
    sku: pickFirstByClass(attributes, semanticFields, "sku-like"),
    gtin: pickFirstByClass(attributes, semanticFields, "gtin-like"),
    ean: attributes.ean?.trim() ?? null,
    upc: attributes.upc?.trim() ?? null,
    mpn: attributes.mpn?.trim() ?? attributes.partNumber?.trim() ?? null,
  };
}

function splitEmbeddedProductName(
  raw: string,
  existingBrand: string | null,
): { brand: string | null; model: string | null; series: string | null } {
  const text = stripTrailingCapacitySuffix(raw.trim());
  const split = extractBrandFromText(text);

  const brand = existingBrand ?? split.brand;
  let remainder = stripConversationRemainder(split.remainder);

  if (brand && remainder.toLocaleLowerCase("tr-TR").startsWith(brand.toLocaleLowerCase("tr-TR"))) {
    remainder = remainder.slice(brand.length).trim();
  }

  const seriesMatch = remainder.match(/\b(series|seri|serisi)\s*(\d+[a-z]?)\b/i);
  const series = seriesMatch ? `${seriesMatch[1]} ${seriesMatch[2]}`.trim() : null;

  return {
    brand,
    model: remainder || null,
    series,
  };
}

export function buildProductIdentity(input: BuildIdentityInput): ProductIdentity {
  const attributes: Record<string, string> = {};
  const fieldLabels: Record<string, string> = {};

  for (const fv of input.fieldValues ?? []) {
    if (fv.value?.trim()) attributes[fv.key] = fv.value.trim();
    if (fv.label) fieldLabels[fv.key] = fv.label;
  }

  const semanticFields = buildSemanticFieldMap(attributes, fieldLabels);

  // Priority 1–2: structured brand
  let brand = pickFirstByClass(attributes, semanticFields, "brand-like");
  let brandConfidence = brand ? 0.95 : 0;

  // Priority 3: structured model
  const structuredModel =
    attributes.model?.trim() ??
    attributes.productName?.trim() ??
    pickFirstByClass(attributes, semanticFields, "model-like") ??
    null;

  const productType =
    pickFirstByClass(attributes, semanticFields, "product-type-like") ??
    attributes.applianceType?.trim() ??
    attributes.kitchenProductType?.trim() ??
    attributes.babyProductType?.trim() ??
    null;

  let model: string | null =
    structuredModel ?? attributes.solutionType?.trim() ?? null;
  let series = pickFirstByClass(attributes, semanticFields, "series-like") ?? attributes.specs?.trim() ?? null;
  let variant = pickFirstByClass(attributes, semanticFields, "variant-like");
  if (!variant) variant = pickFirstByClass(attributes, semanticFields, "year-like");

  // Priority 5: promote from features/specs when model looks like productType
  const hasProductTypeOnly = Boolean(productType) && !structuredModel;
  const candidates = extractModelCandidatesFromAttributes(
    attributes,
    Boolean(structuredModel),
    hasProductTypeOnly,
  );
  const topCandidate = candidates.find(
    (c) => !brand || c.value.toLocaleLowerCase("tr-TR") !== brand.toLocaleLowerCase("tr-TR"),
  );
  if (
    topCandidate &&
    topCandidate.score >= 4 &&
    (!model || isProductTypePhrase(model))
  ) {
    model = topCandidate.value;
  } else if (
    topCandidate &&
    topCandidate.score >= 5 &&
    model &&
    isProductTypePhrase(model) &&
    !isProductTypePhrase(topCandidate.value)
  ) {
    variant = variant ?? model;
    model = topCandidate.value;
  }

  if (!structuredModel && attributes.features?.trim() && brand) {
    const fromFeatures = splitEmbeddedProductName(attributes.features, brand);
    if (fromFeatures.model && !isProductTypePhrase(fromFeatures.model)) {
      model = fromFeatures.model;
    }
  }

  // Embedded brand+model in solutionType / long model strings
  const embedSource = attributes.solutionType?.trim() ?? model;
  if (embedSource && (!brand || !structuredModel)) {
    const embedded = splitEmbeddedProductName(embedSource, brand);
    if (embedded.brand && !brand) {
      brand = embedded.brand;
      brandConfidence = 0.85;
    }
    if (embedded.model && (!structuredModel || isProductTypePhrase(model ?? ""))) {
      model = embedded.model;
    }
    if (embedded.series && !series) series = embedded.series;
  }

  // Catalog device family (iPhone 15 → Apple / iPhone 15) beats inferred product-line brand.
  // Never apply phone/tablet catalog families in television screen contexts (A55 ≠ Galaxy A55).
  const tvScreenContext = looksLikeTelevisionScreenContext(input.title);
  const techProduct = tvScreenContext
    ? null
    : findTechnologyProduct(input.title);
  const catalogTechBrand =
    techProduct?.brand || findBrand(input.title, TECHNOLOGY_BRANDS);
  if (catalogTechBrand) {
    const currentResolves = brand
      ? findBrand(brand, TECHNOLOGY_BRANDS)
      : null;
    if (!brand || currentResolves === catalogTechBrand) {
      brand = catalogTechBrand;
      brandConfidence = Math.max(brandConfidence, 0.92);
    }
  }
  if (
    techProduct &&
    (!structuredModel ||
      isProductTypePhrase(model ?? "") ||
      /^\d+$/.test(model ?? ""))
  ) {
    model = techProduct.canonical;
    const titleRemainder = extractBrandFromText(input.title).remainder;
    const normalizedRemainder = stripTrailingCapacitySuffix(titleRemainder).trim();
    if (
      normalizedRemainder &&
      normalizedRemainder.toLocaleLowerCase("tr-TR").includes(
        techProduct.canonical.toLocaleLowerCase("tr-TR"),
      )
    ) {
      model = normalizedRemainder;
    }
  }
  const inferredTechnologyRemainder = stripTrailingCapacitySuffix(
    extractBrandFromText(input.title).remainder,
  ).trim();
  if (
    catalogTechBrand &&
    model &&
    inferredTechnologyRemainder &&
    inferredTechnologyRemainder.toLocaleLowerCase("tr-TR").includes(
      model.toLocaleLowerCase("tr-TR"),
    ) &&
    !model.toLocaleLowerCase("tr-TR").includes(
      inferredTechnologyRemainder.toLocaleLowerCase("tr-TR"),
    )
  ) {
    model = inferredTechnologyRemainder;
  }
  if (techProduct) {
    const titleRemainder = stripTrailingCapacitySuffix(
      extractBrandFromText(input.title).remainder,
    ).trim();
    if (
      titleRemainder &&
      titleRemainder.toLocaleLowerCase("tr-TR").includes(
        techProduct.canonical.toLocaleLowerCase("tr-TR"),
      ) &&
      !model?.toLocaleLowerCase("tr-TR").includes(
        titleRemainder.toLocaleLowerCase("tr-TR"),
      )
    ) {
      model = titleRemainder;
    }
  }

  // Catalog manufacturer aliases (alfa → Alfa Romeo) — same path as tech, not a parallel map
  const catalogAutoBrand = findBrand(input.title, AUTOMOTIVE_BRANDS);
  if (catalogAutoBrand) {
    const currentResolves = brand
      ? findBrand(brand, AUTOMOTIVE_BRANDS)
      : null;
    if (!brand || currentResolves === catalogAutoBrand) {
      brand = catalogAutoBrand;
      brandConfidence = Math.max(brandConfidence, 0.92);
    }
  }

  // Title inference only when structured brand absent
  if (!brand && input.title?.trim()) {
    const fromTitle = extractBrandFromText(input.title);
    if (
      fromTitle.brand &&
      fromTitle.source !== "none" &&
      !isKnownAutomotiveModelName(fromTitle.brand) &&
      (fromTitle.source === "catalog" ||
        fromTitle.source === "memory" ||
        fromTitle.confidence >= 0.55)
    ) {
      brand = fromTitle.brand;
      brandConfidence = Math.max(brandConfidence, fromTitle.confidence);
      const remainder = stripConversationRemainder(fromTitle.remainder);
      // Model only after a verified brand, and never from product-phrase residue
      if (!model && remainder && brand) {
        model = remainder;
      }
    } else if (
      fromTitle.brand &&
      isKnownAutomotiveModelName(fromTitle.brand) &&
      !model
    ) {
      model = fromTitle.brand;
    }
  }

  // Product phrase span cannot also be brand/model
  {
    const productPhrase =
      findLongestProductPhrase(input.title)?.phrase ??
      productType ??
      attributes.productType ??
      null;
    if (productPhrase) {
      if (tokenOverlapsProductPhrase(brand, productPhrase)) {
        brand = null;
        brandConfidence = 0;
      }
      if (tokenOverlapsProductPhrase(model, productPhrase)) {
        model = null;
      }
    }
  }

  // Never invent a model without a verified brand (except alphanumeric codes already tied upstream)
  if (!brand && model) {
    if (isProductTypePhrase(model) || model.split(/\s+/).length <= 2) {
      const looksLikeCode = /^[A-Za-z]{0,4}\d+[A-Za-z0-9-]*$/.test(
        model.replace(/\s+/g, ""),
      );
      if (!looksLikeCode) model = null;
    }
  }

  // Known vehicle model must never occupy the brand slot (Golf ≠ Volkswagen)
  if (brand && isKnownAutomotiveModelName(brand)) {
    if (!model) model = brand;
    brand = null;
    brandConfidence = 0;
  }

  // Year tokens are never brand identity
  if (brand && looksLikeYearToken(brand)) {
    brand = null;
    brandConfidence = 0;
  }
  if (model && looksLikeYearToken(model) && !/^[A-Za-z]/.test(model)) {
    model = null;
  }
  if (
    model &&
    /^\d{2,3}$/.test(model) &&
    looksLikeTelevisionScreenContext(input.title)
  ) {
    model = null;
  }
  // Strip size/unit/product noise from TV remainders; keep real model codes (A55 D).
  // Avoid \\b after Turkish "inç" — JS word boundaries often fail there.
  if (model && looksLikeTelevisionScreenContext(input.title)) {
    let cleaned = model
      .replace(/\d{2,3}\s*(?:["”']|inç|inc|inch|ekran(?:lı|li)?)/giu, " ")
      .replace(/(?:smart\s*)?(?:qled|oled)?\s*(?:tv|televizyon)\b/giu, " ")
      .replace(/(?:inç|inc|inch|ekran(?:lı|li)?)/giu, " ")
      .replace(/\s+/g, " ")
      .trim();
    // Trailing bare inch size left after size-phrase strip (e.g. "A55 D 55").
    cleaned = cleaned.replace(/\s+\d{2,3}$/u, "").trim();
    const fold = cleaned.toLocaleLowerCase("tr-TR");
    if (
      !cleaned ||
      /^(?:smart\s*)?tv$/.test(fold) ||
      /^televizyon$/.test(fold) ||
      /^\d{2,3}$/.test(cleaned)
    ) {
      model = null;
    } else {
      model = cleaned;
    }
  }

  if (model) {
    model = stripTrailingCapacitySuffix(stripTrailingProductTypeFromModel(model));
    model = stripConversationRemainder(model) || null;
  }
  if (brand && model) {
    model = stripLeadingBrandAliases(model, brand, AUTOMOTIVE_BRANDS) || model;
    model = stripLeadingBrandAliases(model, brand, TECHNOLOGY_BRANDS) || model;
  }
  // Model must not restate the brand (or leftover punctuation around brand)
  if (brand && model) {
    const brandFold = brand.toLocaleLowerCase("tr-TR");
    const modelFold = model.toLocaleLowerCase("tr-TR").replace(/["'”]+/g, "").trim();
    if (
      !modelFold ||
      modelFold === brandFold ||
      modelFold.includes(brandFold)
    ) {
      model = null;
    }
  }
  if (model) {
    model = stripTrailingPartNouns(model) || null;
  }

  // Strip redundant brand prefix from model when brand is known separately
  if (brand && model) {
    const brandPrefix = new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "i");
    const stripped = model.replace(brandPrefix, "").trim();
    model = stripped || null;
  }

  // Preserve a generic product-family token when the resolver returned only
  // the compact model suffix (for example Galaxy / S24 Ultra).
  // Skip in TV screen contexts — remainder often still holds size/product noise.
  if (catalogTechBrand && model && !tvScreenContext) {
    const titleModel = stripTrailingCapacitySuffix(
      extractBrandFromText(input.title).remainder,
    ).trim();
    if (
      titleModel &&
      titleModel.toLocaleLowerCase("tr-TR").includes(model.toLocaleLowerCase("tr-TR"))
    ) {
      model = titleModel;
    }
  }

  // Never use productType as model when productType is explicitly set
  if (!model && productType && !pickFirstByClass(attributes, semanticFields, "product-type-like")) {
    model = productType;
  }

  if (series?.match(/^(series|seri|serisi)\s*\d/i) && model && isProductTypePhrase(model)) {
    const tmp = series;
    series = model.match(/^(series|seri|serisi)\s*\d/i) ? model : series;
    if (isProductTypePhrase(model)) model = null;
    if (!model && !isProductTypePhrase(tmp)) model = tmp;
  }

  const conditionRaw =
    pickFirstByClass(attributes, semanticFields, "condition-like") ?? attributes.condition;
  const condition: ProductCondition = normalizeCondition(conditionRaw);

  const identifiers = extractIdentifiers(attributes, semanticFields);

  const fingerprintKeys = selectFingerprintFieldKeys(input.categorySlug, attributes);
  const confidence = computeNormalizationConfidence({
    categorySlug: input.categorySlug,
    attributes,
    fingerprintKeyCount: fingerprintKeys.length,
  });

  const brandBoost = brand ? 0.05 : 0;
  const idBoost = identifiers.sku || identifiers.gtin ? 0.1 : 0;

  const providerQuery = buildProviderSearchQuery({
    categorySlug: input.categorySlug,
    title: input.title,
    attributes,
    city: input.city,
    district: input.district,
  });

  const fingerprint = buildFingerprint({
    categorySlug: input.categorySlug,
    brand,
    model,
    series,
    attributes,
  });

  const specs = attributes.specs ?? attributes.storage;
  if (specs && extractStorageFromText(specs)) {
    attributes.storage = extractStorageFromText(specs) ?? specs;
  }

  return {
    categoryId: input.categoryId,
    brand,
    brandConfidence,
    productType,
    model,
    series,
    variant,
    condition,
    identifiers,
    attributes,
    semanticFields,
    fingerprint,
    confidence: Math.min(1, Math.round((confidence + brandBoost + idBoost) * 100) / 100),
    providerQuery,
  };
}

/** Map ProductIdentity → legacy NormalizedProduct shape */
export function identityToLegacyNormalized(identity: ProductIdentity) {
  return {
    categoryId: identity.categoryId,
    brand: identity.brand,
    model: identity.model,
    variant: identity.variant ?? identity.series,
    series: identity.series,
    productType: identity.productType,
    condition: identity.condition === "UNKNOWN" ? null : identity.condition.toLowerCase(),
    identifiers: identity.identifiers,
    attributes: identity.attributes,
    fingerprint: identity.fingerprint,
    confidence: identity.confidence,
    providerQuery: identity.providerQuery,
    semanticFields: identity.semanticFields,
    brandConfidence: identity.brandConfidence,
  };
}
