import Link from "next/link";
import { redirect } from "next/navigation";

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
import { isWorkspaceEligible } from "@/lib/membership/plans";
import {
  buildCorporateOpportunityCenter,
  type CorporateOpportunityFilter,
} from "@/server/monetization/corporate-opportunity-center";
import { queryDiscoveryWorkspace } from "@/server/monetization/discovery-workspace-query";
import { canAssignOpportunities } from "@/server/monetization/opportunity-assignment";
import { buildOpportunitiesFeed } from "@/server/monetization/opportunities-feed";
import { loadTalepoRadarFeed } from "@/server/monetization/talepo-radar";
import { assertCompanyMembership } from "@/lib/panel/company-workspace";

/** User-facing views after Acil tab removal. `urgent` only for legacy parse. */
type WorkspaceView = "suggested" | "browse" | "saved" | "ops" | "radar";

function parseView(raw: string | undefined): WorkspaceView | "urgent" {
  if (
    raw === "browse" ||
    raw === "urgent" ||
    raw === "saved" ||
    raw === "ops" ||
    raw === "radar"
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

/**
 * PAGE GATE: hot_opportunities (nav + upgrade surface).
 * LEGACY ALIAS: advanced_opportunity_analysis still grants access on Pro/Corp.
 * RADAR GATE: talepo_radar (tab + feed load).
 */
function hasFirsatlarPageAccess(
  features: Parameters<typeof hasFeature>[0],
): boolean {
  return (
    hasFeature(features, "hot_opportunities") ||
    hasFeature(features, "advanced_opportunity_analysis")
  );
}

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  // Legacy Acil tab → Fırsat Havuzu with urgent context (no 404, no hidden tab).
  if (params.view === "urgent") {
    const q = new URLSearchParams();
    q.set("view", "browse");
    q.set("urgent", "1");
    for (const key of [
      "taxonomyNode",
      "taxonomyLeaf",
      "leafExact",
      "city",
    ] as const) {
      const value = params[key]?.trim();
      if (value) q.set(key, value);
    }
    redirect(`/panel/firsatlar?${q.toString()}`);
  }

  const entitlements = await resolveEntitlements(
    user.id,
    await getCompanyContextOptions(),
  );
  const entitled = hasFirsatlarPageAccess(entitlements.features);
  const canRadar = hasFeature(entitlements.features, "talepo_radar");

  const companyId =
    entitled && entitlements.subject.type === "company"
      ? entitlements.subject.id
      : null;

  const isCorporatePlan =
    isWorkspaceEligible(entitlements.effectivePlanTier) ||
    hasFeature(entitlements.features, "lead_distribution") ||
    hasFeature(entitlements.features, "automatic_opportunity_hunter");

  let view = parseView(params.view) as WorkspaceView;
  // Corporate default landing = Opportunity Center ops
  if (!params.view && isCorporatePlan && companyId) {
    view = "ops";
  }
  if (view === "radar" && !canRadar) {
    view = "suggested";
  }

  const taxonomyNode = params.taxonomyNode?.trim() || null;
  const taxonomyLeaf = params.taxonomyLeaf?.trim() || null;
  const leafExact = params.leafExact === "1" || params.leafExact === "true";
  const city = params.city?.trim() || null;
  const urgent =
    params.urgent === "1" || params.urgent === "true";

  const rawFilter = buildCanonicalFilterFromWorkspaceParams({
    taxonomyNode,
    taxonomyLeaf,
    leafExact,
    city,
    urgent: view === "browse" ? urgent : false,
  });
  const validated = rawFilter
    ? validateCanonicalDiscoveryFilter(rawFilter)
    : null;
  const filter = validated?.ok ? validated.filter : null;

  const canSaveSearch = hasFeature(entitlements.features, "saved_searches");
  const canCreateAlert = hasFeature(entitlements.features, "smart_alerts");
  const canWatchlist =
    Boolean(companyId) && hasFeature(entitlements.features, "watchlist");
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

  const needsDiscoveryQuery = view === "browse" || view === "saved";

  const feed =
    entitled && view !== "ops" && view !== "radar"
      ? await buildOpportunitiesFeed(companyId ?? undefined, user.id)
      : [];

  const radarFeed =
    entitled && canRadar && view === "radar"
      ? await loadTalepoRadarFeed({
          userId: user.id,
          companyId,
          entitlements,
        })
      : [];

  const discoveryRaw =
    companyId && needsDiscoveryQuery
      ? await queryDiscoveryWorkspace({
          companyId,
          filter: view === "saved" ? null : filter,
          urgentOnly: view === "browse" && urgent,
          watchlistOnly: view === "saved",
          city,
          limit: 40,
          excludeCreatedById: user.id,
          viewerUserId: user.id,
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
      {showCorporateOps ? (
        <section className="py-4 sm:py-6">
          <p className="talepo-page-eyebrow text-xs uppercase tracking-[0.14em]">
            Workspace
          </p>
          <h1 className="talepo-page-title mt-2 text-3xl sm:text-4xl">
            Fırsatlar
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-teal-950/55">
            Şirket fırsatlarını keşfedin, neden önemli olduklarını anlayın ve
            doğru aksiyona bağlayın.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <Link
              href="/panel/firsatlar?view=ops"
              className="rounded-full border border-teal-900/10 bg-white px-3 py-1.5 font-semibold text-teal-900/65"
            >
              Operasyon görünümü
            </Link>
            <Link
              href="/panel/firsatlar?view=radar"
              className="rounded-full border border-teal-900/10 bg-white px-3 py-1.5 font-semibold text-teal-900/65"
            >
              Talepo Radar
            </Link>
            <Link
              href="/panel/takiplerim"
              className="rounded-full border border-teal-900/10 bg-white px-3 py-1.5 font-semibold text-teal-900/65"
            >
              Takiplerim
            </Link>
          </div>
        </section>
      ) : null}

      <FeatureUpgradeGate
        feature="hot_opportunities"
        entitled={entitled}
        presentation="signal"
        title="Fırsatlar"
        description="Sana uygun fırsatlar, Talepo Radar’daki hareketlenen talepler ve Fırsat Havuzu tek yerde."
        ctaLabel="Professional ile aç"
      >
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
            feed={view === "radar" ? radarFeed : feed}
            discoveryItems={discoveryItems}
            taxonomyNode={taxonomyNode}
            taxonomyLeaf={taxonomyLeaf}
            leafExact={leafExact}
            city={city}
            urgent={urgent}
            canSaveSearch={canSaveSearch}
            canCreateAlert={canCreateAlert}
            canWatchlist={canWatchlist}
            canRadar={canRadar}
            trackedSearchCount={trackedSearchCount}
            alertCount={alertCount}
            opportunityContext={companyId ? "WORKSPACE" : "PERSONAL"}
          />
        )}
      </FeatureUpgradeGate>
    </>
  );
}
