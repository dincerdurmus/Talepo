/**
 * Preference-driven candidate retrieval for Personal Opportunity Center.
 * Expands recall beyond the global newest-open window. Does NOT decide
 * recommendation eligibility — final truth remains matchPersonalAgainstPreferences
 * / matchPersonalToRequest plus the hub eligibility helpers.
 */

import {
  evaluateDiscoveryFilter,
  parseDiscoveryProjection,
  type CanonicalDiscoveryFilter,
} from "@/lib/discovery";
import { prisma } from "@/lib/prisma";

import type { PersonalPreferenceFilter } from "./personal-matching-core";

/** Max open requests scanned for preference evaluation (bounded). */
export const PERSONAL_PREFERENCE_SCAN_LIMIT = 120;

/** Max preference-sourced candidate ids merged into the feed universe. */
export const PERSONAL_PREFERENCE_CANDIDATE_CAP = 60;

function categorySlugsFromFilter(filter: CanonicalDiscoveryFilter): string[] {
  const nodeIds = [
    ...(filter.taxonomyNodeIds ?? []),
    ...(filter.primaryLeafId ? [filter.primaryLeafId] : []),
  ];
  const slugs = new Set<string>();
  for (const id of nodeIds) {
    const match = /^tax:([^:]+)/.exec(id);
    if (match?.[1]) slugs.add(match[1]);
  }
  return [...slugs];
}

function collectCategorySlugs(
  preferences: readonly PersonalPreferenceFilter[],
): string[] {
  const slugs = new Set<string>();
  for (const preference of preferences) {
    for (const slug of categorySlugsFromFilter(preference.filter)) {
      slugs.add(slug);
    }
  }
  return [...slugs];
}

type OpenRequestWhere = {
  deletedAt: null;
  status: { in: ("PUBLISHED" | "RECEIVING_OFFERS")[] };
  createdById?: { not: string };
};

/**
 * Find open request ids that pass evaluateDiscoveryFilter against any of the
 * caller's preference filters. Coarse Prisma narrowing by category slug when
 * available; otherwise a bounded global scan. Deterministic: urgent then newest.
 */
export async function collectPersonalPreferenceCandidateIds(input: {
  preferences: readonly PersonalPreferenceFilter[];
  openWhere: OpenRequestWhere;
  scanLimit?: number;
  candidateCap?: number;
}): Promise<string[]> {
  const preferences = input.preferences;
  if (preferences.length === 0) return [];

  const scanLimit = input.scanLimit ?? PERSONAL_PREFERENCE_SCAN_LIMIT;
  const candidateCap = input.candidateCap ?? PERSONAL_PREFERENCE_CANDIDATE_CAP;
  const categorySlugs = collectCategorySlugs(preferences);

  const rows = await prisma.request.findMany({
    where: {
      ...input.openWhere,
      ...(categorySlugs.length > 0
        ? { category: { slug: { in: categorySlugs } } }
        : {}),
    },
    orderBy: [{ isUrgent: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
    take: scanLimit,
    select: {
      id: true,
      discoveryProjection: true,
    },
  });

  const matchedIds: string[] = [];
  for (const row of rows) {
    const projection = parseDiscoveryProjection(row.discoveryProjection);
    if (!projection) continue;
    const hits = preferences.some((preference) =>
      evaluateDiscoveryFilter(projection, preference.filter).match,
    );
    if (!hits) continue;
    matchedIds.push(row.id);
    if (matchedIds.length >= candidateCap) break;
  }

  return matchedIds;
}
