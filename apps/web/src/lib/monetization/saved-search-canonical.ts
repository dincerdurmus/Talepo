/**
 * One authority: lift legacy SavedSearchFilters.categorySlug to
 * CanonicalDiscoveryFilter via the current taxonomy registry.
 * Never invent a match-all / all-categories signal.
 */

import {
  DISCOVERY_FILTER_VERSION,
  hasCanonicalFilterSignal,
  validateCanonicalDiscoveryFilter,
  type CanonicalDiscoveryFilter,
} from "@/lib/discovery";
import { getTaxonomyNode } from "@/lib/taxonomy";

import type { SavedSearchFilters } from "./types";

export type SavedSearchCanonicalSource = {
  categorySlug?: string | null;
  categoryId?: string | null;
  canonical?: unknown;
};

function firstSlug(source: SavedSearchCanonicalSource): string {
  return (source.categorySlug ?? source.categoryId ?? "").trim();
}

/** Resolve a browse/category slug to a taxonomy node id, or null. */
export function taxonomyNodeIdFromCategorySlug(
  slug: string | null | undefined,
): string | null {
  const raw = slug?.trim();
  if (!raw) return null;
  const id = raw.startsWith("tax:") ? raw : `tax:${raw}`;
  const node = getTaxonomyNode(id);
  return node ? node.id : null;
}

function categorySlugToCanonical(
  slug: string | null | undefined,
): CanonicalDiscoveryFilter | null {
  const nodeId = taxonomyNodeIdFromCategorySlug(slug);
  if (!nodeId) return null;
  return {
    version: DISCOVERY_FILTER_VERSION,
    kind: "canonical_discovery_filter",
    taxonomyNodeIds: [nodeId],
  };
}

/**
 * Prefer an existing valid canonical signal. Otherwise lift categorySlug
 * (or categoryId when it is a taxonomy category slug) through getTaxonomyNode.
 * Invalid / unknown slugs return null — callers must skip, not match-all.
 */
export function canonicalFilterFromSavedSearchFilters(
  source: SavedSearchCanonicalSource | SavedSearchFilters | null | undefined,
): CanonicalDiscoveryFilter | null {
  if (!source) return null;

  const existing = validateCanonicalDiscoveryFilter(source.canonical);
  if (existing.ok && hasCanonicalFilterSignal(existing.filter)) {
    return existing.filter;
  }

  return categorySlugToCanonical(firstSlug(source));
}
