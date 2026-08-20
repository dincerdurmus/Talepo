/**
 * Phase 3B — Professional discovery workspace helpers.
 * Uses Phase 3A CanonicalDiscoveryFilter — no second filter schema.
 */

import {
  getTaxonomyAncestorIds,
  getTaxonomyNode,
} from "@/lib/taxonomy";
import { getCategoryById } from "@/lib/request-category-engine";
import type { SavedSearchFilters } from "@/lib/monetization/types";

import type { CanonicalDiscoveryFilter } from "./types";
import { DISCOVERY_FILTER_VERSION } from "./types";
import { hasCanonicalFilterSignal } from "./validate-filter";

export type DiscoveryReasonCode =
  | "TAXONOMY_MATCH"
  | "LOCATION_MATCH"
  | "TRACKED_CATEGORY"
  | "ATTRIBUTE_MATCH"
  | "URGENT_MATCH"
  | "LEGACY_FALLBACK"
  | "CANONICAL_MATCH";

export type DiscoveryMatchBand = "HIGH" | "MEDIUM" | "LOW";

const REASON_LABELS: Record<DiscoveryReasonCode, string> = {
  TAXONOMY_MATCH: "Takip ettiğiniz kategori / ürün grubu",
  LOCATION_MATCH: "Konum eşleşiyor",
  TRACKED_CATEGORY: "Takip ettiğiniz kategori",
  ATTRIBUTE_MATCH: "Özellikler uyumlu",
  URGENT_MATCH: "Acil talep",
  LEGACY_FALLBACK: "Genel kategori eşleşmesi",
  CANONICAL_MATCH: "Ürün grubunuzla eşleşiyor",
};

export function labelForReasonCode(code: string): string {
  return REASON_LABELS[code as DiscoveryReasonCode] ?? code;
}

/** Stable taxonomy path labels root→leaf for UI (no IDs). */
export function taxonomyPathLabels(nodeIds: string[]): string[] {
  const labels: string[] = [];
  for (const id of nodeIds) {
    const node = getTaxonomyNode(id);
    if (node?.canonicalName) labels.push(node.canonicalName);
  }
  return labels;
}

export function taxonomyPathForNode(nodeId: string): string[] {
  const ancestors = getTaxonomyAncestorIds(nodeId);
  return taxonomyPathLabels([...ancestors].reverse());
}

export function summarizeCanonicalFilter(
  filter: CanonicalDiscoveryFilter | null | undefined,
): string {
  if (!filter || !hasCanonicalFilterSignal(filter)) return "Genel keşif";
  const parts: string[] = [];

  if (filter.primaryLeafId) {
    const path = taxonomyPathForNode(filter.primaryLeafId);
    if (path.length) parts.push(path.join(" › "));
  } else if (filter.taxonomyNodeIds?.length) {
    const path = taxonomyPathForNode(filter.taxonomyNodeIds[0]!);
    if (path.length) parts.push(path.join(" › "));
  }

  if (filter.leafExact) parts.push("Yalnız bu ürün");
  if (filter.location?.city) parts.push(filter.location.city);
  if (filter.location?.district) parts.push(filter.location.district);
  if (filter.urgency) parts.push("Acil");
  if (filter.attributes) {
    for (const [k, v] of Object.entries(filter.attributes).slice(0, 3)) {
      parts.push(`${k}: ${v}`);
    }
  }
  if (filter.ranges) {
    for (const [k, r] of Object.entries(filter.ranges).slice(0, 2)) {
      if (r.min != null) parts.push(`${k} ≥ ${r.min}`);
      if (r.max != null) parts.push(`${k} ≤ ${r.max}`);
    }
  }
  return parts.length ? parts.join(" · ") : "Canonical filtre";
}

