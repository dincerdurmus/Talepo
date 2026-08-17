/**
 * User-facing Follow (Takip) projection.
 * SavedSearch is the primary record; AlertRule is notification state.
 * Does not invent a second criteria schema — fingerprints come from
 * preference-criteria.ts.
 */

import { summarizeSavedSearchFilters } from "@/lib/discovery";
import { savedSearchToExploreUrl } from "@/lib/monetization/saved-search-url";
import type { SavedSearchFilters } from "@/lib/monetization/types";

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
    tracks.push({
      id: `search:${search.id}`,
      name: search.name,
      summary: summarizeSavedSearchFilters(search.filters),
      filters: search.filters,
      criteriaFingerprint: fingerprint,
      savedSearchId: search.id,
      alertRuleId: alert?.id ?? null,
      notificationsOn: Boolean(alert?.isActive),
      runUrl: savedSearchToExploreUrl(search.filters),
    });
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
    tracks.push({
      id: `alert:${alert.id}`,
      name: alert.name,
      summary: summarizeSavedSearchFilters(alert.criteria),
      filters: alert.criteria,
      criteriaFingerprint: fingerprint,
      savedSearchId: null,
      alertRuleId: alert.id,
      notificationsOn: alert.isActive,
      runUrl: savedSearchToExploreUrl(alert.criteria),
    });
  }

  return tracks;
}
