/**
 * Evidence gates — scoreBand from rawScore is NOT the final tier.
 * Uncalibrated initial rules; reasons always recorded.
 */

import type {
  FollowEvidenceLevel,
  InventoryEvidenceLevel,
  MatchTier,
  ScoreBand,
  ScoreComponentId,
} from "../types";
import {
  DEFAULT_THRESHOLD_CONFIG,
  tierFromScore,
  type ThresholdConfig,
} from "../thresholds";

const COARSE: ScoreComponentId[] = [
  "category_exact",
  "category_candidate",
  "category_ancestor",
  "location",
  "budget",
  "timing",
  "lexical",
  "attribute",
];

const IDENTITY: ScoreComponentId[] = [
  "product",
  "brand",
  "family_model",
  "taxonomy_leaf",
];

const TIER_RANK: Record<MatchTier, number> = {
  NO_MATCH: 0,
  REVIEW: 1,
  NEAR: 2,
  STRONG: 3,
  EXACT: 4,
};

function clampTier(tier: MatchTier, max: MatchTier): MatchTier {
  return TIER_RANK[tier] <= TIER_RANK[max] ? tier : max;
}

export type TierGateInput = {
  rawScore: number;
  hasConflict: boolean;
  matchedSignals: ScoreComponentId[];
  inventoryEvidence: InventoryEvidenceLevel[];
  followEvidence: FollowEvidenceLevel[];
  brandSpecified: boolean;
  modelSpecified: boolean;
  brandHit: boolean;
  modelHit: boolean;
  /** Verified inventory/declared pair only. */
  brandModelOk: boolean;
  brandSpecialistMismatch: boolean;
  partialBrandMiss: boolean;
  partialProductMiss: boolean;
  partialModelMiss: boolean;
  cartesianListHit: boolean;
  verifiedBrandModelPair: boolean;
  productHit: boolean;
  taxonomyLeafHit: boolean;
  inventoryBrandModelExact: boolean;
  config?: ThresholdConfig;
};

export type TierGateResult = {
  scoreBand: ScoreBand;
  effectiveTier: MatchTier;
  tierGateReasons: string[];
};

