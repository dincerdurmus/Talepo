/**
 * Matching v3 — shadow relevance types.
 * Plan/entitlement must never appear in relevance scoring inputs.
 */

import type {
  CategoryResolutionStatus,
  CategoryUserChoice,
} from "@/lib/request/understanding-snapshot";
import type { MATCHER_VERSION } from "./matcher-version";

export type MatchTier =
  | "EXACT"
  | "STRONG"
  | "NEAR"
  | "REVIEW"
  | "NO_MATCH";

export type ScoreBand = MatchTier;

export type CandidateChannel =
  | "primary_category"
  | "candidate_categories"
  | "taxonomy_leaf"
  | "taxonomy_ancestor"
  | "product_entity"
  | "brand_model_family"
  | "alias_keyword"
  | "inventory"
  | "alert_saved_search"
  | "lexical_semantic";

export type LocationStatus =
  | "city_district"
  | "city_only"
  | "nationwide"
  | "remote"
  | "unknown";

export type BudgetStatus = "range" | "soft" | "unknown";

export type BudgetBasis = "total" | "monthly" | "daily" | "unknown";

export type EvidenceItem = {
  signal: string;
  detail: string;
  weight?: number;
};

/** Leveled inventory / follow evidence — category-only ≠ entity expertise. */
export type InventoryEvidenceLevel =
  | "inventory_category_only"
  | "inventory_product"
  | "inventory_brand"
  | "inventory_brand_model_exact";

export type FollowEvidenceLevel =
  | "follow_category"
  | "follow_product"
  | "follow_brand"
  | "follow_taxonomy_leaf";

export type RequestRoutingEnvelope = {
  requestId: string;
  rawInput: string;
  professionalDescription: string | null;
  categoryResolution: {
    status: CategoryResolutionStatus;
    userSelected: boolean;
    userChoice: CategoryUserChoice;
    /** Prisma Category.id (cuid) — never confuse with slug. */
    primaryCategoryDbId: string | null;
    /** Stable category slug e.g. baby, technology. */
    primaryCategorySlug: string | null;
    candidateCategorySlugs: string[];
    taxonomyNodeIds: string[];
    primaryLeafId: string | null;
    ancestors: string[];
  };
  product: string | null;
  brand: string | null;
  family: string | null;
  series: string | null;
  model: string | null;
  variant: string | null;
  attributes: Record<string, string>;
  unresolvedExpressions: string[];
  location: {
    status: LocationStatus;
    city: string | null;
    district: string | null;
    nationwide: boolean;
    remote: boolean;
  };
  budget: {
    status: BudgetStatus;
    min: number | null;
    max: number | null;
    currency: string | null;
    basis: BudgetBasis;
  };
  quantity: { value: number | null; unit: string | null };
  timing: { urgency: boolean; deadlineAt: string | null };
  confidence: {
    category: number | null;
    overall: number | null;
  };
  evidence: EvidenceItem[];
  understandingVersion: string | null;
  profileVersion: string | null;
  discoveryProjectionPresent: boolean;
};

export type CapabilityCoverage = "unknown" | "partial" | "exhaustive";

export type BrandModelPair = {
  brand: string;
  model: string;
  family?: string;
};

