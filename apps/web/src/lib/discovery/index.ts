/**
 * Phase 3A — Canonical discovery foundation.
 * Projection is a publish-time read model, not a second brain.
 */

export type {
  DiscoveryFieldMode,
  DiscoveryFieldConstraint,
  ProjectionFieldResponse,
  RequestDiscoveryProjection,
  CanonicalDiscoveryFilter,
  DiscoveryMatchPath,
  DiscoveryMatchResult,
} from "./types";

export {
  DISCOVERY_PROJECTION_VERSION,
  DISCOVERY_FILTER_VERSION,
} from "./types";

export { buildDiscoveryProjectionFromState } from "./build-projection";

export {
  validateCanonicalDiscoveryFilter,
  parseDiscoveryProjection,
  projectionAuthorityOf,
  hasCanonicalFilterSignal,
  type FilterValidationResult,
} from "./validate-filter";

export { isProjectionAuthorityKeyAllowed } from "./validate-filter";

/** Sunucu güven sınırı — istemci `fieldAuthority`'si burada yeniden türetilir. */
export {
  answerSignature,
  resolveServerFieldAuthority,
  resolveCreateProjection,
  resolveUpdateProjection,
  resolveCloneProjection,
  projectionAnswerChannel,
  type ServerFieldAuthorityInput,
  type ProjectionWriteInput,
  type CreateProjectionDecision,
} from "./server-authority";

export {
  evaluateDiscoveryFilter,
  isCandidateCompatibleWithProjection,
} from "./evaluate-filter";

export { searchTaxonomyNodes, type TaxonomySearchHit } from "./search-taxonomy";

export {
  taxonomyPathLabels,
  taxonomyPathForNode,
  summarizeCanonicalFilter,
  summarizeSavedSearchFilters,
  followCategoryToSavedSearch,
  discoveryFilterToSavedSearch,
  buildCanonicalFilterFromWorkspaceParams,
  matchBandFromSignals,
  matchBandLabel,
  reasonCodesFromEval,
  discoveryFilterToWorkspaceUrl,
  defaultFollowName,
  labelForReasonCode,
  type DiscoveryReasonCode,
  type DiscoveryMatchBand,
} from "./workspace";

/** Adapter boundary for matching engines — consume projection, do not re-parse text. */
export function matchContractFromProjection(
  projection: import("./types").RequestDiscoveryProjection | null | undefined,
) {
  return projection?.matchContract ?? null;
}

export function filterContractFromProjection(
  projection: import("./types").RequestDiscoveryProjection | null | undefined,
) {
  return projection?.filterContract ?? null;
}
