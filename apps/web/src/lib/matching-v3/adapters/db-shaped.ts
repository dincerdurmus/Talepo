/**
 * Pure DB-shaped adapter — no Prisma queries inside relevance core.
 * Maps persisted row shapes → RequestRoutingEnvelope / SupplierCapabilityProfile.
 */

import { buildRequestRoutingEnvelope, type RoutingEnvelopeInput } from "../routing-envelope";
import {
  buildSupplierCapabilityProfilePreserveIds,
  type SupplierCapabilityInput,
} from "../supplier-capability-profile";
import type {
  RequestRoutingEnvelope,
  SupplierCapabilityProfile,
} from "../types";

/** Shape approximating Request + Category join without importing Prisma. */
export type DbShapedRequestRow = {
  id: string;
  rawInput?: string | null;
  professionalDescription?: string | null;
  title?: string | null;
  description?: string | null;
  /** Prisma Category.id */
  categoryDbId?: string | null;
  /** Category.slug */
  categorySlug?: string | null;
  city?: string | null;
  district?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  currency?: string | null;
  isUrgent?: boolean;
  deadlineAt?: string | null;
  discoveryProjection?: unknown;
  understandingSnapshot?: unknown;
  locationMode?: RoutingEnvelopeInput["locationMode"];
  budgetBasis?: RoutingEnvelopeInput["budgetBasis"];
  candidateCategorySlugs?: string[];
  taxonomyNodeIds?: string[];
  primaryLeafId?: string | null;
};

export type DbShapedCompanyRow = {
  id: string;
  label?: string;
  /** CompanyCategory.categoryId (cuid) */
  categoryDbIds?: string[];
  /** Joined Category.slug */
  categorySlugs?: string[];
  taxonomyNodeIds?: string[];
  products?: string[];
  brands?: string[];
  models?: string[];
  families?: string[];
  cities?: string[];
  districts?: string[];
  nationwide?: boolean;
  budgetCapability?: boolean;
  availabilityCapability?: boolean;
  aliases?: string[];
  keywords?: string[];
  inventorySignals?: SupplierCapabilityInput["inventorySignals"];
  alertSignals?: SupplierCapabilityInput["alertSignals"];
  savedSearchSignals?: SupplierCapabilityInput["savedSearchSignals"];
  excluded?: SupplierCapabilityInput["excluded"];
};

export function adaptDbRequestToEnvelope(
  row: DbShapedRequestRow,
): RequestRoutingEnvelope {
  return buildRequestRoutingEnvelope({
    requestId: row.id,
    rawInput: row.rawInput,
    professionalDescription: row.professionalDescription,
    title: row.title,
    description: row.description,
    categoryDbId: row.categoryDbId,
    categorySlug: row.categorySlug,
    city: row.city,
    district: row.district,
    budgetMin: row.budgetMin,
    budgetMax: row.budgetMax,
    currency: row.currency,
    isUrgent: row.isUrgent,
    deadlineAt: row.deadlineAt,
    discoveryProjection: row.discoveryProjection,
    understandingSnapshot: row.understandingSnapshot,
    locationMode: row.locationMode,
    budgetBasis: row.budgetBasis,
    candidateCategorySlugs: row.candidateCategorySlugs,
    taxonomyNodeIds: row.taxonomyNodeIds,
    primaryLeafId: row.primaryLeafId,
  });
}

export function adaptDbCompanyToProfile(
  row: DbShapedCompanyRow & {
    brandModelPairs?: SupplierCapabilityProfile["brandModelPairs"];
    brandCoverage?: SupplierCapabilityProfile["brandCoverage"];
    modelCoverage?: SupplierCapabilityProfile["modelCoverage"];
    productCoverage?: SupplierCapabilityProfile["productCoverage"];
  },
): SupplierCapabilityProfile {
  return buildSupplierCapabilityProfilePreserveIds({
    companyId: row.id,
    label: row.label,
    categoryDbIds: row.categoryDbIds,
    categorySlugs: row.categorySlugs,
    taxonomyNodeIds: row.taxonomyNodeIds,
    products: row.products,
    brands: row.brands,
    models: row.models,
    families: row.families,
    brandModelPairs: row.brandModelPairs,
    brandCoverage: row.brandCoverage,
    modelCoverage: row.modelCoverage,
    productCoverage: row.productCoverage,
    cities: row.cities,
    districts: row.districts,
    nationwide: row.nationwide,
    budgetCapability: row.budgetCapability,
    availabilityCapability: row.availabilityCapability,
    aliases: row.aliases,
    keywords: row.keywords,
    inventorySignals: row.inventorySignals,
    alertSignals: row.alertSignals,
    savedSearchSignals: row.savedSearchSignals,
    excluded: row.excluded,
  });
}