export function summarizeSavedSearchFilters(filters: SavedSearchFilters): string {
  if (filters.canonical && hasCanonicalFilterSignal(filters.canonical)) {
    const canonical = summarizeCanonicalFilter(filters.canonical);
    const extras: string[] = [];
    if (filters.city && !filters.canonical.location?.city) extras.push(filters.city);
    if (filters.urgent && !filters.canonical.urgency) extras.push("Acil");
    return extras.length ? `${canonical} · ${extras.join(" · ")}` : canonical;
  }
  const parts: string[] = [];
  if (filters.categorySlug) {
    const category = getCategoryById(filters.categorySlug);
    parts.push(
      category.id === filters.categorySlug ? category.label : filters.categorySlug,
    );
  }
  if (filters.city) parts.push(filters.city);
  if (filters.keyword) parts.push(`"${filters.keyword}"`);
  if (filters.urgent) parts.push("Acil");
  if (filters.budgetMin != null || filters.budgetMax != null) {
    parts.push(`₺${filters.budgetMin ?? "—"}–${filters.budgetMax ?? "—"}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "Genel filtre";
}

/** Follow category → SavedSearchFilters (reuse SavedSearch, no new model). */
export function followCategoryToSavedSearch(input: {
  nodeId: string;
  leafExact?: boolean;
  city?: string;
  urgent?: boolean;
  nameHint?: string;
}): SavedSearchFilters {
  const node = getTaxonomyNode(input.nodeId);
  const isLeaf = Boolean(input.leafExact);
  const filter: CanonicalDiscoveryFilter = {
    version: DISCOVERY_FILTER_VERSION,
    kind: "canonical_discovery_filter",
    taxonomyNodeIds: isLeaf ? undefined : [input.nodeId],
    primaryLeafId: isLeaf ? input.nodeId : null,
    leafExact: isLeaf || undefined,
    location: input.city ? { city: input.city } : undefined,
    urgency: input.urgent || undefined,
  };
  return {
    version: 1,
    categorySlug: node?.categoryId,
    city: input.city,
    urgent: input.urgent,
    canonical: filter,
  };
}

export function discoveryFilterToSavedSearch(
  filter: CanonicalDiscoveryFilter,
  extras?: { city?: string; urgent?: boolean; categorySlug?: string },
): SavedSearchFilters {
  const leaf = filter.primaryLeafId
    ? getTaxonomyNode(filter.primaryLeafId)
    : filter.taxonomyNodeIds?.[0]
      ? getTaxonomyNode(filter.taxonomyNodeIds[0])
      : null;
  return {
    version: 1,
    categorySlug: extras?.categorySlug ?? leaf?.categoryId,
    city: extras?.city ?? filter.location?.city,
    district: filter.location?.district,
    urgent: extras?.urgent ?? filter.urgency,
    attributes: filter.attributes,
    canonical: filter,
  };
}

export function buildCanonicalFilterFromWorkspaceParams(input: {
  taxonomyNode?: string | null;
  taxonomyLeaf?: string | null;
  leafExact?: boolean;
  city?: string | null;
  district?: string | null;
  urgent?: boolean;
  attributes?: Record<string, string>;
}): CanonicalDiscoveryFilter | null {
  const node = input.taxonomyNode?.trim() || null;
  const leaf = input.taxonomyLeaf?.trim() || null;
  if (!node && !leaf && !input.city && !input.urgent && !input.attributes) {
    return null;
  }
  const filter: CanonicalDiscoveryFilter = {
    version: DISCOVERY_FILTER_VERSION,
    kind: "canonical_discovery_filter",
  };
  if (leaf) {
    filter.primaryLeafId = leaf;
    if (input.leafExact) filter.leafExact = true;
  }
  if (node) filter.taxonomyNodeIds = [node];
  if (input.city || input.district) {
    filter.location = {
      city: input.city?.trim() || undefined,
      district: input.district?.trim() || undefined,
    };
  }
  if (input.urgent) filter.urgency = true;
  if (input.attributes && Object.keys(input.attributes).length) {
    filter.attributes = input.attributes;
  }
  return hasCanonicalFilterSignal(filter) || filter.location || filter.urgency
    ? filter
    : null;
}

/** Conservative bands — avoid fake high-precision % scores. */
export function matchBandFromSignals(input: {
  matchPath?: string | null;
  reasonCodes?: string[];
  hasTaxonomy?: boolean;
  hasLocation?: boolean;
}): DiscoveryMatchBand | null {
  const codes = new Set(input.reasonCodes ?? []);
  if (input.matchPath === "LEGACY_FALLBACK" && !input.hasTaxonomy) {
    return "LOW";
  }
  const strong =
    codes.has("TAXONOMY_MATCH") ||
    codes.has("TRACKED_CATEGORY") ||
    (input.hasTaxonomy && codes.has("CANONICAL_MATCH"));
  const location = codes.has("LOCATION_MATCH") || input.hasLocation;
  if (strong && location) return "HIGH";
  if (strong) return "MEDIUM";
  if (location) return "MEDIUM";
  return "LOW";
}

export function matchBandLabel(band: DiscoveryMatchBand | null): string | null {
  if (band === "HIGH") return "Yüksek eşleşme";
  if (band === "MEDIUM") return "Orta eşleşme";
  if (band === "LOW") return "Genel eşleşme";
  return null;
}

export function reasonCodesFromEval(reasons: string[]): DiscoveryReasonCode[] {
  const out: DiscoveryReasonCode[] = [];
  for (const r of reasons) {
    if (r === "taxonomy-ok" || r.startsWith("taxonomy")) out.push("TAXONOMY_MATCH");
    else if (r === "attributes-ok" || r.startsWith("attr-") || r.startsWith("must-"))
      out.push("ATTRIBUTE_MATCH");
    else if (r === "legacy-request-no-projection") out.push("LEGACY_FALLBACK");
    else if (r === "entity-ok") out.push("ATTRIBUTE_MATCH");
  }
  if (out.includes("TAXONOMY_MATCH") && !out.includes("CANONICAL_MATCH")) {
    out.push("CANONICAL_MATCH");
  }
  return [...new Set(out)];
}

/** Workspace URL (firsatlar) derived from canonical filter — URL is not SoT. */
export function discoveryFilterToWorkspaceUrl(
  filter: CanonicalDiscoveryFilter | null | undefined,
  extras?: { view?: string; city?: string; urgent?: boolean },
): string {
  const q = new URLSearchParams();
  q.set("view", extras?.view ?? "browse");
  if (filter?.primaryLeafId) q.set("taxonomyLeaf", filter.primaryLeafId);
  if (filter?.taxonomyNodeIds?.[0]) q.set("taxonomyNode", filter.taxonomyNodeIds[0]);
  if (filter?.leafExact) q.set("leafExact", "1");
  const city = extras?.city ?? filter?.location?.city;
  if (city) q.set("city", city);
  if (extras?.urgent || filter?.urgency) q.set("urgent", "1");
  const s = q.toString();
  return s ? `/panel/firsatlar?${s}` : "/panel/firsatlar";
}

export function defaultFollowName(nodeId: string): string {
  const path = taxonomyPathForNode(nodeId);
  return path.length ? path.join(" › ") : "Kategori takibi";
}
