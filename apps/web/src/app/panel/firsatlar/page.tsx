import Link from "next/link";

import { CorporateOpportunityCenter } from "@/components/panel/discovery/CorporateOpportunityCenter";
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
import {
  buildCorporateOpportunityCenter,
  type CorporateOpportunityFilter,
} from "@/server/monetization/corporate-opportunity-center";
import { queryDiscoveryWorkspace } from "@/server/monetization/discovery-workspace-query";
import { canAssignOpportunities } from "@/server/monetization/opportunity-assignment";
import { buildOpportunitiesFeed } from "@/server/monetization/opportunities-feed";
import { assertCompanyMembership } from "@/lib/panel/company-workspace";

type WorkspaceView = "suggested" | "browse" | "urgent" | "saved" | "ops";

function parseView(raw: string | undefined): WorkspaceView {
  if (
    raw === "browse" ||
    raw === "urgent" ||
    raw === "saved" ||
    raw === "ops"
  ) {
    return raw;
  }
  return "suggested";
}

function parseOpsFilter(raw: string | undefined): CorporateOpportunityFilter {
  const allowed: CorporateOpportunityFilter[] = [
    "all",
    "new",
    "unassigned",
    "assigned",
    "assigned_to_me",
    "following",
    "offered",
  ];
  if (raw && (allowed as string[]).includes(raw)) {
    return raw as CorporateOpportunityFilter;
  }
  return "all";
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

  const isCorporatePlan =
    entitlements.effectivePlanTier === "CORPORATE" ||
    hasFeature(entitlements.features, "lead_distribution") ||
    hasFeature(entitlements.features, "automatic_opportunity_hunter");

  let view = parseView(params.view);
  // Corporate default landing = Opportunity Center ops
  if (!params.view && isCorporatePlan && companyId) {
    view = "ops";
  }

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
  const canLeadDistribution = hasFeature(
    entitlements.features,
    "lead_distribution",
  );

  const membership =
    companyId != null
      ? await assertCompanyMembership(user.id, companyId)
      : null;
  const canAssign = Boolean(
    membership && canAssignOpportunities(membership.role),
  );

  const needsDiscoveryQuery =
    view === "browse" || view === "urgent" || view === "saved";

  const feed =
    companyId && view !== "ops" ? await buildOpportunitiesFeed(companyId) : [];

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
          ? prisma.savedSearch.count({
              where: { ownerType: "COMPANY", companyId, isActive: true },
            })
          : Promise.resolve(0),
        canCreateAlert
          ? prisma.alertRule.count({
              where: { ownerType: "COMPANY", companyId, isActive: true },
            })
          : Promise.resolve(0),
      ])
    : [0, 0];

  const corporateCenter =
    companyId && view === "ops" && isCorporatePlan
      ? await buildCorporateOpportunityCenter({
          companyId,
          userId: user.id,
          filter: parseOpsFilter(params.opsFilter),
          limit: 40,
        })
      : null;

  const companyName =
    entitlements.subject.type === "company"
      ? entitlements.subject.name?.trim() || "Firma"
      : "Firma";

  const showCorporateOps = Boolean(corporateCenter);

  return (
    <>
      <section className="py-4 sm:py-6">
        <p className="talepo-page-eyebrow text-xs uppercase tracking-[0.14em]">
          {showCorporateOps ? "Corporate" : "Profesyonel"}
        </p>
        <h1 className="talepo-page-title mt-2 text-3xl sm:text-4xl">
          {showCorporateOps ? "Opportunity Center" : "Fırsatlar"}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-teal-950/55">
          {showCorporateOps
            ? "Şirket fırsatlarını keşfedin, ekibe dağıtın, takip edin ve teklife bağlayın."
            : "Taxonomy ile keşfedin, kategoriyi takip edin, alarm kurun — Talepo sizin için fırsat avlasın."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {isCorporatePlan ? (
            <Link
              href="/panel/firsatlar?view=ops"
              className="rounded-full border border-teal-900/10 bg-white px-3 py-1.5 font-semibold text-teal-900/65"
            >
              Opportunity Center
            </Link>
          ) : null}
          <Link
            href="/panel/firsatlar?view=browse"
            className="rounded-full border border-teal-900/10 bg-white px-3 py-1.5 font-semibold text-teal-900/65"
          >
            Taxonomy keşif
          </Link>
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
            Takipler
          </Link>
          <Link
            href="/panel/uyarilar"
            className="rounded-full border border-teal-900/10 bg-white px-3 py-1.5 font-semibold text-teal-900/65"
          >
            Bildirimler
          </Link>
        </div>
      </section>

      <FeatureUpgradeGate feature="hot_opportunities" entitled={entitled}>
        {showCorporateOps && corporateCenter ? (
          <CorporateOpportunityCenter
            filter={parseOpsFilter(params.opsFilter)}
            summary={corporateCenter.summary}
            items={corporateCenter.items}
            teamMembers={corporateCenter.teamMembers}
            currentMemberId={corporateCenter.currentMemberId}
            canAssign={canAssign}
            canLeadDistribution={canLeadDistribution}
            companyName={companyName}
          />
        ) : (
          <ProfessionalDiscoveryWorkspace
            view={view === "ops" ? "suggested" : view}
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
        )}
      </FeatureUpgradeGate>
    </>
  );
}
