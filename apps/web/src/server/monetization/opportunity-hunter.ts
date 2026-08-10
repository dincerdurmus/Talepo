import type { OpportunityMatchSource } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { matchRequestToAlertRules } from "./alert-matching";
import { matchRequestToInventory } from "./inventory-matching";
import { matchCompanyToRequest } from "./smart-matching";

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

export async function assignOpportunity(
  opportunityId: string,
  memberId: string,
  companyId: string,
) {
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

  return prisma.opportunityMatch.updateMany({
    where: { id: opportunityId, companyId },
    data: { assignedToMemberId: memberId },
  });
}
