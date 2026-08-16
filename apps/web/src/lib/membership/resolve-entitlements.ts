import { prisma } from "@/lib/prisma";

import { featuresForPlan } from "./entitlements";
import {
  buildPersonalPlanSnapshot,
  resolveStoredPlanTier,
  resolveEffectivePlanTier,
} from "./plan-tier-utils";
import {
  getPlanDefinition,
  type PlanTierId,
} from "./plans";
import type {
  EntitlementContext,
  EntitlementSubject,
  QuotaInfo,
  ResolveEntitlementsOptions,
} from "./types";

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function buildQuota(
  limit: number | null,
  used: number,
  bonusCredits: number,
): QuotaInfo {
  const isUnlimited = limit === null;

  if (isUnlimited) {
    return {
      limit: null,
      used,
      remaining: null,
      bonusCredits,
      isUnlimited: true,
    };
  }

  const includedRemaining = Math.max(0, limit - used);
  const remaining = includedRemaining + Math.max(0, bonusCredits);

  return {
    limit,
    used,
    remaining,
    bonusCredits: Math.max(0, bonusCredits),
    isUnlimited: false,
  };
}

/**
 * Central entitlement resolver (explicit company context).
 *
 * PERSONAL (default): User.planTier / user quota / user bonus.
 * COMPANY: only when options.companyId is set AND membership is ACTIVE.
 *
 * Company plan NEVER mutates or replaces personal User.planTier.
 * No MAX(userPlan, companyPlan). No implicit company-first upgrade.
 * User + company bonuses are never summed.
 */
export async function resolveEntitlements(
  userId: string,
  options: ResolveEntitlementsOptions = {},
): Promise<EntitlementContext> {
  const now = options.now ?? new Date();
  const monthStart = startOfMonth(now);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      planTier: true,
      planExpiresAt: true,
      bonusOfferCredits: true,
    },
  });

  if (!user) {
    const plan = getPlanDefinition("STANDARD");
    return {
      userId,
      subject: { type: "user", id: userId },
      storedPlanTier: "STANDARD",
      effectivePlanTier: "STANDARD",
      planLabel: plan.label,
      expiresAt: null,
      isExpired: false,
      features: featuresForPlan("STANDARD"),
      quota: buildQuota(plan.monthlyOfferQuota, 0, 0),
      requestAccessDelayHours: plan.requestAccessDelayHours,
    };
  }

  /**
   * Company context selection (explicit only):
   * - preferUserSubject → personal
   * - companyId + ACTIVE membership → that company plan
   * - otherwise → personal (never auto-pick a company)
   */
  const companyMembership =
    options.preferUserSubject || !options.companyId
      ? null
      : await prisma.companyMember.findFirst({
          where: {
            userId,
            companyId: options.companyId,
            status: "ACTIVE",
            company: {
              deletedAt: null,
              status: { in: ["ACTIVE", "PENDING_VERIFICATION", "DRAFT"] },
            },
          },
          select: {
            company: {
              select: {
                id: true,
                name: true,
                planTier: true,
                planExpiresAt: true,
                bonusOfferCredits: true,
              },
            },
          },
        });

  const company = companyMembership?.company ?? null;

  let subject: EntitlementSubject;
  let storedPlanTier: PlanTierId;
  let expiresAt: Date | null;
  let bonusCredits: number;
  let usedOffersThisMonth: number;

  if (company) {
    subject = { type: "company", id: company.id, name: company.name };
    storedPlanTier = resolveStoredPlanTier(company.planTier);
    expiresAt = company.planExpiresAt;
    bonusCredits = company.bonusOfferCredits;

    usedOffersThisMonth = await prisma.offer.count({
      where: {
        companyId: company.id,
        submittedAt: { gte: monthStart },
        status: { notIn: ["DRAFT", "WITHDRAWN"] },
      },
    });
  } else {
    subject = { type: "user", id: userId };
    storedPlanTier = resolveStoredPlanTier(user.planTier);
    expiresAt = user.planExpiresAt;
    bonusCredits = user.bonusOfferCredits;

    usedOffersThisMonth = await prisma.offer.count({
      where: {
        submittedById: userId,
        companyId: null,
        submittedAt: { gte: monthStart },
        status: { notIn: ["DRAFT", "WITHDRAWN"] },
      },
    });
  }

  const { effectivePlanTier, isExpired } = resolveEffectivePlanTier(
    storedPlanTier,
    expiresAt,
    now,
  );
  const plan = getPlanDefinition(effectivePlanTier);

  const personalPlan = buildPersonalPlanSnapshot(
    resolveStoredPlanTier(user.planTier),
    user.planExpiresAt,
    now,
  );

  return {
    userId,
    subject,
    storedPlanTier,
    effectivePlanTier,
    planLabel: plan.label,
    expiresAt,
    isExpired,
    features: featuresForPlan(effectivePlanTier),
    quota: buildQuota(plan.monthlyOfferQuota, usedOffersThisMonth, bonusCredits),
    requestAccessDelayHours: plan.requestAccessDelayHours,
    personalPlan,
  };
}

export { resolveEffectivePlanTier } from "./plan-tier-utils";
