import type { OpportunityMatchSource } from "@/generated/prisma/client";
import {
  evaluateDiscoveryFilter,
  hasCanonicalFilterSignal,
  parseDiscoveryProjection,
  validateCanonicalDiscoveryFilter,
} from "@/lib/discovery";
import type { SavedSearchFilters } from "@/lib/monetization/types";
import { prisma } from "@/lib/prisma";

import { matchRequestToAlertRules } from "./alert-matching";
import { matchRequestToInventory } from "./inventory-matching";
import { matchCompanyToRequest } from "./smart-matching";

export { canAssignOpportunities } from "./opportunity-assignment";

export type HunterResult = {
  companyId: string;
  requestId: string;
  source: OpportunityMatchSource;
  score: number;
  reasons: string[];
};

/**
 * Corporate automatic opportunity hunter — scans inventory + profile + alert rules.
 * Designed for future queue/worker extraction.
 */
export async function runAutomaticOpportunityHunter(
  requestId: string,
): Promise<HunterResult[]> {
  const results: HunterResult[] = [];

  const [alertMatches, inventoryMatches] = await Promise.all([
    matchRequestToAlertRules(requestId),
    matchRequestToInventory(requestId),
  ]);

  for (const m of alertMatches) {
    results.push({
      companyId: m.companyId,
      requestId: m.requestId,
      source: "ALERT_RULE",
      score: m.score,
      reasons: m.reasons,
    });
  }

  for (const m of inventoryMatches) {
    results.push({
      companyId: m.companyId,
      requestId: m.requestId,
      source: "INVENTORY",
      score: m.score,
      reasons: m.reasons,
    });
  }

  // Phase 3C — SavedSearch canonical filters consume discoveryProjection (no re-parse)
  const requestProjection = await prisma.request.findUnique({
    where: { id: requestId },
    select: { discoveryProjection: true },
  });
  const projection = parseDiscoveryProjection(
    requestProjection?.discoveryProjection,
  );
  if (projection) {
    const searches = await prisma.savedSearch.findMany({
      where: { isActive: true },
      select: { id: true, companyId: true, name: true, filters: true },
      take: 300,
    });
    for (const search of searches) {
      const filters = search.filters as SavedSearchFilters;
      if (!filters?.canonical || !hasCanonicalFilterSignal(filters.canonical)) {
        continue;
      }
      const validated = validateCanonicalDiscoveryFilter(filters.canonical);
      if (!validated.ok) continue;
      const evalResult = evaluateDiscoveryFilter(projection, validated.filter);
      if (!evalResult.match || evalResult.path !== "CANONICAL_MATCH") continue;
      const already = results.some(
        (r) =>
          r.companyId === search.companyId && r.source === "ALERT_RULE",
      );
      if (already) continue;
      results.push({
        companyId: search.companyId,
        requestId,
        source: "ALERT_RULE",
        score: 88,
        reasons: [
          `Takip: ${search.name}`,
          "CANONICAL_MATCH",
          ...evalResult.reasons.slice(0, 3),
        ],
      });
    }
  }

  const corporateCompanies = await prisma.company.findMany({
    where: {
      deletedAt: null,
      planTier: "CORPORATE",
      status: { in: ["ACTIVE", "PENDING_VERIFICATION"] },
    },
    select: { id: true },
    take: 100,
  });

  for (const company of corporateCompanies) {
    const already = results.some(
      (r) => r.companyId === company.id && r.source === "COMPANY_PROFILE",
    );
    if (already) continue;

    const match = await matchCompanyToRequest(company.id, requestId);
    if (match && match.score >= 50) {
      results.push({
        companyId: company.id,
        requestId,
        source: "COMPANY_PROFILE",
        score: match.score,
        reasons: match.reasons,
      });
    }
  }

  for (const row of results) {
    await prisma.opportunityMatch.upsert({
      where: {
        companyId_requestId_source: {
          companyId: row.companyId,
          requestId: row.requestId,
          source: row.source,
        },
      },
      create: {
        companyId: row.companyId,
        requestId: row.requestId,
        source: row.source,
        score: row.score,
        reasons: row.reasons,
        status: "NEW",
      },
      update: {
        score: row.score,
        reasons: row.reasons,
      },
    });
  }

  return results;
}

/**
 * Assign / unassign opportunity to an active company member.
 * Company-scoped. Assigner role should be OWNER|ADMIN|MANAGER (enforced by caller).
 */
export async function assignOpportunity(
  opportunityId: string,
  memberId: string | null,
  companyId: string,
) {
  if (memberId) {
    const member = await prisma.companyMember.findFirst({
      where: {
        id: memberId,
        companyId,
        status: "ACTIVE",
      },
      select: { id: true },
    });

    if (!member) {
      throw new Error("Geçersiz ekip üyesi.");
    }
  }

  const result = await prisma.opportunityMatch.updateMany({
    where: { id: opportunityId, companyId },
    data: { assignedToMemberId: memberId },
  });

  if (result.count === 0) {
    const { createSubsystemLogger } = await import("@/lib/observability/logger");
    createSubsystemLogger("tenancy").warn("tenancy.company_scope_violation", {
      outcome: "denied",
      errorCode: "COMPANY_SCOPE_VIOLATION",
      companyId,
      context: { opportunityId, action: "assignOpportunity" },
    });
  }

  return result;
}

