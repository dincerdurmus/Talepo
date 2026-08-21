/**
 * Phase 3A — Request discovery projection (publish-time read model).
 * Not a second request authority — built from Single Brain + CanonicalRequestState.
 */

import type {
  ConstraintFilterContract,
  ConstraintMatchContract,
  ConstraintStrength,
} from "@/lib/request-understanding/constraint-semantics";
import type { RequestUnderstandingSnapshot } from "@/lib/request/understanding-snapshot";

export const DISCOVERY_PROJECTION_VERSION = 1 as const;
export const DISCOVERY_FILTER_VERSION = 1 as const;

export type DiscoveryFieldMode = "VALUE" | "ANY" | "UNKNOWN";

export type DiscoveryFieldConstraint = {
  mode?: DiscoveryFieldMode;
  value?: string | null;
  include?: string[];
  preferred?: string[];
  excluded?: string[];
  strength?: ConstraintStrength;
  range?: { min?: number; max?: number; unit?: string };
};

/**
 * Stabil seller-facing projection persisted on Request.
 * Source of truth remains understandRequest() / CanonicalRequestState at publish.
 */
export type RequestDiscoveryProjection = {
  version: typeof DISCOVERY_PROJECTION_VERSION;
  kind: "discovery_projection";
  /** Full ancestor chain + leaf (stable taxonomy IDs). */
  taxonomyNodeIds: string[];
  primaryLeafId: string | null;
  categoryId: string | null;
  subcategorySlug: string | null;
  /** Optional catalog/entity refs (automotive-heavy). */
  entityRefs?: Record<string, string>;
  /** Normalized attribute bag for filtering. */
  attributes: Record<string, string>;
  /** Field-scoped constraint semantics (Phase 2). */
  constraints: Record<string, DiscoveryFieldConstraint>;
  /** Reuse Phase 2 match contract shape. */
  matchContract: ConstraintMatchContract;
  /** Reuse Phase 2 filter contract shape. */
  filterContract: ConstraintFilterContract;
  builtAt: string;
  /**
   * Phase 1 — publish-time understanding audit snapshot.
   * Optional; matching/filter evaluators must ignore this block.
   */
  understanding?: RequestUnderstandingSnapshot;
};

/**
 * Typed filter for SavedSearch / Alert / Explore (versioned).
 * Legacy flat fields remain for backward compatibility.
 */
export type CanonicalDiscoveryFilter = {
  version: typeof DISCOVERY_FILTER_VERSION;
  kind: "canonical_discovery_filter";
  /** Match requests whose path includes this node (ancestor semantics). */
  taxonomyNodeIds?: string[];
  /** Exact leaf only — siblings excluded. */
  primaryLeafId?: string | null;
  leafExact?: boolean;
  entityRefs?: Record<string, string>;
  attributes?: Record<string, string>;
  /** From toConstraintFilterContract — preferred is NOT hard reject. */
  constraints?: ConstraintFilterContract;
  /** Hard includes from MUST / allowed sets. */
  mustIncludes?: Record<string, string[]>;
  excluded?: Record<string, string[]>;
  preferred?: Record<string, string[]>;
  ranges?: Record<string, { min?: number; max?: number; unit?: string }>;
  location?: { city?: string; district?: string };
  urgency?: boolean;
};

export type DiscoveryMatchPath = "CANONICAL_MATCH" | "LEGACY_FALLBACK";

export type DiscoveryMatchResult = {
  match: boolean;
  path: DiscoveryMatchPath;
  reasons: string[];
};
