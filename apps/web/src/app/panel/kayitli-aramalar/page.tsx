import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { hasFeature } from "@/lib/membership/entitlements";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import { prisma } from "@/lib/prisma";
import type { SavedSearchFilters } from "@/lib/monetization/types";
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

  const companyId =
    entitled && entitlements.subject.type === "company"
      ? entitlements.subject.id
      : null;

  const searches = companyId
    ? await prisma.savedSearch.findMany({
        where: { companyId },
        orderBy: { updatedAt: "desc" },
      })
    : [];

  const serialized = searches.map((s) => ({
    id: s.id,
    name: s.name,
    isActive: s.isActive,
    filters: s.filters as SavedSearchFilters,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));

  return (
    <>
      <section className="py-4 sm:py-6">
        <p className="talepo-page-eyebrow text-xs uppercase tracking-[0.14em]">Premium</p>
        <h1 className="talepo-page-title mt-2 text-3xl sm:text-4xl">Kayıtlı aramalar</h1>
      </section>

      <FeatureUpgradeGate feature="saved_searches" entitled={entitled}>
        <SavedSearchesManager initialSearches={serialized} />
      </FeatureUpgradeGate>
    </>
  );
}
