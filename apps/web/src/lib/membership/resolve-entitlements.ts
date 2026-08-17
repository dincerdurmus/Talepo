import { prisma } from "@/lib/prisma";

import {
  applyCompanyWorkspaceFeatureOverlay,
  isHiddenInventoryAddonActive,
} from "./company-addon-policy";
import { featuresForPlan } from "./entitlements";
import {
  buildPersonalPlanSnapshot,
  resolveStoredPlanTier,
  resolveEffectivePlanTier,
} from "./plan-tier-utils";
import { getPlanDefinition, type PlanTierId } from "./plans";
import { getPublicFacingPlanLabel } from "./product-packaging";
import type {
  EntitlementContext,
  EntitlementSubject,
  QuotaInfo,
  ResolveEntitlementsOptions,
} from "./types";
import { resolveWorkspaceEffectivePlan } from "./workspace-effective-plan";

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
 * Company.planTier is never mutated from the user's personal plan.
 * Professional owner membership is inherited into workspace effective plan
 * (not MAX of two sold SKUs; workspace is not a second catalog plan).
 * Hidden Inventory is an add-on overlay, not a Professional plan key.
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
    bonusCredits = company.bonusOfferCredits;

    const [owner, addon] = await Promise.all([
      prisma.companyMember.findFirst({
        where: {
          companyId: company.id,
          role: "OWNER",
          status: "ACTIVE",
        },
        select: {
          user: { select: { planTier: true, planExpiresAt: true } },
        },
      }),
      prisma.companyAddonEntitlement.findUnique({
        where: { companyId: company.id },
        select: {
          hiddenInventoryEnabled: true,
          hiddenInventoryExpiresAt: true,
        },
      }),
    ]);

    const workspace = resolveWorkspaceEffectivePlan({
      companyStoredPlanTier: storedPlanTier,
      companyExpiresAt: company.planExpiresAt,
      ownerStoredPlanTier: owner
        ? resolveStoredPlanTier(owner.user.planTier)
        : null,
      ownerExpiresAt: owner?.user.planExpiresAt ?? null,
      now,
    });

    const inherited = workspace.inheritedFromOwner;
    const source = inherited
      ? resolveEffectivePlanTier(
          resolveStoredPlanTier(owner!.user.planTier),
          owner!.user.planExpiresAt,
          now,
        )
      : resolveEffectivePlanTier(storedPlanTier, company.planExpiresAt, now);

    expiresAt = inherited
      ? (owner?.user.planExpiresAt ?? null)
      : company.planExpiresAt;
    const effectivePlanTier = workspace.effectivePlanTier;
    const isExpired = source.isExpired;
    const plan = getPlanDefinition(effectivePlanTier);
    const hiddenInventoryActive = isHiddenInventoryAddonActive({
      enabled: Boolean(addon?.hiddenInventoryEnabled),
      expiresAt: addon?.hiddenInventoryExpiresAt,
      now,
    });
    const features = applyCompanyWorkspaceFeatureOverlay({
      features: featuresForPlan(effectivePlanTier),
      workspaceEffectiveIsProfessional: effectivePlanTier === "PROFESSIONAL",
      hiddenInventoryAddonActive: hiddenInventoryActive,
    });

    usedOffersThisMonth = await prisma.offer.count({
      where: {
        companyId: company.id,
        submittedAt: { gte: monthStart },
        status: { notIn: ["DRAFT", "WITHDRAWN"] },
      },
    });

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
      planLabel: getPublicFacingPlanLabel(storedPlanTier, effectivePlanTier),
      expiresAt,
      isExpired,
      features,
      quota: buildQuota(plan.monthlyOfferQuota, usedOffersThisMonth, bonusCredits),
      requestAccessDelayHours: plan.requestAccessDelayHours,
      personalPlan,
    };
  }

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
    planLabel: getPublicFacingPlanLabel(storedPlanTier, effectivePlanTier),
    expiresAt,
    isExpired,
    features: featuresForPlan(effectivePlanTier),
    quota: buildQuota(plan.monthlyOfferQuota, usedOffersThisMonth, bonusCredits),
    requestAccessDelayHours: plan.requestAccessDelayHours,
    personalPlan,
  };
}

export { resolveEffectivePlanTier } from "./plan-tier-utils";
