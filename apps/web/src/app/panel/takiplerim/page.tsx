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
import { SignalActivityShell } from "@/components/panel/signal/SignalActivityShell";

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
  const notifyingCount = tracks.filter((track) => track.notificationsOn).length;
  const summary = canOpenModule
    ? tracks.length === 0
      ? "Henüz aktif takibiniz yok."
      : notifyingCount > 0
        ? `${tracks.length} takip · ${notifyingCount} bildirim açık`
        : `${tracks.length} takip`
    : null;

  return (
    <SignalActivityShell
      tone="follows"
      eyebrow={`Takiplerim · ${workspaceLabel}`}
      title="Takiplerim"
      description="Kayıtlı kriterlerinizi izleyin. Yeni eşleşmelerde bildirim alın veya aynı aramayı yeniden açın."
      summary={summary}
    >
      <FeatureUpgradeGate
        feature="saved_searches"
        entitled={canOpenModule}
        presentation="signal"
      >
        <FollowTracksManager
          initialTracks={tracks}
          alertsEnabled={canAlert}
          canCreateTrack={canSave}
        />
      </FeatureUpgradeGate>
    </SignalActivityShell>
  );
}