export function deriveEffectiveTier(input: TierGateInput): TierGateResult {
  const config = input.config ?? DEFAULT_THRESHOLD_CONFIG;
  const scoreBand = tierFromScore(
    input.rawScore,
    input.hasConflict,
    config,
  );
  const reasons: string[] = [];
  let tier = scoreBand;

  const matched = new Set(input.matchedSignals);
  const onlyCoarse =
    input.matchedSignals.length > 0 &&
    input.matchedSignals.every((s) => COARSE.includes(s));

  const hasIdentity = IDENTITY.some((s) => matched.has(s));
  const hasStrongInventory = input.inventoryEvidence.some((e) =>
    (
      [
        "inventory_product",
        "inventory_brand",
        "inventory_brand_model_exact",
      ] as InventoryEvidenceLevel[]
    ).includes(e),
  );
  const hasStrongFollow = input.followEvidence.some((e) =>
    (
      ["follow_product", "follow_brand", "follow_taxonomy_leaf"] as FollowEvidenceLevel[]
    ).includes(e),
  );

  const categoryOnly =
    input.matchedSignals.every((s) =>
      (
        [
          "category_exact",
          "category_candidate",
          "category_ancestor",
        ] as ScoreComponentId[]
      ).includes(s),
    ) && input.matchedSignals.length > 0;

  const categoryPlusContextOnly =
    onlyCoarse &&
    matched.has("category_exact") &&
    (matched.has("location") || matched.has("budget") || matched.has("timing"));

  const followCategoryOnly =
    matched.has("explicit_follow") &&
    input.followEvidence.every((e) => e === "follow_category") &&
    !hasIdentity &&
    !hasStrongInventory;

  const inventoryCategoryOnly =
    matched.has("inventory") &&
    input.inventoryEvidence.every((e) => e === "inventory_category_only") &&
    !hasIdentity &&
    !hasStrongFollow;

  const lexicalOnly =
    matched.has("lexical") &&
    input.matchedSignals.every((s) =>
      (["lexical", "attribute"] as ScoreComponentId[]).includes(s),
    );

  if (categoryOnly) {
    tier = clampTier(tier, "NEAR");
    reasons.push("gate:category_only_max_NEAR");
  }

  if (categoryPlusContextOnly) {
    tier = clampTier(tier, "NEAR");
    reasons.push("gate:category_plus_location_budget_timing_max_NEAR");
  }

  if (followCategoryOnly) {
    tier = clampTier(tier, "NEAR");
    reasons.push("gate:follow_category_only_max_NEAR");
  }

  if (inventoryCategoryOnly) {
    tier = clampTier(tier, "NEAR");
    reasons.push("gate:inventory_category_only_max_NEAR");
  }

  if (lexicalOnly || (matched.has("lexical") && !hasIdentity && !hasStrongInventory)) {
    if (TIER_RANK[tier] >= TIER_RANK.STRONG) {
      tier = clampTier(tier, "NEAR");
      reasons.push("gate:lexical_alias_cannot_be_EXACT_STRONG");
    }
  }

  if (input.brandSpecialistMismatch) {
    tier = clampTier(tier, "NEAR");
    reasons.push("gate:other_brand_specialist_max_NEAR");
  }

  // Partial / unknown capability gaps — keep candidate, cap EXACT/STRONG.
  if (input.partialBrandMiss || input.partialProductMiss || input.partialModelMiss) {
    tier = clampTier(tier, "NEAR");
    reasons.push("gate:partial_capability_miss_max_NEAR");
  }

  if (input.cartesianListHit) {
    tier = clampTier(tier, "NEAR");
    reasons.push("gate:cartesian_brand_model_not_verified_max_NEAR");
  }

  if (
    input.brandSpecified &&
    input.modelSpecified &&
    !input.verifiedBrandModelPair
  ) {
    tier = clampTier(tier, "NEAR");
    reasons.push("gate:unverified_brand_model_pair_max_NEAR");
  }

  if (input.modelSpecified && !input.brandSpecified) {
    tier = clampTier(tier, "NEAR");
    reasons.push("gate:model_without_brand_controlled_tier");
  }

  // EXACT requires verified brand-model pair (when both present) or other high-spec identity.
  if (tier === "EXACT") {
    const identityOk =
      input.verifiedBrandModelPair ||
      input.inventoryBrandModelExact ||
      (input.productHit && input.taxonomyLeafHit) ||
      (input.productHit && input.brandHit && !input.modelSpecified);
    const corroboration =
      hasStrongInventory ||
      hasStrongFollow ||
      (input.productHit && input.brandHit) ||
      (input.taxonomyLeafHit && input.productHit);

    if (input.hasConflict || !identityOk || !corroboration) {
      tier = "STRONG";
      reasons.push("gate:EXACT_requires_identity_plus_corroboration");
      if (!identityOk) reasons.push("gate:EXACT_identity_insufficient");
      if (!corroboration) reasons.push("gate:EXACT_corroboration_insufficient");
    }
  }

  // Re-apply caps after EXACT→STRONG demotion.
  if (input.partialBrandMiss || input.partialProductMiss || input.partialModelMiss) {
    tier = clampTier(tier, "NEAR");
  }
  if (input.cartesianListHit || (input.brandSpecified && input.modelSpecified && !input.verifiedBrandModelPair)) {
    tier = clampTier(tier, "NEAR");
  }

  if (tier === "STRONG") {
    const strongEvidence =
      input.productHit ||
      input.taxonomyLeafHit ||
      hasStrongInventory ||
      input.verifiedBrandModelPair ||
      (input.brandHit && input.productHit && !input.modelSpecified);
    const support =
      matched.has("category_exact") ||
      matched.has("category_candidate") ||
      hasStrongFollow ||
      input.brandHit ||
      input.productHit;

    if (!strongEvidence || !support) {
      tier = clampTier(tier, "NEAR");
      reasons.push("gate:STRONG_requires_entity_evidence_plus_support");
    }
  }

  if (reasons.length === 0 && tier !== scoreBand) {
    reasons.push(`gate:scoreBand_${scoreBand}_clamped_to_${tier}`);
  }
  if (reasons.length === 0) {
    reasons.push("gate:scoreBand_unchanged");
  }

  return { scoreBand, effectiveTier: tier, tierGateReasons: reasons };
}
