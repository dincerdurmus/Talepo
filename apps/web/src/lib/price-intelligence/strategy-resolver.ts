import { buildSemanticFieldMap } from "@/lib/product-identity/semantic-fields";
import type { SemanticFieldClass } from "@/lib/product-identity/types";

import {
  CATEGORY_STRATEGY_HINTS,
  type PriceStrategyKey,
} from "./price-strategy-registry";

export type PriceStrategyContext = {
  categorySlug: string;
  title?: string | null;
  needType?: string | null;
  condition?: string | null;
  attributes: Record<string, string>;
  semanticFields?: Record<string, SemanticFieldClass>;
  brand?: string | null;
  model?: string | null;
  productType?: string | null;
  identityConfidence?: number;
};

export type PriceStrategyResolution = {
  strategy: PriceStrategyKey;
  strategyConfidence: number;
  strategyReasons: string[];
};

const USED_CONDITION_TOKENS = [
  "ikinci el",
  "second hand",
  "used",
  "refurbished",
  "yenilenmiş",
  "yenilenmis",
  "2.el",
  "2 el",
];

function norm(text: string): string {
  return text.trim().toLocaleLowerCase("tr-TR");
}

function attr(ctx: PriceStrategyContext, key: string): string | null {
  const val = ctx.attributes[key]?.trim();
  return val || null;
}

function hasSemantic(ctx: PriceStrategyContext, cls: SemanticFieldClass): boolean {
  const map = ctx.semanticFields ?? buildSemanticFieldMap(ctx.attributes);
  return Object.values(map).includes(cls);
}

function hasKey(ctx: PriceStrategyContext, ...keys: string[]): boolean {
  return keys.some((k) => Boolean(attr(ctx, k)));
}

