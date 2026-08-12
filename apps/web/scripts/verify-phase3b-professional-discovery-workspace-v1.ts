/**
 * Phase 3B — Professional Discovery Workspace golden fixtures.
 * Run: npx tsx scripts/verify-phase3b-professional-discovery-workspace-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ensureAutomotiveCatalogRegistered } from "../src/lib/catalog";
import {
  buildCanonicalFilterFromWorkspaceParams,
  buildDiscoveryProjectionFromState,
  discoveryFilterToSavedSearch,
  discoveryFilterToWorkspaceUrl,
  evaluateDiscoveryFilter,
  followCategoryToSavedSearch,
  hasCanonicalFilterSignal,
  isCandidateCompatibleWithProjection,
  matchBandFromSignals,
  matchBandLabel,
  searchTaxonomyNodes,
  summarizeCanonicalFilter,
  summarizeSavedSearchFilters,
  taxonomyPathForNode,
  validateCanonicalDiscoveryFilter,
} from "../src/lib/discovery";
import { createTextOnlyState } from "../src/lib/request-composer";
import {
  ensureTaxonomyLoaded,
  getRootTaxonomyNodes,
  getTaxonomyChildren,
  getTaxonomyDescendantIds,
  getTaxonomyNode,
  isTaxonomyLeaf,
  resolveTaxonomyAlias,
} from "../src/lib/taxonomy";

let pass = 0;
let fail = 0;
const errors: string[] = [];

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass += 1;
    console.log(`PASS — ${name}`);
  } else {
    fail += 1;
    const msg = detail ? `${name}: ${detail}` : name;
    errors.push(msg);
    console.log(`FAIL — ${msg}`);
  }
}

ensureAutomotiveCatalogRegistered();
ensureTaxonomyLoaded();

const root = join(__dirname, "..");

// --- 1 Professional workspace loads (page + component exist) ---
{
  const page = readFileSync(
    join(root, "src/app/panel/firsatlar/page.tsx"),
    "utf8",
  );
  const hub = readFileSync(
    join(
      root,
      "src/components/panel/discovery/ProfessionalDiscoveryWorkspace.tsx",
    ),
    "utf8",
  );
  check(
    "1 Professional workspace loads",
    page.includes("ProfessionalDiscoveryWorkspace") &&
      hub.includes("Keşfet") &&
      hub.includes("Kaydettiklerim"),
  );
}

// --- 2 taxonomy root browse ---
{
  const roots = getRootTaxonomyNodes();
  check("2 taxonomy root browse", roots.length >= 8);
}

// --- 3 taxonomy child browse ---
{
  const auto = getRootTaxonomyNodes().find((n) => n.categoryId === "automotive");
  const kids = auto ? getTaxonomyChildren(auto.id) : [];
  check("3 taxonomy child browse", kids.length > 0, String(kids.length));
}

// --- 4 leaf selection ---
{
  const far = resolveTaxonomyAlias("ön far", "automotive")?.node;
  check(
    "4 leaf selection",
    Boolean(far && isTaxonomyLeaf(far)),
    far?.id,
  );
}

// --- 5 ancestor filtering ---
{
  const state = createTextOnlyState("Golf 7 sağ ön far arıyorum");
  const proj = buildDiscoveryProjectionFromState(state);
  const lighting = proj.taxonomyNodeIds.find((id) => id.includes("lighting"));
  check(
    "5 ancestor filtering",
    Boolean(lighting) &&
      evaluateDiscoveryFilter(proj, {
        version: 1,
        kind: "canonical_discovery_filter",
        taxonomyNodeIds: lighting ? [lighting] : [],
      }).match,
  );
}

// --- 6 exact leaf ---
{
  const state = createTextOnlyState("Golf 7 sağ ön far arıyorum");
  const proj = buildDiscoveryProjectionFromState(state);
  const leaf = proj.primaryLeafId!;
  check(
    "6 exact leaf",
    evaluateDiscoveryFilter(proj, {
      version: 1,
      kind: "canonical_discovery_filter",
      primaryLeafId: leaf,
      leafExact: true,
    }).match,
  );
}

// --- 7 taxonomy search ---
{
  const hits = searchTaxonomyNodes("far", { limit: 8 });
  check(
    "7 taxonomy search",
    hits.some((h) => /far|headlamp|aydınlat/i.test(h.label + h.id)),
  );
}

// --- 8 active filter state ---
{
  const filter = buildCanonicalFilterFromWorkspaceParams({
    taxonomyLeaf: "tax:automotive:yedek-parca:lighting:external:on-far",
    leafExact: true,
    city: "İstanbul",
    urgent: true,
  });
  check(
    "8 active filter state",
    Boolean(filter?.primaryLeafId && filter.location?.city && filter.urgency),
  );
}

// --- 9 dynamic attributes (projection attributes reusable) ---
{
  const state = createTextOnlyState(
    "140 ekran televizyon arıyorum, marka fark etmez ama Samsung olmasın",
  );
  const proj = buildDiscoveryProjectionFromState(state);
  check("9 dynamic attributes", proj.attributes.screenSize === "140");
}

// --- 10 ANY ---
{
  const state = createTextOnlyState(
    "140 ekran televizyon arıyorum, marka fark etmez ama Samsung olmasın",
  );
  const proj = buildDiscoveryProjectionFromState(state);
  check("10 ANY semantics", proj.constraints.brand?.mode === "ANY");
}

// --- 11 EXCLUDED ---
{
  const state = createTextOnlyState(
    "140 ekran televizyon arıyorum, marka fark etmez ama Samsung olmasın",
  );
  const proj = buildDiscoveryProjectionFromState(state);
  const r = evaluateDiscoveryFilter(proj, {
    version: 1,
    kind: "canonical_discovery_filter",
    attributes: { brand: "Samsung" },
  });
  check("11 EXCLUDED semantics", !r.match);
}

// --- 12 MUST ---
{
  const state = createTextOnlyState(
    "140 ekran televizyon arıyorum mutlaka 4K olsun",
  );
  const proj = buildDiscoveryProjectionFromState(state);
  check(
    "12 MUST",
    proj.constraints.resolution?.strength === "MUST" ||
      proj.attributes.resolution === "4K",
  );
}

// --- 13 PREFERRED not hard ---
{
  const state = createTextOnlyState(
    "140 ekran televizyon arıyorum, 4K olsa iyi olur",
  );
  const proj = buildDiscoveryProjectionFromState(state);
  const cand = isCandidateCompatibleWithProjection(proj, {
    resolution: "1080p",
    brand: "LG",
  });
  check("13 PREFERRED not hard filter", cand.compatible);
}

// --- 14 range ---
{
  const state = createTextOnlyState(
    "50 bin adet karton kutu istiyorum, tercihen mat selefonlu",
  );
  const proj = buildDiscoveryProjectionFromState(state);
  check(
    "14 range",
    Number(String(proj.attributes.quantity).replace(/\D/g, "")) >= 40000 ||
      (proj.constraints.quantity?.range?.min ?? 0) >= 40000,
  );
}

// --- 15 geo ---
{
  const filter = buildCanonicalFilterFromWorkspaceParams({
    city: "İstanbul",
  });
  check("15 geo", filter?.location?.city === "İstanbul");
}

// --- 16 urgency ---
{
  const filter = buildCanonicalFilterFromWorkspaceParams({ urgent: true });
  check("16 urgency", filter?.urgency === true);
}

// --- 17 save canonical search ---
{
  const filter = buildCanonicalFilterFromWorkspaceParams({
    taxonomyLeaf: "tax:printing:karton-kutu",
    leafExact: true,
  })!;
  const saved = discoveryFilterToSavedSearch(filter);
  check(
    "17 save canonical search",
    saved.canonical?.kind === "canonical_discovery_filter" &&
      saved.version === 1,
  );
}

// --- 18 load saved search (URL derive) ---
{
  const filter = buildCanonicalFilterFromWorkspaceParams({
    taxonomyNode: "tax:automotive:yedek-parca:lighting",
  })!;
  const url = discoveryFilterToWorkspaceUrl(filter);
  check(
    "18 load saved search URL",
    url.includes("/panel/firsatlar") && url.includes("taxonomyNode="),
  );
}

// --- 19 create alert from search (filter shape) ---
{
  const filter = buildCanonicalFilterFromWorkspaceParams({
    taxonomyLeaf: "tax:automotive:yedek-parca:lighting:external:on-far",
    leafExact: true,
    city: "İstanbul",
  })!;
  const validated = validateCanonicalDiscoveryFilter(filter);
  check("19 create alert from search", validated.ok);
}

// --- 20 canonical alert summary ---
{
  const filter = buildCanonicalFilterFromWorkspaceParams({
    taxonomyLeaf: "tax:automotive:yedek-parca:lighting:external:on-far",
    leafExact: true,
    city: "İstanbul",
  })!;
  const summary = summarizeCanonicalFilter(filter);
  check(
    "20 canonical alert summary",
    summary.includes("›") || /far|aydınlat|otomotiv/i.test(summary),
  );
}

// --- 21 follow category ---
{
  const followed = followCategoryToSavedSearch({
    nodeId: "tax:automotive:yedek-parca:lighting",
    leafExact: false,
  });
  check(
    "21 follow category",
    followed.canonical?.taxonomyNodeIds?.[0] ===
      "tax:automotive:yedek-parca:lighting" && !followed.canonical.leafExact,
  );
}

// --- 22 parent follow descendants ---
{
  const lighting = "tax:automotive:yedek-parca:lighting";
  const descendants = getTaxonomyDescendantIds(lighting);
  const far = resolveTaxonomyAlias("ön far", "automotive")?.node?.id;
  check(
    "22 parent follow descendants",
    Boolean(far && descendants.includes(far)),
  );
}

// --- 23 leaf follow exact ---
{
  const far = resolveTaxonomyAlias("ön far", "automotive")?.node?.id!;
  const followed = followCategoryToSavedSearch({
    nodeId: far,
    leafExact: true,
  });
  check(
    "23 leaf follow exact",
    followed.canonical?.leafExact === true &&
      followed.canonical.primaryLeafId === far,
  );
}

// --- 24 request bookmark distinct ---
{
  const hub = readFileSync(
    join(root, "src/components/panel/OpportunitiesHub.tsx"),
    "utf8",
  );
  const actions = readFileSync(
    join(
      root,
      "src/components/panel/discovery/DiscoveryWorkspaceActions.tsx",
    ),
    "utf8",
  );
  check(
    "24 request bookmark distinct",
    hub.includes("Kaydettiklerim") &&
      actions.includes("Kategori takibi") &&
      actions.includes("watchlist"),
  );
}

// --- 25 empty-state follow CTA ---
{
  const ws = readFileSync(
    join(
      root,
      "src/components/panel/discovery/ProfessionalDiscoveryWorkspace.tsx",
    ),
    "utf8",
  );
  check(
    "25 empty-state follow CTA",
    ws.includes("Bu kategoride şu an aktif talep yok") &&
      ws.includes("DiscoveryWorkspaceActions"),
  );
}

// --- 26 entitlement server guard ---
{
  const page = readFileSync(
    join(root, "src/app/panel/firsatlar/page.tsx"),
    "utf8",
  );
  check(
    "26 entitlement server guard",
    page.includes('hot_opportunities') && page.includes("FeatureUpgradeGate"),
  );
}

// --- 27 Premium gate ---
{
  const ent = readFileSync(
    join(root, "src/lib/membership/entitlements.ts"),
    "utf8",
  );
  const premiumStart = ent.indexOf("const PREMIUM_KEYS");
  const professionalStart = ent.indexOf("const PROFESSIONAL_KEYS");
  const premiumBlock = ent.slice(premiumStart, professionalStart);
  const professionalBlock = ent.slice(
    professionalStart,
    ent.indexOf("const CORPORATE_KEYS"),
  );
  check(
    "27 Premium gate",
    premiumStart >= 0 &&
      !premiumBlock.includes("hot_opportunities") &&
      professionalBlock.includes("hot_opportunities"),
  );
}

// --- 28 Standard compatibility (explore still exists) ---
{
  const explore = readFileSync(
    join(root, "src/app/panel/talepler/page.tsx"),
    "utf8",
  );
  check(
    "28 Standard compatibility",
    explore.includes("ExploreRequestsPage") ||
      explore.includes("applyCanonicalDiscoveryPostFilter"),
  );
}

// --- 29 legacy request visibility ---
{
  const r = evaluateDiscoveryFilter(null, {
    version: 1,
    kind: "canonical_discovery_filter",
    primaryLeafId: "tax:technology:televizyon",
    leafExact: true,
  });
  check(
    "29 legacy request visibility",
    r.match && r.path === "LEGACY_FALLBACK",
  );
}

// --- 30 match reason display ---
{
  const card = readFileSync(
    join(root, "src/components/panel/discovery/DiscoveryResultCard.tsx"),
    "utf8",
  );
  check(
    "30 match reason display",
    card.includes("Neden uygun") && card.includes("matchBandLabel"),
  );
}

// --- 31 no request reparse ---
{
  const query = readFileSync(
    join(root, "src/server/monetization/discovery-workspace-query.ts"),
    "utf8",
  );
  check(
    "31 no request reparse",
    query.includes("parseDiscoveryProjection") &&
      !query.includes("understandRequest") &&
      !query.includes("createTextOnlyState"),
  );
}

// --- 32 no second taxonomy ---
{
  const browse = readFileSync(
    join(root, "src/components/panel/discovery/TaxonomyCascadeBrowse.tsx"),
    "utf8",
  );
  check(
    "32 no second taxonomy",
    browse.includes("getRootTaxonomyNodes") &&
      browse.includes("getTaxonomyChildren") &&
      browse.includes("Master Taxonomy"),
  );
}

// --- 33 URL derived from canonical state ---
{
  const url = discoveryFilterToWorkspaceUrl({
    version: 1,
    kind: "canonical_discovery_filter",
    primaryLeafId: "tax:printing:karton-kutu",
    leafExact: true,
  });
  check(
    "33 URL derived from canonical state",
    url.includes("taxonomyLeaf=") && url.includes("view=browse"),
  );
}

// --- 34 mobile smoke (responsive classes present) ---
{
  const ws = readFileSync(
    join(
      root,
      "src/components/panel/discovery/ProfessionalDiscoveryWorkspace.tsx",
    ),
    "utf8",
  );
  check(
    "34 mobile smoke",
    ws.includes("lg:grid-cols") || ws.includes("flex-wrap"),
  );
}

// --- 35 desktop smoke ---
{
  const browse = readFileSync(
    join(root, "src/components/panel/discovery/TaxonomyCascadeBrowse.tsx"),
    "utf8",
  );
  check(
    "35 desktop smoke",
    browse.includes("overflow-x-auto") && browse.includes("max-h-"),
  );
}

// --- extras: match band not fake % ---
{
  const band = matchBandFromSignals({
    matchPath: "CANONICAL_MATCH",
    reasonCodes: ["TAXONOMY_MATCH", "LOCATION_MATCH"],
    hasTaxonomy: true,
    hasLocation: true,
  });
  check(
    "band label not percent",
    matchBandLabel(band) === "Yüksek eşleşme" &&
      !String(matchBandLabel(band)).includes("%"),
  );
}

// --- path labels ---
{
  const path = taxonomyPathForNode(
    "tax:automotive:yedek-parca:lighting:external:on-far",
  );
  check("path labels non-empty", path.length >= 2);
}

// --- saved search summary ---
{
  const summary = summarizeSavedSearchFilters({
    version: 1,
    canonical: {
      version: 1,
      kind: "canonical_discovery_filter",
      taxonomyNodeIds: ["tax:printing:karton-kutu"],
    },
  });
  check("saved search summary", summary.length > 3);
}

// --- hasCanonicalFilterSignal ---
{
  check(
    "canonical signal",
    hasCanonicalFilterSignal({
      version: 1,
      kind: "canonical_discovery_filter",
      primaryLeafId: "tax:printing:karton-kutu",
    }),
  );
}

// --- node exists ---
{
  check(
    "far node exists",
    Boolean(getTaxonomyNode("tax:automotive:yedek-parca:lighting:external:on-far")),
  );
}

console.log("\n========================================");
console.log(`Phase 3B verify: ${pass} passed, ${fail} failed`);
if (errors.length) {
  console.log("Failures:");
  for (const e of errors) console.log(`  - ${e}`);
}
process.exit(fail > 0 ? 1 : 0);