export type SupplierCapabilityProfile = {
  companyId: string;
  /** Display/debug only — never PII from production fixtures. */
  label: string;
  /** Prisma CompanyCategory.categoryId values (cuid). */
  categoryDbIds: string[];
  /** Category.slug values. */
  categorySlugs: string[];
  taxonomyNodeIds: string[];
  products: string[];
  brands: string[];
  models: string[];
  families: string[];
  /**
   * Verified brand↔model relationships. Cartesian brands[]×models[] is NOT proof.
   */
  brandModelPairs: BrandModelPair[];
  /** Default unknown/partial — never auto-exhaustive. */
  brandCoverage: CapabilityCoverage;
  modelCoverage: CapabilityCoverage;
  productCoverage: CapabilityCoverage;
  cities: string[];
  districts: string[];
  nationwide: boolean;
  /** Supplier declares budget-band capability (rare). Absent → no budget points. */
  budgetCapability: boolean;
  /** Supplier declares urgency/availability SLA signal. Absent → no timing points. */
  availabilityCapability: boolean;
  aliases: string[];
  keywords: string[];
  inventorySignals: Array<{
    product?: string;
    brand?: string;
    model?: string;
    /** Category DB id on inventory row when known. */
    categoryDbId?: string;
    taxonomyNodeId?: string;
  }>;
  alertSignals: Array<{
    categoryDbIds?: string[];
    categorySlugs?: string[];
    taxonomyNodeIds?: string[];
    brands?: string[];
    products?: string[];
    keywords?: string[];
  }>;
  savedSearchSignals: Array<{
    categoryDbIds?: string[];
    categorySlugs?: string[];
    taxonomyNodeIds?: string[];
    brands?: string[];
    products?: string[];
    keywords?: string[];
  }>;
  excluded: {
    categoryDbIds?: string[];
    categorySlugs?: string[];
    brands?: string[];
    products?: string[];
    cities?: string[];
  };
};

export type GeneratedCandidate = {
  companyId: string;
  channels: CandidateChannel[];
};

export type ScoreComponentId =
  | "category_exact"
  | "category_ancestor"
  | "category_candidate"
  | "taxonomy_leaf"
  | "product"
  | "brand"
  | "family_model"
  | "attribute"
  | "inventory"
  | "explicit_follow"
  | "location"
  | "budget"
  | "timing"
  | "lexical"
  | "negative_conflict";

export type ScoreComponent = {
  id: ScoreComponentId;
  points: number;
  matched: boolean;
  reason: string | null;
  evidence: EvidenceItem[];
};

export type MatchResult = {
  companyId: string;
  /** Sum of component points before tier gates. */
  rawScore: number;
  /** Score-band implied by rawScore alone (not final). */
  scoreBand: ScoreBand;
  /** Final tier after evidence gates. */
  effectiveTier: MatchTier;
  /** @deprecated alias of effectiveTier for older call sites */
  tier: MatchTier;
  /** @deprecated alias of rawScore */
  totalScore: number;
  tierGateReasons: string[];
  matchedSignals: ScoreComponentId[];
  inventoryEvidence: InventoryEvidenceLevel[];
  followEvidence: FollowEvidenceLevel[];
  reasons: string[];
  conflicts: string[];
  evidence: EvidenceItem[];
  channels: CandidateChannel[];
  components: ScoreComponent[];
  matcherVersion: typeof MATCHER_VERSION | string;
};

export type ZeroMatchOutcome = {
  candidateCount: 0;
  reviewRequired: true;
  replayRecommended: true;
  tier: "REVIEW";
  reasons: string[];
  missingSignals: string[];
  matcherVersion: typeof MATCHER_VERSION | string;
};

export type ShadowMatchReport = {
  mode: "shadow";
  matcherVersion: string;
  calibrationStatus: "uncalibrated";
  requestId: string;
  envelope: RequestRoutingEnvelope;
  candidates: MatchResult[];
  zeroMatch: ZeroMatchOutcome | null;
  /** Candidates exist but outcome is uncertain — distinct from zeroMatch. */
  reviewRequired: boolean;
  reviewReasons: string[];
  replayRecommended: boolean;
  notificationsEmitted: false;
  planUsedInRelevance: false;
  productionShadowComparison: "not_wired";
};

export type SyntheticLegacyComparison = {
  kind: "syntheticLegacyComparison";
  productionShadowComparison: "not_wired";
  requestId: string;
  legacyCandidateCount: number;
  shadowCandidateCount: number;
  intersection: string[];
  legacyOnly: string[];
  shadowOnly: string[];
  byTier: Record<MatchTier, string[]>;
  zeroMatch: boolean;
  entityRescued: string[];
  precisionRiskNotes: string[];
  matchReasons: Record<string, string[]>;
};

/** @deprecated use SyntheticLegacyComparison */
export type LegacyShadowComparison = SyntheticLegacyComparison;
