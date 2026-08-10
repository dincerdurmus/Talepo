/**
 * Dynamic category registry for Price Intelligence.
 * Single source of truth: REQUEST_CATEGORIES from request-category-engine.
 * Do NOT maintain a separate PRICE_CATEGORIES list.
 */
import {
  getCategoryById,
  REQUEST_CATEGORIES,
  type DynamicField,
  type RequestCategory,
} from "@/lib/request-category-engine";
import {
  splitProductNameString,
  parseConsumerProductName,
} from "@/lib/product-identity/brand-extraction";

export { parseConsumerProductName, splitProductNameString };

export type CategoryProviderProfile = {
  /** 0–1 suitability for shopping-style external providers */
  shopping: number;
  /** 0–1 suitability for real-estate providers */
  realEstate: number;
  /** 0–1 weight on Talepo internal signals */
  internal: number;
  /** Primary routing hint for future provider selection */
  primaryRoute: "shopping" | "real_estate" | "machinery" | "internal";
};

export type CategoryCoverageEntry = {
  slug: string;
  label: string;
  fieldCount: number;
  fingerprintCapable: boolean;
  providerQueryCapable: boolean;
  externalShoppingEligible: boolean;
  profile: CategoryProviderProfile;
};

/** Field keys that contribute strongly to cross-category fingerprints */
const GLOBAL_KEY_WEIGHTS: Record<string, number> = {
  brand: 10,
  brandPreference: 9,
  model: 10,
  productName: 9,
  modelYear: 8,
  condition: 7,
  area: 7,
  roomCount: 7,
  capacity: 7,
  dimensions: 7,
  material: 6,
  listingType: 6,
  propertyType: 6,
  machineType: 8,
  needType: 5,
  printType: 6,
  energyClass: 6,
  quantity: 4,
};

const BRAND_KEYS = ["brand", "brandPreference"] as const;
const MODEL_KEYS = ["model", "productName"] as const;
const VARIANT_KEYS = [
  "modelYear",
  "roomCount",
  "area",
  "capacity",
  "ageRange",
  "dimensions",
  "energyClass",
  "machineType",
  "buildingAge",
  "paperWeight",
] as const;

const TYPE_SUFFIX = /Type$/;
const SKIP_TYPE_KEYS = new Set(["needType", "listingType", "printType", "serviceType"]);

/** Request/meta fields — never append to external provider search queries */
const SKIP_QUERY_FIELD_KEYS = new Set([
  ...SKIP_TYPE_KEYS,
  "solutionType",
  "support",
  "integration",
  "userCount",
  "quantityDetail",
  "platform",
  "delivery",
  "budget",
]);

export function isQueryRelevantField(key: string): boolean {
  return !SKIP_QUERY_FIELD_KEYS.has(key);
}

export function listRegistryCategorySlugs(): string[] {
  return REQUEST_CATEGORIES.map((c) => c.id);
}

export function getRegistryCategory(slug: string): RequestCategory {
  return getCategoryById(slug);
}

export function listCategoryCoverage(): CategoryCoverageEntry[] {
  return REQUEST_CATEGORIES.map((category) => {
    const sampleAttrs = Object.fromEntries(
      category.fields.slice(0, 3).map((f) => [f.key, "sample"]),
    );
    const profile = deriveProviderProfile(category);
    const fingerprintKeys = selectFingerprintFieldKeys(category.id, sampleAttrs);
    return {
      slug: category.id,
      label: category.label,
      fieldCount: category.fields.length,
      fingerprintCapable: fingerprintKeys.length > 0,
      providerQueryCapable: buildProviderSearchQuery({
        categorySlug: category.id,
        title: category.label,
        attributes: sampleAttrs,
      }).length > 0,
      externalShoppingEligible: profile.shopping >= 0.5,
      profile,
    };
  });
}

function scoreFieldForFingerprint(field: DynamicField): number {
  let score = GLOBAL_KEY_WEIGHTS[field.key] ?? 0;

  if (TYPE_SUFFIX.test(field.key) && !SKIP_TYPE_KEYS.has(field.key)) {
    score += 8;
  }
  if (field.type === "select") score += 3;
  if (field.required) score += 2;
  if (field.key.includes("spec") || field.key === "features") score += 4;

  return score;
}

/** Select fingerprint field keys from category field definitions + filled values */
export function selectFingerprintFieldKeys(
  categorySlug: string,
  attributes: Record<string, string>,
  maxKeys = 8,
): string[] {
  const category = getCategoryById(categorySlug);
  const filledKeys = new Set(
    Object.entries(attributes)
      .filter(([, v]) => v?.trim())
      .map(([k]) => k),
  );

  const scored = category.fields
    .filter((f) => filledKeys.has(f.key))
    .map((f) => ({ key: f.key, score: scoreFieldForFingerprint(f) }))
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, maxKeys).map((s) => s.key);
}

