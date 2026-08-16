import { canonicalFilterFromSavedSearchFilters } from "@/lib/monetization/saved-search-canonical";
import type { SavedSearchFilters } from "@/lib/monetization/types";

/** Build /panel/talepler URL from a saved search filter payload. */
export function savedSearchToExploreUrl(filters: SavedSearchFilters): string {
  const q = new URLSearchParams();

  if (filters.categorySlug) {
    q.set("tab", "all");
    q.set("category", filters.categorySlug);
  } else if (filters.categoryId) {
    q.set("tab", "all");
    q.set("category", filters.categoryId);
  } else {
    q.set("tab", "matched");
  }

  if (filters.city?.trim()) q.set("city", filters.city.trim());
  if (filters.district?.trim()) q.set("district", filters.district.trim());
  if (filters.keyword?.trim()) q.set("q", filters.keyword.trim());
  if (filters.budgetMin != null) q.set("budgetMin", String(filters.budgetMin));
  if (filters.budgetMax != null) q.set("budgetMax", String(filters.budgetMax));
  if (filters.urgent) q.set("urgent", "1");

  if (filters.createdAfter) {
    const created = new Date(filters.createdAfter);
    const days = Math.ceil((Date.now() - created.getTime()) / 86400000);
    if (days > 0 && days <= 90) q.set("since", String(days));
  }

  if (filters.attributes) {
    for (const [key, value] of Object.entries(filters.attributes)) {
      if (value !== "" && value != null) q.set(key, String(value));
    }
  }

  // Phase 3A — surface canonical taxonomy filter in URL (derived)
  const leaf = filters.canonical?.primaryLeafId;
  const nodes = filters.canonical?.taxonomyNodeIds;
  if (leaf) q.set("taxonomyLeaf", leaf);
  if (nodes?.length) q.set("taxonomyNode", nodes[0]!);
  if (filters.canonical?.leafExact) q.set("leafExact", "1");

  const s = q.toString();
  return s ? `/panel/talepler?${s}` : "/panel/talepler";
}

/** Serialize current explore filter state into SavedSearchFilters. */
export function exploreFiltersToSavedSearch(input: {
  categorySlug?: string;
  city?: string;
  district?: string;
  keyword?: string;
  budgetMin?: number | null;
  budgetMax?: number | null;
  urgentOnly?: boolean;
  sinceDays?: number | null;
  fieldParams?: Record<string, string>;
  taxonomyLeaf?: string;
  taxonomyNode?: string;
  leafExact?: boolean;
}): SavedSearchFilters {
  const filters: SavedSearchFilters = { version: 1 };

  if (input.categorySlug) filters.categorySlug = input.categorySlug;
  if (input.city?.trim()) filters.city = input.city.trim();
  if (input.district?.trim()) filters.district = input.district.trim();
  if (input.keyword?.trim()) filters.keyword = input.keyword.trim();
  if (input.budgetMin != null) filters.budgetMin = input.budgetMin;
  if (input.budgetMax != null) filters.budgetMax = input.budgetMax;
  if (input.urgentOnly) filters.urgent = true;

  if (input.sinceDays != null && input.sinceDays > 0) {
    const from = new Date(Date.now() - input.sinceDays * 86400000);
    filters.createdAfter = from.toISOString();
  }

  if (input.fieldParams && Object.keys(input.fieldParams).length > 0) {
    filters.attributes = input.fieldParams;
  }

  if (input.taxonomyLeaf || input.taxonomyNode) {
    filters.canonical = {
      version: 1,
      kind: "canonical_discovery_filter",
      primaryLeafId: input.taxonomyLeaf ?? null,
      taxonomyNodeIds: input.taxonomyNode ? [input.taxonomyNode] : undefined,
      leafExact: input.leafExact || undefined,
    };
  }

  const resolved = canonicalFilterFromSavedSearchFilters(filters);
  if (resolved) filters.canonical = resolved;

  return filters;
}
