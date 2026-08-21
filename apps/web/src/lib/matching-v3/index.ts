export { MATCHER_VERSION, MATCHER_MODE, CALIBRATION_STATUS } from "./matcher-version";
export {
  DEFAULT_THRESHOLD_CONFIG,
  SCORE_WEIGHTS,
  TIER_THRESHOLDS,
  tierFromScore,
} from "./thresholds";
export { deriveEffectiveTier } from "./scoring/tier-gates";
export { buildRequestRoutingEnvelope } from "./routing-envelope";
export type { RoutingEnvelopeInput } from "./routing-envelope";
export {
  buildSupplierCapabilityProfile,
  buildSupplierCapabilityProfilePreserveIds,
} from "./supplier-capability-profile";
export type { SupplierCapabilityInput } from "./supplier-capability-profile";
export {
  generateCandidates,
  dedupeCandidates,
  LEXICAL_SEMANTIC_ADAPTER,
  channelPrimaryCategory,
  channelCandidateCategories,
  channelTaxonomyLeaf,
  channelTaxonomyAncestor,
  channelProductEntity,
  channelBrandModelFamily,
  channelAliasKeyword,
  channelInventory,
  channelAlertSavedSearch,
  channelLexicalSemantic,
} from "./generators/candidate-channels";
export {
  scoreCandidate,
  scoreAllComponents,
  scoreBudget,
  scoreLocation,
  scoreTiming,
  classifyInventoryEvidence,
  classifyFollowEvidence,
} from "./scoring/score-candidate";
export {
  runShadowMatch,
  compareSyntheticLegacyAndShadow,
  compareLegacyAndShadow,
  MATCH_REVIEW_QUEUE_CONTRACT,
} from "./shadow-match";
export {
  adaptDbRequestToEnvelope,
  adaptDbCompanyToProfile,
} from "./adapters/db-shaped";
export type { DbShapedRequestRow, DbShapedCompanyRow } from "./adapters/db-shaped";
export {
  DELIVERY_POLICY_CONTRACT,
  DELIVERY_POLICY_VERSION,
  buildDedupeKey,
  CURRENT_NOTIFICATION_RELIABILITY_NOTES,
} from "./contracts/delivery-policy";
export type * from "./types";
