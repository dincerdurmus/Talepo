/**
 * SupplierCapabilityProfile — built only from provided signals.
 * categoryDbIds and categorySlugs stay separate namespaces.
 * Coverage defaults to unknown/partial — never auto-exhaustive.
 */

import type {
  BrandModelPair,
  CapabilityCoverage,
  SupplierCapabilityProfile,
} from "./types";
import { foldText, uniqueStrings } from "./text";

export type SupplierCapabilityInput = {
  companyId: string;
  label?: string;
  categoryDbIds?: string[];
  categorySlugs?: string[];
  /** @deprecated prefer categoryDbIds */
  categoryIds?: string[];
  taxonomyNodeIds?: string[];
  products?: string[];
  brands?: string[];
  models?: string[];
  families?: string[];
  brandModelPairs?: BrandModelPair[];
  brandCoverage?: CapabilityCoverage;
  modelCoverage?: CapabilityCoverage;
  productCoverage?: CapabilityCoverage;
  cities?: string[];
  districts?: string[];
  nationwide?: boolean;
  budgetCapability?: boolean;
  availabilityCapability?: boolean;
  aliases?: string[];
  keywords?: string[];
  inventorySignals?: SupplierCapabilityProfile["inventorySignals"];
  alertSignals?: SupplierCapabilityProfile["alertSignals"];
  savedSearchSignals?: SupplierCapabilityProfile["savedSearchSignals"];
  excluded?: SupplierCapabilityProfile["excluded"];
};

function normalizeCoverage(
  value: CapabilityCoverage | undefined,
): CapabilityCoverage {
  if (value === "exhaustive" || value === "partial" || value === "unknown") {
    return value;
  }
  return "unknown";
}

export function buildSupplierCapabilityProfile(
  input: SupplierCapabilityInput,
): SupplierCapabilityProfile {
  return buildSupplierCapabilityProfilePreserveIds(input);
}

export function buildSupplierCapabilityProfilePreserveIds(
  input: SupplierCapabilityInput,
): SupplierCapabilityProfile {
  const categoryDbIds = Array.from(
    new Set(
      [...(input.categoryDbIds ?? []), ...(input.categoryIds ?? [])]
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  );
  const categorySlugs = Array.from(
    new Set((input.categorySlugs ?? []).map((s) => s.trim()).filter(Boolean)),
  );

  const brandModelPairs = (input.brandModelPairs ?? [])
    .map((pair) => ({
      brand: foldText(pair.brand),
      model: foldText(pair.model),
      family: pair.family ? foldText(pair.family) : undefined,
    }))
    .filter((pair) => pair.brand && pair.model);

  return {
    companyId: input.companyId,
    label: input.label?.trim() || input.companyId,
    categoryDbIds,
    categorySlugs,
    taxonomyNodeIds: Array.from(
      new Set((input.taxonomyNodeIds ?? []).map((s) => s.trim()).filter(Boolean)),
    ),
    products: uniqueStrings(input.products ?? []),
    brands: uniqueStrings(input.brands ?? []),
    models: uniqueStrings(input.models ?? []),
    families: uniqueStrings(input.families ?? []),
    brandModelPairs,
    brandCoverage: normalizeCoverage(input.brandCoverage),
    modelCoverage: normalizeCoverage(input.modelCoverage),
    productCoverage: normalizeCoverage(input.productCoverage),
    cities: uniqueStrings(input.cities ?? []),
    districts: uniqueStrings(input.districts ?? []),
    nationwide: Boolean(input.nationwide),
    budgetCapability: Boolean(input.budgetCapability),
    availabilityCapability: Boolean(input.availabilityCapability),
    aliases: uniqueStrings(input.aliases ?? []),
    keywords: uniqueStrings(input.keywords ?? []),
    inventorySignals: (input.inventorySignals ?? []).map((row) => ({
      product: row.product ? foldText(row.product) : undefined,
      brand: row.brand ? foldText(row.brand) : undefined,
      model: row.model ? foldText(row.model) : undefined,
      categoryDbId: row.categoryDbId?.trim() || undefined,
      taxonomyNodeId: row.taxonomyNodeId?.trim() || undefined,
    })),
    alertSignals: input.alertSignals ?? [],
    savedSearchSignals: input.savedSearchSignals ?? [],
    excluded: {
      categoryDbIds: input.excluded?.categoryDbIds ?? [],
      categorySlugs: input.excluded?.categorySlugs ?? [],
      brands: (input.excluded?.brands ?? []).map(foldText),
      products: (input.excluded?.products ?? []).map(foldText),
      cities: (input.excluded?.cities ?? []).map(foldText),
    },
  };
}
