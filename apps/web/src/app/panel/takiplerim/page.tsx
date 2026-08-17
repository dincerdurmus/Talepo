import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { hasFeature } from "@/lib/membership/entitlements";
import {
  ownerScopeWhere,
  requireResourceOwnerFeature,
} from "@/lib/membership/resource-owner";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import { EntitlementError } from "@/lib/membership/types";
import { projectFollowTracks } from "@/lib/monetization/follow-tracks";
import {
  criteriaFromAlertRule,
} from "@/lib/monetization/preference-criteria";
import type { SavedSearchFilters } from "@/lib/monetization/types";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";

import { FeatureUpgradeGate } from "@/components/panel/FeatureUpgradeGate";
import { FollowTracksManager } from "@/components/panel/FollowTracksManager";

export default async function FollowsPage() {
  const user = await requireUser();
  const entitlements = await resolveEntitlements(
    user.id,
    await getCompanyContextOptions(),
  );
  const canSave = hasFeature(entitlements.features, "saved_searches");
  const canAlert = hasFeature(entitlements.features, "smart_alerts");
  const canOpenModule = canSave || canAlert;

  let searches: Awaited<ReturnType<typeof prisma.savedSearch.findMany>> = [];
  let alertRows: Array<{
    id: string;
    name: string;
    isActive: boolean;
    city: string | null;
    district: string | null;
    minBudget: { toNumber(): number } | number | null;
    maxBudget: { toNumber(): number } | number | null;
    keywords: string | null;
    attributes: unknown;
    discoveryFilter: unknown;
    updatedAt: Date;
    category: { slug: string } | null;
  }> = [];

  if (canSave) {
    try {
      const ctx = await requireResourceOwnerFeature(user.id, "saved_searches");
      searches = await prisma.savedSearch.findMany({
        where: ownerScopeWhere(ctx),
        orderBy: { updatedAt: "desc" },
      });
    } catch (e) {
      if (!(e instanceof EntitlementError)) throw e;
    }
  }

  if (canAlert) {
    try {
      const ctx = await requireResourceOwnerFeature(user.id, "smart_alerts");
      alertRows = await prisma.alertRule.findMany({
        where: ownerScopeWhere(ctx),
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          isActive: true,
          city: true,
          district: true,
          minBudget: true,
          maxBudget: true,
          keywords: true,
          attributes: true,
          discoveryFilter: true,
          updatedAt: true,
          category: { select: { slug: true } },
        },
      });
    } catch (e) {
      if (!(e instanceof EntitlementError)) throw e;
    }
  }

  const tracks = projectFollowTracks(
    searches.map((search) => ({
      id: search.id,
      name: search.name,
      filters: search.filters as SavedSearchFilters,
      updatedAt: search.updatedAt,
    })),
    alertRows.map((rule) => ({
      id: rule.id,
      name: rule.name,
      isActive: rule.isActive,
      updatedAt: rule.updatedAt,
      criteria: criteriaFromAlertRule({
        categorySlug: rule.category?.slug,
        city: rule.city,
        district: rule.district,
        minBudget: rule.minBudget,
        maxBudget: rule.maxBudget,
        keywords: rule.keywords,
        attributes: rule.attributes,
        discoveryFilter: rule.discoveryFilter,
      }),
    })),
  );

  const workspaceLabel =
    entitlements.subject.type === "company" ? "Firma" : "Kişisel";

  return (
    <>
      <section className="py-4 sm:py-6">
        <p className="talepo-page-eyebrow text-xs uppercase tracking-[0.14em]">
          Profesyonel · {workspaceLabel}
        </p>
        <h1 className="talepo-page-title mt-2 text-3xl sm:text-4xl">Takiplerim</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-teal-950/55">
          İlgilendiğiniz talepleri kaydedin, yeni eşleşmelerde bildirim alın.
        </p>
      </section>

      <FeatureUpgradeGate feature="saved_searches" entitled={canOpenModule}>
        <FollowTracksManager
          initialTracks={tracks}
          alertsEnabled={canAlert}
          canCreateTrack={canSave}
        />
      </FeatureUpgradeGate>
    </>
  );
}