function parseQuantity(ctx: PriceStrategyContext): number | null {
  const raw = attr(ctx, "quantity") ?? attr(ctx, "commonQuantity");
  if (!raw) return null;
  const match = raw.replace(/\./g, "").match(/(\d[\d.,]*)/);
  if (!match) return null;
  const n = Number(match[1]!.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function isUsedCondition(ctx: PriceStrategyContext): boolean {
  const cond = norm(ctx.condition ?? attr(ctx, "condition") ?? "");
  if (USED_CONDITION_TOKENS.some((t) => cond.includes(t))) return true;
  const title = norm(ctx.title ?? "");
  return USED_CONDITION_TOKENS.some((t) => title.includes(t));
}

function hasRetailIdentity(ctx: PriceStrategyContext): boolean {
  if (ctx.brand?.trim() || ctx.model?.trim()) return true;
  if (attr(ctx, "solutionType") || attr(ctx, "productName")) return true;
  if (hasSemantic(ctx, "brand-like") && hasSemantic(ctx, "model-like")) return true;
  return hasKey(ctx, "brand", "brandPreference", "model", "productName", "solutionType");
}

function resolveFromNeedType(ctx: PriceStrategyContext): PriceStrategyResolution | null {
  const need = norm(ctx.needType ?? attr(ctx, "needType") ?? "");
  if (!need) return null;

  if (need === "vehicle") {
    return resolve("VEHICLE", 0.92, `needType=${need}`);
  }
  if (need === "part" || need === "tire") {
    return resolve("AUTO_PART", 0.9, `needType=${need}`);
  }
  if (need === "machine") {
    return resolve("INDUSTRIAL_EQUIPMENT", 0.9, `needType=${need}`);
  }
  if (need === "service") {
    const slug = norm(ctx.categorySlug);
    if (slug === "machinery" || hasKey(ctx, "machineType")) {
      return resolve("INDUSTRIAL_PARTS_SERVICE", 0.88, `needType=service + industrial context`);
    }
    return resolve("SERVICE_SCOPE", 0.88, `needType=service`);
  }
  if (need === "hardware") {
    const strategy: PriceStrategyKey = isUsedCondition(ctx) ? "USED_PRODUCT" : "RETAIL_PRODUCT";
    return resolve(strategy, 0.85, `needType=hardware${isUsedCondition(ctx) ? " + used" : ""}`);
  }
  if (need === "software") {
    return resolve("SERVICE_SCOPE", 0.82, "needType=software");
  }

  return null;
}

function resolveFromRealEstate(ctx: PriceStrategyContext): PriceStrategyResolution | null {
  const listing = norm(attr(ctx, "listingType") ?? "");
  if (!listing) return null;

  if (listing.includes("kiral")) {
    return resolve("REAL_ESTATE_RENT", 0.93, `listingType=${listing}`);
  }
  if (listing.includes("satıl") || listing.includes("satil")) {
    return resolve("REAL_ESTATE_SALE", 0.93, `listingType=${listing}`);
  }
  return null;
}

function resolveFromManufacturing(ctx: PriceStrategyContext): PriceStrategyResolution | null {
  const qty = parseQuantity(ctx);
  const hasPrintSpec =
    hasKey(ctx, "dimensions", "printType", "material", "paperWeight", "finishing", "lamination") ||
    norm(ctx.categorySlug) === "printing";

  if (hasPrintSpec && (qty === null || qty >= 50)) {
    return resolve("CUSTOM_MANUFACTURING", 0.9, "custom manufacturing signals");
  }
  if (norm(ctx.categorySlug) === "printing" && hasKey(ctx, "dimensions")) {
    return resolve("CUSTOM_MANUFACTURING", 0.85, "printing category + dimensions");
  }
  return null;
}

function resolveFromMedical(ctx: PriceStrategyContext): PriceStrategyResolution | null {
  const healthType = norm(attr(ctx, "healthProductType") ?? "");
  if (!healthType) return null;

  if (healthType.includes("medikal") || healthType.includes("cihaz")) {
    return resolve("MEDICAL_DEVICE", 0.9, `healthProductType=${healthType}`);
  }
  if (healthType.includes("sarf") || healthType.includes("koruyucu")) {
    return resolve("B2B_COMMODITY", 0.78, `healthProductType=${healthType}`);
  }
  return null;
}

function resolveFromServiceScope(ctx: PriceStrategyContext): PriceStrategyResolution | null {
  if (hasKey(ctx, "serviceType")) {
    return resolve("SERVICE_SCOPE", 0.86, "serviceType field present");
  }
  const title = norm(ctx.title ?? "");
  const serviceHints = ["boya", "badana", "temizlik", "montaj", "kaplama", "nakliye", "hizmet"];
  if (serviceHints.some((h) => title.includes(h)) && norm(ctx.categorySlug) === "services") {
    return resolve("SERVICE_SCOPE", 0.75, "service title + services category");
  }
  return null;
}

function resolveFromB2B(ctx: PriceStrategyContext): PriceStrategyResolution | null {
  const qty = parseQuantity(ctx);
  if (qty !== null && qty >= 20) {
    const bulkCategories = new Set(["furniture", "health", "baby", "appliances", "home-kitchen"]);
    if (bulkCategories.has(norm(ctx.categorySlug)) || hasKey(ctx, "furnitureType", "applianceType")) {
      return resolve("B2B_COMMODITY", 0.8, `bulk quantity=${qty}`);
    }
  }
  return null;
}

function resolveFromProductIdentity(ctx: PriceStrategyContext): PriceStrategyResolution | null {
  if (!hasRetailIdentity(ctx)) return null;

  const slug = norm(ctx.categorySlug);
  const nonRetailSlugs = new Set(["real-estate", "services", "printing"]);
  if (nonRetailSlugs.has(slug) && !hasKey(ctx, "solutionType", "productName", "brand")) {
    return null;
  }

  const strategy: PriceStrategyKey = isUsedCondition(ctx) ? "USED_PRODUCT" : "RETAIL_PRODUCT";
  const confidence =
    (ctx.brand && ctx.model ? 0.82 : 0.72) +
    (ctx.identityConfidence && ctx.identityConfidence >= 0.7 ? 0.06 : 0);
  return resolve(strategy, Math.min(0.95, confidence), "structured product identity");
}

function resolveFromCategoryHint(ctx: PriceStrategyContext): PriceStrategyResolution | null {
  const hint = CATEGORY_STRATEGY_HINTS[norm(ctx.categorySlug)];
  if (!hint || hint === "UNKNOWN") return null;
  return resolve(hint, 0.45, `weak category hint (${ctx.categorySlug})`);
}

function resolve(
  strategy: PriceStrategyKey,
  confidence: number,
  reason: string,
): PriceStrategyResolution {
  return {
    strategy,
    strategyConfidence: Math.round(Math.min(1, Math.max(0, confidence)) * 1000) / 1000,
    strategyReasons: [reason],
  };
}

/**
 * Resolve the price strategy for a request context.
 * Priority: needType → structured fields → request characteristics → weak category hint → UNKNOWN
 */
export function resolvePriceStrategy(ctx: PriceStrategyContext): PriceStrategyResolution {
  const reasons: string[] = [];
  let best: PriceStrategyResolution | null = null;

  const candidates: Array<PriceStrategyResolution | null> = [
    resolveFromNeedType(ctx),
    resolveFromRealEstate(ctx),
    resolveFromManufacturing(ctx),
    resolveFromMedical(ctx),
    resolveFromServiceScope(ctx),
    resolveFromB2B(ctx),
    resolveFromProductIdentity(ctx),
    resolveFromCategoryHint(ctx),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (!best || candidate.strategyConfidence > best.strategyConfidence) {
      best = candidate;
    }
    reasons.push(...candidate.strategyReasons);
  }

  if (best) {
    return {
      ...best,
      strategyReasons: [...new Set([...best.strategyReasons, ...reasons.slice(0, 3)])],
    };
  }

  return {
    strategy: "UNKNOWN",
    strategyConfidence: 0.2,
    strategyReasons: ["insufficient intent signals — safe UNKNOWN fallback"],
  };
}

/** Build resolver context from price intelligence query inputs */
export function buildPriceStrategyContext(input: {
  categorySlug?: string | null;
  title?: string | null;
  condition?: string | null;
  fieldValues?: { key: string; value: string | null }[];
  normalizedProduct?: {
    brand?: string | null;
    model?: string | null;
    productType?: string | null;
    attributes?: Record<string, string>;
    semanticFields?: Record<string, SemanticFieldClass>;
    confidence?: number;
  } | null;
}): PriceStrategyContext {
  const attributes: Record<string, string> = {};

  for (const fv of input.fieldValues ?? []) {
    if (fv.value?.trim()) attributes[fv.key] = fv.value.trim();
  }
  if (input.normalizedProduct?.attributes) {
    for (const [k, v] of Object.entries(input.normalizedProduct.attributes)) {
      if (v?.trim() && !attributes[k]) attributes[k] = v.trim();
    }
  }

  const semanticFields =
    input.normalizedProduct?.semanticFields ?? buildSemanticFieldMap(attributes);

  return {
    categorySlug: input.categorySlug?.trim() ?? "",
    title: input.title,
    needType: attributes.needType ?? null,
    condition: input.condition ?? attributes.condition ?? null,
    attributes,
    semanticFields,
    brand: input.normalizedProduct?.brand ?? attributes.brand ?? attributes.brandPreference ?? null,
    model: input.normalizedProduct?.model ?? attributes.model ?? null,
    productType: input.normalizedProduct?.productType ?? null,
    identityConfidence: input.normalizedProduct?.confidence,
  };
}
