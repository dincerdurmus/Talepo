import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { hasFeature } from "@/lib/membership/entitlements";
import {
  ownerScopeWhere,
  requireResourceOwnerFeature,
} from "@/lib/membership/resource-owner";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import { prisma } from "@/lib/prisma";
import { criteriaFromAlertRule, preferenceCriteriaFingerprint } from "@/lib/monetization/preference-criteria";
import type { SavedSearchFilters } from "@/lib/monetization/types";
import { EntitlementError } from "@/lib/membership/types";
import { requireUser } from "@/server/auth/require-user";

import { FeatureUpgradeGate } from "@/components/panel/FeatureUpgradeGate";
import { SavedSearchesManager } from "@/components/panel/SavedSearchesManager";

export default async function SavedSearchesPage() {
  const user = await requireUser();
  const entitlements = await resolveEntitlements(
    user.id,
    await getCompanyContextOptions(),
  );
  const entitled = hasFeature(entitlements.features, "saved_searches");
  const alertsEnabled = hasFeature(entitlements.features, "smart_alerts");

  let searches: Awaited<ReturnType<typeof prisma.savedSearch.findMany>> = [];
  let activeAlertFingerprints: string[] = [];
  if (entitled) {
    try {
      const ctx = await requireResourceOwnerFeature(user.id, "saved_searches");
      searches = await prisma.savedSearch.findMany({
        where: ownerScopeWhere(ctx),
        orderBy: { updatedAt: "desc" },
      });
      if (alertsEnabled) {
        const alertCtx = await requireResourceOwnerFeature(user.id, "smart_alerts");
        const rules = await prisma.alertRule.findMany({
          where: { ...ownerScopeWhere(alertCtx), isActive: true },
          select: {
            city: true,
            district: true,
            minBudget: true,
            maxBudget: true,
            keywords: true,
            attributes: true,
            discoveryFilter: true,
            category: { select: { slug: true } },
          },
          take: 200,
        });
        activeAlertFingerprints = rules.map((rule) =>
          preferenceCriteriaFingerprint(
            criteriaFromAlertRule({
              categorySlug: rule.category?.slug,
              city: rule.city,
              district: rule.district,
              minBudget: rule.minBudget,
              maxBudget: rule.maxBudget,
              keywords: rule.keywords,
              attributes: rule.attributes,
              discoveryFilter: rule.discoveryFilter,
            }),
          ),
        );
      }
    } catch (e) {
      if (!(e instanceof EntitlementError)) throw e;
    }
  }

  const serialized = searches.map((s) => ({
    id: s.id,
    name: s.name,
    isActive: s.isActive,
    filters: s.filters as SavedSearchFilters,
    criteriaFingerprint: preferenceCriteriaFingerprint(s.filters as SavedSearchFilters),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));

  const workspaceLabel =
    entitlements.subject.type === "company" ? "Firma" : "Kişisel";

  return (
    <>
      <section className="py-4 sm:py-6">
        <p className="talepo-page-eyebrow text-xs uppercase tracking-[0.14em]">
          Premium · {workspaceLabel}
        </p>
        <h1 className="talepo-page-title mt-2 text-3xl sm:text-4xl">Kayıtlı aramalar</h1>
      </section>

      <FeatureUpgradeGate feature="saved_searches" entitled={entitled}>
        <SavedSearchesManager
          initialSearches={serialized}
          alertsEnabled={alertsEnabled}
          initialAlertFingerprints={activeAlertFingerprints}
        />
      </FeatureUpgradeGate>
    </>
  );
}
