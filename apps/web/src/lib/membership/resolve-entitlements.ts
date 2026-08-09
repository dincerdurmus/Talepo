import { prisma } from "@/lib/prisma";

import { featuresForPlan } from "./entitlements";
import {
  getPlanDefinition,
  isPaidPlan,
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

function asPlanTier(value: string | null | undefined): PlanTierId {
  if (
    value === "STANDARD" ||
    value === "PREMIUM" ||
    value === "PROFESSIONAL" ||
    value === "CORPORATE"
  ) {
    return value;
  }

  return "STANDARD";
}

/**
 * Resolve effective plan after expiry.
 * Persisted planTier is left untouched — only effective tier changes.
 */
export function resolveEffectivePlanTier(
  storedPlanTier: PlanTierId,
  expiresAt: Date | null | undefined,
  now: Date,
): { effectivePlanTier: PlanTierId; isExpired: boolean } {
  if (!isPaidPlan(storedPlanTier)) {
    return { effectivePlanTier: "STANDARD", isExpired: false };
  }

  if (expiresAt && expiresAt.getTime() <= now.getTime()) {
    return { effectivePlanTier: "STANDARD", isExpired: true };
  }

  return { effectivePlanTier: storedPlanTier, isExpired: false };
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
 * Central entitlement resolver (company-first).
 *
 * Active company membership → company plan, company quota, company bonus.
 * No company → user plan / quota / bonus.
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
   * Company context selection:
   * - preferUserSubject → skip company (explicit personal mode)
   * - Explicit companyId if provided and membership is valid
   * - Else most recently joined ACTIVE membership (company-first default)
   */
  const companyMembership = options.preferUserSubject
    ? null
    : options.companyId
      ? await prisma.companyMember.findFirst({
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
        })
      : await prisma.companyMember.findFirst({
          where: {
            userId,
            status: "ACTIVE",
            company: {
              deletedAt: null,
              status: { in: ["ACTIVE", "PENDING_VERIFICATION", "DRAFT"] },
            },
          },
          orderBy: { joinedAt: "desc" },
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
    storedPlanTier = asPlanTier(company.planTier);
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
    storedPlanTier = asPlanTier(user.planTier);
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
  };
}