export function extractBrandModelVariant(attributes: Record<string, string>): {
  brand: string | null;
  model: string | null;
  variant: string | null;
  condition: string | null;
} {
  let brand =
    BRAND_KEYS.map((k) => attributes[k]).find((v) => v?.trim())?.trim() ?? null;

  let model =
    MODEL_KEYS.map((k) => attributes[k]).find((v) => v?.trim())?.trim() ?? null;

  if (!model) {
    const typeField = Object.entries(attributes).find(
      ([key, val]) =>
        val?.trim() &&
        TYPE_SUFFIX.test(key) &&
        !SKIP_TYPE_KEYS.has(key) &&
        key !== "propertyType",
    );
    model = typeField?.[1]?.trim() ?? null;
  }

  const variant =
    VARIANT_KEYS.map((k) => attributes[k]).find((v) => v?.trim())?.trim() ?? null;

  const condition = attributes.condition?.trim() ?? null;

  if (model && !brand) {
    const parsed = splitProductNameString(model);
    if (parsed.brand && !brand) brand = parsed.brand;
    if (parsed.model) model = parsed.model;
  } else if (model && brand) {
    const parsed = splitProductNameString(model);
    if (parsed.brand && !brand) brand = parsed.brand;
    if (parsed.model && parsed.model !== model) model = parsed.model;
  }

  return { brand, model, variant, condition };
}

export function deriveProviderProfile(category: RequestCategory): CategoryProviderProfile {
  const keys = new Set(category.fields.map((f) => f.key));

  let shopping = 0.25;
  let realEstate = 0.1;
  let internal = 0.45;

  if (keys.has("brand") || keys.has("brandPreference")) shopping += 0.25;
  if (keys.has("model") || keys.has("productName")) shopping += 0.2;
  if (keys.has("solutionType") || keys.has("specs")) shopping += 0.2;
  if (keys.has("applianceType") || keys.has("kitchenProductType") || keys.has("babyProductType")) {
    shopping += 0.15;
  }
  if (keys.has("energyClass") || keys.has("specs")) shopping += 0.1;

  if (keys.has("listingType") && keys.has("propertyType")) {
    realEstate += 0.75;
    shopping = Math.max(0.05, shopping - 0.25);
  }

  if (keys.has("serviceType") && !keys.has("brand") && !keys.has("brandPreference")) {
    shopping = 0.05;
    internal = 0.9;
  }

  if (keys.has("dimensions") && (keys.has("printType") || keys.has("lamination"))) {
    shopping = Math.min(shopping, 0.15);
    internal = Math.max(internal, 0.75);
  }

  if (keys.has("machineType") && keys.has("capacity")) {
    shopping = Math.min(shopping, 0.35);
    internal = Math.max(internal, 0.65);
  }

  shopping = Math.min(1, Math.max(0, shopping));
  realEstate = Math.min(1, Math.max(0, realEstate));
  internal = Math.min(1, Math.max(0, internal));

  let primaryRoute: CategoryProviderProfile["primaryRoute"] = "internal";
  if (realEstate >= 0.6) primaryRoute = "real_estate";
  else if (keys.has("machineType")) primaryRoute = "machinery";
  else if (shopping >= 0.5) primaryRoute = "shopping";

  return { shopping, realEstate, internal, primaryRoute };
}

export function getProviderProfile(categorySlug: string): CategoryProviderProfile {
  return deriveProviderProfile(getCategoryById(categorySlug));
}

export function supportsExternalProvider(
  categorySlug: string,
  route: CategoryProviderProfile["primaryRoute"],
): number {
  const profile = getProviderProfile(categorySlug);
  switch (route) {
    case "shopping":
      return profile.shopping;
    case "real_estate":
      return profile.realEstate;
    case "machinery":
      return profile.shopping * 0.4 + profile.internal * 0.6;
    case "internal":
      return profile.internal;
    default:
      return 0;
  }
}

/** Build a provider search query from normalized request data — no fake filler */
export function buildProviderSearchQuery(input: {
  categorySlug: string;
  title: string;
  attributes?: Record<string, string>;
  city?: string | null;
  district?: string | null;
}): string {
  const attributes = input.attributes ?? {};
  const { brand, model, variant } = extractBrandModelVariant(attributes);
  const fingerprintKeys = selectFingerprintFieldKeys(input.categorySlug, attributes, 4);

  const parts: string[] = [];

  if (brand && model) {
    parts.push(`${brand} ${model}`);
  } else if (input.title?.trim()) {
    parts.push(input.title.trim());
  }

  if (variant && !parts.join(" ").includes(variant)) {
    parts.push(variant);
  }

  for (const key of fingerprintKeys) {
    if (!isQueryRelevantField(key)) continue;
    const val = attributes[key]?.trim();
    if (!val) continue;
    if (parts.join(" ").toLocaleLowerCase("tr-TR").includes(val.toLocaleLowerCase("tr-TR"))) {
      continue;
    }
    parts.push(val);
  }

  if (input.categorySlug === "real-estate" && input.city) {
    parts.push(input.city);
    if (input.district) parts.push(input.district);
  }

  return parts.filter(Boolean).join(" ").trim();
}

export function computeNormalizationConfidence(input: {
  categorySlug: string;
  attributes: Record<string, string>;
  fingerprintKeyCount: number;
}): number {
  const filledCount = Object.values(input.attributes).filter((v) => v?.trim()).length;
  const category = getCategoryById(input.categorySlug);
  const maxFields = Math.max(1, category.fields.length);

  let confidence = 0.15;
  confidence += Math.min(0.35, (filledCount / maxFields) * 0.35);
  confidence += Math.min(0.3, input.fingerprintKeyCount * 0.05);

  const { brand, model } = extractBrandModelVariant(input.attributes);
  if (brand) confidence += 0.1;
  if (model) confidence += 0.1;

  return Math.min(1, Math.round(confidence * 100) / 100);
}

export { REQUEST_CATEGORIES };
