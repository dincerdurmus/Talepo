import Link from "next/link";

import { ProfessionalDiscoveryWorkspace } from "@/components/panel/discovery/ProfessionalDiscoveryWorkspace";
import { FeatureUpgradeGate } from "@/components/panel/FeatureUpgradeGate";
import {
  buildCanonicalFilterFromWorkspaceParams,
  validateCanonicalDiscoveryFilter,
} from "@/lib/discovery";
import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { hasFeature } from "@/lib/membership/entitlements";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth/require-user";
import { queryDiscoveryWorkspace } from "@/server/monetization/discovery-workspace-query";
import { buildOpportunitiesFeed } from "@/server/monetization/opportunities-feed";

type WorkspaceView = "suggested" | "browse" | "urgent" | "saved";

function parseView(raw: string | undefined): WorkspaceView {
  if (raw === "browse" || raw === "urgent" || raw === "saved") return raw;
  return "suggested";
}

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const entitlements = await resolveEntitlements(
    user.id,
    await getCompanyContextOptions(),
  );
  const entitled = hasFeature(entitlements.features, "hot_opportunities");

  const companyId =
    entitled && entitlements.subject.type === "company"
      ? entitlements.subject.id
      : null;

  const view = parseView(params.view);
  const taxonomyNode = params.taxonomyNode?.trim() || null;
  const taxonomyLeaf = params.taxonomyLeaf?.trim() || null;
  const leafExact = params.leafExact === "1" || params.leafExact === "true";
  const city = params.city?.trim() || null;
  const urgent =
    params.urgent === "1" ||
    params.urgent === "true" ||
    view === "urgent";

  const rawFilter = buildCanonicalFilterFromWorkspaceParams({
    taxonomyNode,
    taxonomyLeaf,
    leafExact,
    city,
    urgent: view === "browse" ? urgent : view === "urgent",
  });
  const validated = rawFilter
    ? validateCanonicalDiscoveryFilter(rawFilter)
    : null;
  const filter = validated?.ok ? validated.filter : null;

  const canSaveSearch = hasFeature(entitlements.features, "saved_searches");
  const canCreateAlert = hasFeature(entitlements.features, "smart_alerts");
  const canWatchlist = hasFeature(entitlements.features, "watchlist");

  const needsDiscoveryQuery =
    view === "browse" || view === "urgent" || view === "saved";

  const feed = companyId ? await buildOpportunitiesFeed(companyId) : [];

  const discoveryRaw =
    companyId && needsDiscoveryQuery
      ? await queryDiscoveryWorkspace({
          companyId,
          filter: view === "saved" ? null : filter,
          urgentOnly: view === "urgent" || (view === "browse" && urgent),
          watchlistOnly: view === "saved",
          city,
          limit: 40,
        })
      : [];

  const discoveryItems = discoveryRaw.map((item) => ({
    ...item,
    publishedAt: item.publishedAt,
    createdAt: item.createdAt,
  }));

  const [trackedSearchCount, alertCount] = companyId
    ? await Promise.all([
        canSaveSearch
          ? prisma.savedSearch.count({ where: { companyId, isActive: true } })
          : Promise.resolve(0),
        canCreateAlert
          ? prisma.alertRule.count({ where: { companyId, isActive: true } })
          : Promise.resolve(0),
      ])
    : [0, 0];

  return (
    <>
      <section className="py-4 sm:py-6">
        <p className="talepo-page-eyebrow text-xs uppercase tracking-[0.14em]">
          Profesyonel
        </p>
        <h1 className="talepo-page-title mt-2 text-3xl sm:text-4xl">Fırsatlar</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-teal-950/55">
          Taxonomy ile keşfedin, kategoriyi takip edin, alarm kurun — Talepo sizin için
          fırsat avlasın.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <Link
            href="/panel/talepler"
            className="rounded-full border border-teal-900/10 bg-white px-3 py-1.5 font-semibold text-teal-900/65"
          >
            Keşfet (tüm talepler)
          </Link>
          <Link
            href="/panel/kayitli-aramalar"
            className="rounded-full border border-teal-900/10 bg-white px-3 py-1.5 font-semibold text-teal-900/65"
          >
            Kayıtlı aramalar / takipler
          </Link>
          <Link
            href="/panel/uyarilar"
            className="rounded-full border border-teal-900/10 bg-white px-3 py-1.5 font-semibold text-teal-900/65"
          >
            Uyarılar
          </Link>
        </div>
      </section>

      <FeatureUpgradeGate feature="hot_opportunities" entitled={entitled}>
        <ProfessionalDiscoveryWorkspace
          view={view}
          feed={feed}
          discoveryItems={discoveryItems}
          taxonomyNode={taxonomyNode}
          taxonomyLeaf={taxonomyLeaf}
          leafExact={leafExact}
          city={city}
          urgent={urgent}
          canSaveSearch={canSaveSearch}
          canCreateAlert={canCreateAlert}
          canWatchlist={canWatchlist}
          trackedSearchCount={trackedSearchCount}
          alertCount={alertCount}
        />
      </FeatureUpgradeGate>
    </>
  );
}
