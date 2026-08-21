/**
 * User-facing Follow (Takip) projection.
 * SavedSearch is the primary record; AlertRule is notification state.
 * Does not invent a second criteria schema — fingerprints come from
 * preference-criteria.ts.
 */

import { summarizeSavedSearchFilters } from "@/lib/discovery";
import { getCategoryById } from "@/lib/request-category-engine";
import { savedSearchToExploreUrl } from "@/lib/monetization/saved-search-url";
import type { SavedSearchFilters } from "@/lib/monetization/types";
import { getTaxonomyNode } from "@/lib/taxonomy";

import { preferenceCriteriaFingerprint } from "./preference-criteria";

export type FollowTrack = {
  id: string;
  name: string;
  summary: string;
  filters: SavedSearchFilters;
  criteriaFingerprint: string;
  savedSearchId: string | null;
  alertRuleId: string | null;
  notificationsOn: boolean;
  runUrl: string;
  categorySlug: string | null;
  categoryLabel: string | null;
};

export type FollowTrackSearchInput = {
  id: string;
  name: string;
  filters: SavedSearchFilters;
  updatedAt?: Date | string;
};

export type FollowTrackAlertInput = {
  id: string;
  name: string;
  isActive: boolean;
  criteria: SavedSearchFilters;
  updatedAt?: Date | string;
};

function stamp(value: Date | string | undefined): number {
  if (!value) return 0;
  const t = typeof value === "string" ? Date.parse(value) : value.getTime();
  return Number.isFinite(t) ? t : 0;
}

function resolveFollowCategory(filters: SavedSearchFilters): {
  categorySlug: string | null;
  categoryLabel: string | null;
} {
  const fromCanonical = filters.canonical?.primaryLeafId
    ? getTaxonomyNode(filters.canonical.primaryLeafId)?.categoryId
    : filters.canonical?.taxonomyNodeIds?.[0]
      ? getTaxonomyNode(filters.canonical.taxonomyNodeIds[0])?.categoryId
      : null;
  const slug =
    (filters.categorySlug ?? filters.categoryId ?? fromCanonical ?? "").trim() ||
    null;
  if (!slug) return { categorySlug: null, categoryLabel: null };
  const category = getCategoryById(slug);
  return {
    categorySlug: slug,
    categoryLabel:
      category && category.id === slug ? category.label : null,
  };
}

function formatBudgetChip(
  min: number | null | undefined,
  max: number | null | undefined,
): string | null {
  if (min == null && max == null) return null;
  const fmt = (n: number) =>
    n.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
  if (min != null && max != null) return `₺${fmt(min)}–₺${fmt(max)}`;
  if (min != null) return `₺${fmt(min)}+`;
  return `₺${fmt(max!)}'e kadar`;
}

/** Human-readable criterion chips from real filter fields only. */
export function followCriteriaChips(
  filters: SavedSearchFilters,
  limit = 4,
): { chips: string[]; overflow: number } {
  const chips: string[] = [];

  const city =
    filters.city?.trim() || filters.canonical?.location?.city?.trim();
  if (city) chips.push(city);

  const budget = formatBudgetChip(
    filters.budgetMin ?? null,
    filters.budgetMax ?? null,
  );
  if (budget) chips.push(budget);

  const keyword = filters.keyword?.trim();
  if (keyword) chips.push(`“${keyword}”`);

  if (filters.urgent || filters.canonical?.urgency) chips.push("Acil");

  if (chips.length <= limit) return { chips, overflow: 0 };
  return {
    chips: chips.slice(0, limit),
    overflow: chips.length - limit,
  };
}

function toTrack(input: {
  id: string;
  name: string;
  filters: SavedSearchFilters;
  savedSearchId: string | null;
  alertRuleId: string | null;
  notificationsOn: boolean;
  fingerprint: string;
}): FollowTrack {
  const category = resolveFollowCategory(input.filters);
  return {
    id: input.id,
    name: input.name,
    summary: summarizeSavedSearchFilters(input.filters),
    filters: input.filters,
    criteriaFingerprint: input.fingerprint,
    savedSearchId: input.savedSearchId,
    alertRuleId: input.alertRuleId,
    notificationsOn: input.notificationsOn,
    runUrl: savedSearchToExploreUrl(input.filters),
    categorySlug: category.categorySlug,
    categoryLabel: category.categoryLabel,
  };
}

/**
 * Merge SavedSearch + AlertRule rows into one card per criteria fingerprint.
 * Unmatched AlertRules become follow cards so legacy notification-only
 * records are not dropped.
 */
export function projectFollowTracks(
  searches: readonly FollowTrackSearchInput[],
  alerts: readonly FollowTrackAlertInput[],
): FollowTrack[] {
  const alertsByFingerprint = new Map<string, FollowTrackAlertInput[]>();
  for (const alert of alerts) {
    const fingerprint = preferenceCriteriaFingerprint(alert.criteria);
    const list = alertsByFingerprint.get(fingerprint) ?? [];
    list.push(alert);
    alertsByFingerprint.set(fingerprint, list);
  }

  const pickAlert = (fingerprint: string): FollowTrackAlertInput | null => {
    const list = alertsByFingerprint.get(fingerprint);
    if (!list?.length) return null;
    const ranked = [...list].sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return stamp(b.updatedAt) - stamp(a.updatedAt);
    });
    return ranked[0] ?? null;
  };

  const usedFingerprints = new Set<string>();
  const tracks: FollowTrack[] = [];

  const orderedSearches = [...searches].sort(
    (a, b) => stamp(b.updatedAt) - stamp(a.updatedAt),
  );

  for (const search of orderedSearches) {
    const fingerprint = preferenceCriteriaFingerprint(search.filters);
    const alert = pickAlert(fingerprint);
    usedFingerprints.add(fingerprint);
    tracks.push(
      toTrack({
        id: `search:${search.id}`,
        name: search.name,
        filters: search.filters,
        fingerprint,
        savedSearchId: search.id,
        alertRuleId: alert?.id ?? null,
        notificationsOn: Boolean(alert?.isActive),
      }),
    );
  }

  const leftoverAlerts = [...alerts]
    .filter((alert) => {
      const fingerprint = preferenceCriteriaFingerprint(alert.criteria);
      return !usedFingerprints.has(fingerprint);
    })
    .sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return stamp(b.updatedAt) - stamp(a.updatedAt);
    });

  const leftoverSeen = new Set<string>();
  for (const alert of leftoverAlerts) {
    const fingerprint = preferenceCriteriaFingerprint(alert.criteria);
    if (leftoverSeen.has(fingerprint)) continue;
    leftoverSeen.add(fingerprint);
    tracks.push(
      toTrack({
        id: `alert:${alert.id}`,
        name: alert.name,
        filters: alert.criteria,
        fingerprint,
        savedSearchId: null,
        alertRuleId: alert.id,
        notificationsOn: alert.isActive,
      }),
    );
  }

  return tracks;
}
