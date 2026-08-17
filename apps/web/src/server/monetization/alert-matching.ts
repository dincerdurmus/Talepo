import { parseDiscoveryProjection } from "@/lib/discovery";
import {
  criteriaFromAlertRule,
  evaluatePreferenceCriteria,
} from "@/lib/monetization/preference-criteria";
import { prisma } from "@/lib/prisma";
import type { ResourceOwnerType } from "@/generated/prisma/client";

export type AlertRuleMatch = {
  alertRuleId: string;
  alertRuleName: string;
  ownerType: ResourceOwnerType;
  /** Present when ownerType = COMPANY */
  companyId: string | null;
  /** Present when ownerType = USER */
  userId: string | null;
  requestId: string;
  score: number;
  reasons: string[];
};

/**
 * Match a published request against active alert rules (USER + COMPANY).
 * Production truth is evaluatePreferenceCriteria — same envelope as SavedSearch
 * and Opportunity personal matching. Downstream must branch on ownerType.
 *
 * Scan is bounded (take 500). Uncontrolled growth remains a known risk;
 * this milestone does not add a queue.
 */
export async function matchRequestToAlertRules(
  requestId: string,
): Promise<AlertRuleMatch[]> {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      title: true,
      description: true,
      city: true,
      district: true,
      budgetMin: true,
      budgetMax: true,
      isUrgent: true,
      createdById: true,
      companyId: true,
      discoveryProjection: true,
    },
  });

  if (!request) return [];

  const projection = parseDiscoveryProjection(request.discoveryProjection);
  const facts = {
    title: request.title,
    description: request.description,
    city: request.city,
    district: request.district,
    budgetMin: request.budgetMin?.toNumber() ?? null,
    budgetMax: request.budgetMax?.toNumber() ?? null,
    isUrgent: request.isUrgent,
    createdById: request.createdById,
    companyId: request.companyId,
  };

  const rules = await prisma.alertRule.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      ownerType: true,
      companyId: true,
      userId: true,
      city: true,
      district: true,
      minBudget: true,
      maxBudget: true,
      keywords: true,
      attributes: true,
      discoveryFilter: true,
      category: { select: { slug: true } },
    },
    take: 500,
  });

  const results: AlertRuleMatch[] = [];

  for (const rule of rules) {
    const ownerType = rule.ownerType;
    const companyId = ownerType === "COMPANY" ? rule.companyId : null;
    const userId = ownerType === "USER" ? rule.userId : null;
    if (ownerType === "COMPANY" && !companyId) continue;
    if (ownerType === "USER" && !userId) continue;

    const criteria = criteriaFromAlertRule({
      categorySlug: rule.category?.slug,
      city: rule.city,
      district: rule.district,
      minBudget: rule.minBudget,
      maxBudget: rule.maxBudget,
      keywords: rule.keywords,
      attributes: rule.attributes,
      discoveryFilter: rule.discoveryFilter,
    });

    const evalResult = evaluatePreferenceCriteria({
      projection,
      facts,
      criteria,
      viewer:
        ownerType === "USER"
          ? { userId }
          : { companyId },
    });
    if (!evalResult.match) continue;

    results.push({
      alertRuleId: rule.id,
      alertRuleName: rule.name,
      ownerType,
      companyId,
      userId,
      requestId: request.id,
      score: 90,
      reasons: [
        `Alarm kuralı: ${rule.name}`,
        ...evalResult.reasons.slice(0, 3),
      ],
    });
  }

  return results;
}
