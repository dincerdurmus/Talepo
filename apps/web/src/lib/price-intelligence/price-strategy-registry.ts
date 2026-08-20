/**
 * Code-first price strategy registry.
 *
 * IMPORTANT: Strategy ≠ Category.
 * Providers will bind to CAPABILITY + STRATEGY in future phases — never to category slug alone.
 * New Talepo categories should resolve via semantic fields + needType; unknown slugs fall back safely.
 */

import type { SemanticFieldClass } from "@/lib/product-identity/types";

/** Generic price intelligence strategy keys — not a closed brand/category list */
export type PriceStrategyKey =
  | "RETAIL_PRODUCT"
  | "USED_PRODUCT"
  | "VEHICLE"
  | "AUTO_PART"
  | "REAL_ESTATE_SALE"
  | "REAL_ESTATE_RENT"
  | "INDUSTRIAL_EQUIPMENT"
  | "INDUSTRIAL_PARTS_SERVICE"
  | "CUSTOM_MANUFACTURING"
  | "SERVICE_SCOPE"
  | "B2B_COMMODITY"
  | "MEDICAL_DEVICE"
  | "INTERNAL_ONLY"
  | "UNKNOWN";

export type StrategyAttributeProfile = {
  strategy: PriceStrategyKey;
  /** Field keys or semantic classes expected for completeness scoring (future UX) */
  required: string[];
  important: string[];
  optional: string[];
  /** Keys/classes excluded from external provider queries */
  ignoredForExternalQuery: string[];
};

/**
 * Semantic field classes used in attribute profiles (resolved via semantic-fields.ts).
 * Field keys from request forms are matched when present in attributes.
 */
const SEM = {
  brand: "brand-like",
  model: "model-like",
  series: "series-like",
  variant: "variant-like",
  storage: "storage-like",
  capacity: "capacity-like",
  condition: "condition-like",
  year: "year-like",
  size: "size-like",
  productType: "product-type-like",
  partType: "part-type-like",
} as const satisfies Record<string, SemanticFieldClass>;

/** Attribute profiles — registry/config, not category form logic */
export const STRATEGY_ATTRIBUTE_PROFILES: Record<PriceStrategyKey, StrategyAttributeProfile> = {
  RETAIL_PRODUCT: {
    strategy: "RETAIL_PRODUCT",
    required: ["brand-like", "model-like"],
    important: ["solutionType", "productName", "specs", "storage-like", "variant-like", "condition-like"],
    optional: ["energy-like", "gtin-like", "sku-like"],
    ignoredForExternalQuery: ["needType", "serviceType", "listingType", "quantity"],
  },
  USED_PRODUCT: {
    strategy: "USED_PRODUCT",
    required: ["brand-like", "condition-like"],
    important: ["model-like", "solutionType", "specs", "storage-like", "year-like"],
    optional: ["variant-like", "capacity-like"],
    ignoredForExternalQuery: ["needType", "serviceType", "listingType"],
  },
  VEHICLE: {
    strategy: "VEHICLE",
    required: ["brand", "model", "modelYear"],
    important: ["engine", "fuel", "transmission", "trim", "mileage", "condition-like"],
    optional: ["bodyCondition", "variant-like"],
    ignoredForExternalQuery: ["part", "serviceType"],
  },
  AUTO_PART: {
    strategy: "AUTO_PART",
    required: ["part", "brand-like"],
    important: ["partPreference", "model-like", "modelYear", "engine", "part-type-like"],
    optional: ["condition-like", "sku-like"],
    ignoredForExternalQuery: ["serviceType", "listingType"],
  },
  REAL_ESTATE_SALE: {
    strategy: "REAL_ESTATE_SALE",
    required: ["listingType", "city"],
    important: ["propertyType", "roomCount", "area", "buildingAge", "floor", "neighborhoods"],
    optional: ["location", "budget"],
    ignoredForExternalQuery: ["brand-like", "model-like", "solutionType"],
  },
  REAL_ESTATE_RENT: {
    strategy: "REAL_ESTATE_RENT",
    required: ["listingType", "city"],
    important: ["propertyType", "roomCount", "area", "floor", "neighborhoods"],
    optional: ["location", "budget", "buildingAge"],
    ignoredForExternalQuery: ["brand-like", "model-like", "solutionType"],
  },
  INDUSTRIAL_EQUIPMENT: {
    strategy: "INDUSTRIAL_EQUIPMENT",
    required: ["brand", "model"],
    important: ["machineType", "specs", "condition-like", "modelYear", "capacity-like"],
    optional: ["power", "year-like"],
    ignoredForExternalQuery: ["serviceType"],
  },
  INDUSTRIAL_PARTS_SERVICE: {
    strategy: "INDUSTRIAL_PARTS_SERVICE",
    required: ["serviceType"],
    important: ["machineType", "brand", "model", "part"],
    optional: ["condition-like", "city"],
    ignoredForExternalQuery: ["listingType"],
  },
  CUSTOM_MANUFACTURING: {
    strategy: "CUSTOM_MANUFACTURING",
    required: ["dimensions", "quantity"],
    important: ["material", "printType", "paperWeight", "finishing", "lamination"],
    optional: ["city", "delivery", "budget"],
    ignoredForExternalQuery: ["brand-like", "model-like"],
  },
  SERVICE_SCOPE: {
    strategy: "SERVICE_SCOPE",
    required: ["serviceType"],
    important: ["serviceLocation", "city", "duration", "frequency", "area"],
    optional: ["materialsIncluded", "deadline", "budget"],
    ignoredForExternalQuery: ["brand-like", "model-like", "solutionType"],
  },
  B2B_COMMODITY: {
    strategy: "B2B_COMMODITY",
    required: ["quantity"],
    important: ["specs", "dimensions", "material", "furnitureType", "applianceType"],
    optional: ["city", "delivery", "budget", "brand", "brandPreference"],
    ignoredForExternalQuery: ["needType"],
  },
  MEDICAL_DEVICE: {
    strategy: "MEDICAL_DEVICE",
    required: ["healthProductType", "productName"],
    important: ["brand", "model-like", "specs", "condition-like", "usageArea"],
    optional: ["quantity", "certification"],
    ignoredForExternalQuery: ["serviceType"],
  },
  INTERNAL_ONLY: {
    strategy: "INTERNAL_ONLY",
    required: [],
    important: [],
    optional: ["city", "budget"],
    ignoredForExternalQuery: ["*"],
  },
  UNKNOWN: {
    strategy: "UNKNOWN",
    required: [],
    important: [],
    optional: [],
    ignoredForExternalQuery: [],
  },
};

/**
 * Weak default strategy hints when explicit intent is absent.
 * Category slug is NEVER authoritative — only a fallback signal.
 */
export const CATEGORY_STRATEGY_HINTS: Partial<Record<string, PriceStrategyKey>> = {
  "real-estate": "REAL_ESTATE_SALE",
  services: "SERVICE_SCOPE",
  printing: "CUSTOM_MANUFACTURING",
  machinery: "INDUSTRIAL_EQUIPMENT",
  automotive: "VEHICLE",
  health: "MEDICAL_DEVICE",
};

export function getStrategyAttributeProfile(strategy: PriceStrategyKey): StrategyAttributeProfile {
  return STRATEGY_ATTRIBUTE_PROFILES[strategy];
}

export function listImplementedStrategies(): PriceStrategyKey[] {
  return Object.keys(STRATEGY_ATTRIBUTE_PROFILES) as PriceStrategyKey[];
}

export { SEM as STRATEGY_SEMANTIC_CLASSES };
