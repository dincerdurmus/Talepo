/**
 * Opportunity Center Experience V2 — recommendation eligibility + decision UX.
 * Run: npx tsx scripts/verify-opportunity-center-experience-v2.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  evaluateDiscoveryFilter,
  type CanonicalDiscoveryFilter,
  type RequestDiscoveryProjection,
} from "../src/lib/discovery";
import { canonicalFilterFromSavedSearchFilters } from "../src/lib/monetization/saved-search-canonical";
import {
  hasGroundedPersonalMatch,
  isPersonalRecommendedEligible,
  isRecommendedEligible,
  isWorkspaceRecommendedEligible,
  selectOpportunityHubItems,
  sortPersonalRecommended,
} from "../src/lib/panel/opportunity-recommended-eligibility";
import { opportunityRequestDetailHref } from "../src/lib/panel/opportunity-request-detail-href";
import { isOpportunitySaveSupported } from "../src/lib/panel/opportunity-save-support";
import { ensureTaxonomyLoaded, getTaxonomyNode } from "../src/lib/taxonomy";
import {
  buildOpportunityIntelligence,
  OPPORTUNITY_ACTION_LABELS,
} from "../src/server/monetization/opportunity-intelligence";

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

ensureTaxonomyLoaded();
const root = join(__dirname, "..");
function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

const FURNITURE_LEAF =
  "tax:furniture:ofis-sandalyesi:sandalye-tipleri:yonetici-koltugu";
const FURNITURE_SIBLING =
  "tax:furniture:ofis-sandalyesi:sandalye-tipleri:operasyon-koltugu";
const FURNITURE_PATH = [
  "tax:furniture",
  "tax:furniture:ofis-sandalyesi",
  "tax:furniture:ofis-sandalyesi:sandalye-tipleri",
  FURNITURE_LEAF,
];

function furnitureLeafProjection(): RequestDiscoveryProjection {
  return {
    version: 1,
    kind: "discovery_projection",
    taxonomyNodeIds: FURNITURE_PATH,
    primaryLeafId: FURNITURE_LEAF,
    categoryId: "furniture",
    subcategorySlug: "ofis-sandalyesi",
    attributes: {},
    constraints: {},
    matchContract: {
      must: [],
      preferred: [],
      excluded: [],
      anyFields: [],
      ranges: [],
    },
    filterContract: {
      include: {},
      exclude: {},
      preferred: {},
      range: {},
      any: [],
    },
    builtAt: "2026-08-16T00:00:00.000Z",
  };
}

function nodeFilter(nodeId: string): CanonicalDiscoveryFilter {
  return {
    version: 1,
    kind: "canonical_discovery_filter",
    taxonomyNodeIds: [nodeId],
  };
}

type FeedLike = {
  context: "PERSONAL" | "WORKSPACE";
  matchScore: number | null;
  matchReasons: string[];
  opportunityClassification: "NORMAL" | "GOOD" | "HOT";
  isUrgent: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  opportunityScore: number;
  competition: "LOW" | "MEDIUM" | "HIGH";
  requestId: string;
};

function personalItem(
  overrides: Partial<FeedLike> & Pick<FeedLike, "requestId">,
): FeedLike {
  return {
    context: "PERSONAL",
    matchScore: null,
    matchReasons: [],
    opportunityClassification: "HOT",
    isUrgent: false,
    publishedAt: new Date("2026-08-16T10:00:00.000Z"),
    createdAt: new Date("2026-08-16T10:00:00.000Z"),
    opportunityScore: 80,
    competition: "LOW",
    ...overrides,
  };
}

const yonetici = personalItem({
  requestId: "yonetici",
  matchScore: 100,
  matchReasons: ["Kayıtlı aramanızla eşleşiyor: [E2E TEST] Mobilya ve Ofis"],
  opportunityClassification: "GOOD",
  isUrgent: false,
  competition: "MEDIUM",
  opportunityScore: 55,
});
const mercedes = personalItem({
  requestId: "mercedes",
  matchScore: null,
  matchReasons: [],
  opportunityClassification: "HOT",
  isUrgent: false,
  competition: "LOW",
  opportunityScore: 82,
});
const iphone = personalItem({
  requestId: "iphone",
  matchScore: null,
  matchReasons: [],
  opportunityClassification: "GOOD",
  isUrgent: true,
  competition: "LOW",
  opportunityScore: 70,
});
const urgentMatch = personalItem({
  requestId: "urgent-match",
  matchScore: 100,
  matchReasons: ["Alarm tercihinizle eşleşiyor: Ofis"],
  isUrgent: true,
  opportunityClassification: "HOT",
  competition: "LOW",
  publishedAt: new Date("2026-08-16T12:00:00.000Z"),
  opportunityScore: 90,
});

const feed = [mercedes, iphone, yonetici, urgentMatch];

console.log("\n=== A–D RECOMMENDED ELIGIBILITY ===\n");
check(
  "A positive Saved Search match → Önerilen",
  isPersonalRecommendedEligible(yonetici) &&
    selectOpportunityHubItems(feed, "suggested").some(
      (item) => item.requestId === "yonetici",
    ),
);
check(
  "B matchScore=null + no matchReasons → NOT Önerilen",
  !hasGroundedPersonalMatch(mercedes) &&
    !isPersonalRecommendedEligible(mercedes) &&
    !isPersonalRecommendedEligible(iphone) &&
    selectOpportunityHubItems(feed, "suggested").every(
      (item) => item.requestId !== "mercedes" && item.requestId !== "iphone",
    ),
);
check(
  "C non-matching request still in Keşfet",
  selectOpportunityHubItems(feed, "browse").some(
    (item) => item.requestId === "mercedes",
  ) &&
    selectOpportunityHubItems(feed, "browse").some(
      (item) => item.requestId === "iphone",
    ) &&
    selectOpportunityHubItems(feed, "browse").length === feed.length,
);
check(
  "D urgent non-match in Acil, not Önerilen solely due urgency",
  selectOpportunityHubItems(feed, "urgent").some(
    (item) => item.requestId === "iphone",
  ) &&
    !selectOpportunityHubItems(feed, "suggested").some(
      (item) => item.requestId === "iphone",
    ) &&
    isRecommendedEligible({
      ...iphone,
      opportunityClassification: "HOT",
    }) === false,
);

console.log("\n=== E–G CANONICAL MATCH PRESERVED ===\n");
{
  const projection = furnitureLeafProjection();
  const ancestor = evaluateDiscoveryFilter(
    projection,
    nodeFilter("tax:furniture"),
  );
  const leafExactSibling = evaluateDiscoveryFilter(projection, {
    version: 1,
    kind: "canonical_discovery_filter",
    primaryLeafId: FURNITURE_SIBLING,
    leafExact: true,
  });
  const leafExactSelf = evaluateDiscoveryFilter(projection, {
    version: 1,
    kind: "canonical_discovery_filter",
    primaryLeafId: FURNITURE_LEAF,
    leafExact: true,
  });
  const legacy = canonicalFilterFromSavedSearchFilters({
    version: 1,
    categorySlug: "furniture",
  });
  check(
    "E legacy categorySlug compatibility preserved",
    Boolean(legacy?.taxonomyNodeIds?.some((id) => id.startsWith("tax:furniture"))),
  );
  check(
    "F ancestor→descendant preserved",
    ancestor.match === true,
  );
  check(
    "G leafExact sibling exclusion preserved",
    leafExactSibling.match === false && leafExactSelf.match === true,
  );
}

console.log("\n=== H–L CARD COPY / SIGNALS ===\n");
{
  const hub = read("src/components/panel/OpportunitiesHub.tsx");
  const intel = buildOpportunityIntelligence({
    context: "PERSONAL",
    matchScore: 100,
    matchReasons: ["Kayıtlı aramanızla eşleşiyor: [E2E TEST] Mobilya ve Ofis"],
    isUrgent: false,
    requestCompleteness: 40,
    ageHours: 8,
    inventoryFit: "UNKNOWN",
    pricePosition: "UNKNOWN",
    offerCount: 0,
  });
  const unknown = buildOpportunityIntelligence({
    context: "PERSONAL",
    matchScore: null,
    isUrgent: false,
    requestCompleteness: null,
    ageHours: 72,
    inventoryFit: "UNKNOWN",
    pricePosition: "UNKNOWN",
  });
  check(
    "H match reason surfaced",
    hub.includes("item.matchReasons") &&
      hub.includes("Neden sana uygun") &&
      intel.reasons.some((reason) => /Kayıtlı aramanızla/.test(reason)),
  );
  check(
    "I competition surfaced",
    hub.includes("COMPETITION_LABELS") &&
      hub.includes("Düşük rekabet") &&
      hub.includes("item.competition"),
  );
  check(
    "J UNKNOWN honest",
    unknown.fitLevel === "UNKNOWN" &&
      hub.includes("Uygunluk için yeterli veri yok") &&
      !hub.includes("Güçlü talep eşleşmesi"),
  );
  check(
    "K percentage not mislabeled as probability",
    hub.includes("Veri güveni") &&
      hub.includes("başarı olasılığı değildir") &&
      !hub.includes("% · ") &&
      !/% · /.test(hub),
  );
  check(
    "L recommended action context-aware human copy",
    hub.includes('REVIEW_REQUEST: "Talebi ayrıntılı incele"') &&
      hub.includes('WAIT_FOR_MORE_INFO: "Eksik bilgiler netleşince tekrar bak"') &&
      OPPORTUNITY_ACTION_LABELS.WAIT_FOR_MORE_INFO ===
        "Eksik bilgiler netleşince tekrar bak",
  );
}

console.log("\n=== M–P SAVE / INVENTORY / TABS ===\n");
{
  const hub = read("src/components/panel/OpportunitiesHub.tsx");
  const workspace = read(
    "src/components/panel/discovery/ProfessionalDiscoveryWorkspace.tsx",
  );
  const page = read("src/app/panel/firsatlar/page.tsx");
  const helper = read("src/lib/panel/opportunity-save-support.ts");
  const engine = read("src/server/monetization/opportunity-intelligence.ts");
  const personalPromising = buildOpportunityIntelligence({
    context: "PERSONAL",
    matchScore: 88,
    matchReasons: ["Kayıtlı aramanızla eşleşiyor: Mobilya"],
    isUrgent: false,
    requestCompleteness: 90,
    ageHours: 2,
    inventoryFit: "UNKNOWN",
    pricePosition: "UNKNOWN",
    offerCount: 0,
  });
  const workspacePromising = buildOpportunityIntelligence({
    context: "WORKSPACE",
    matchScore: 88,
    matchReasons: ["Kategori eşleşiyor"],
    isUrgent: false,
    requestCompleteness: 90,
    ageHours: 2,
    inventoryFit: "UNKNOWN",
    pricePosition: "UNKNOWN",
    offerCount: 0,
  });
  check(
    "M Personal no inventory action",
    personalPromising.recommendedAction !== "CHECK_INVENTORY" &&
      personalPromising.recommendedAction === "REVIEW_REQUEST" &&
      engine.includes('context === "PERSONAL" && candidate === "CHECK_INVENTORY"'),
  );
  check(
    "N Workspace inventory action preserved",
    workspacePromising.recommendedAction === "CHECK_INVENTORY" &&
      hub.includes('CHECK_INVENTORY: "Envanteri kontrol et"'),
  );
  check(
    "O Personal dead save absent",
    !isOpportunitySaveSupported({
      context: "PERSONAL",
      canWatchlist: true,
    }) &&
      helper.includes("Personal has no user-owned watchlist row") &&
      page.includes(
        'Boolean(companyId) && hasFeature(entitlements.features, "watchlist")',
      ) &&
      workspace.includes('tab.id !== "saved" || canWatchlist'),
  );
  check(
    "P Workspace watchlist preserved",
    isOpportunitySaveSupported({
      context: "WORKSPACE",
      canWatchlist: true,
    }) &&
      hub.includes("showSavedSection = canWatchlist") &&
      hub.includes("Kaydettiklerim"),
  );
}

console.log("\n=== Q–U ROUTING / ISOLATION ===\n");
{
  const hub = read("src/components/panel/OpportunitiesHub.tsx");
  const page = read("src/app/panel/firsatlar/page.tsx");
  const detail = read("src/app/panel/talepler/[id]/page.tsx");
  const offerPage = read("src/app/panel/talepler/[id]/teklif/page.tsx");
  const matcher = read("src/server/monetization/personal-matching.ts");
  const feedSrc = read("src/server/monetization/opportunities-feed.ts");
  const REQUEST_ID = "11111111-2222-3333-4444-555555555555";
  const href = opportunityRequestDetailHref(REQUEST_ID);
  check(
    "Q title + CTA canonical request detail",
    href === `/panel/talepler/${REQUEST_ID}` &&
      (hub.match(/opportunityRequestDetailHref\(item\.requestId\)/g) ?? [])
        .length === 1 &&
      hub.includes("Talebi incele"),
  );
  check(
    "R title and CTA share detailHref",
    hub.includes("detailHref") &&
      hub.includes("{detailHref ? (") &&
      !hub.includes("`/panel/talepler/${item.requestId}`"),
  );
  check(
    "S no 404 for valid request (owner can view)",
    !detail.includes("createdById: { not: user.id }") &&
      detail.includes("deletedAt: null") &&
      offerPage.includes("createdById: { not: user.id }"),
  );
  check(
    "T personal/workspace isolation — matcher USER-only",
    matcher.includes('ownerType: "USER"') &&
      matcher.includes("matchPersonalToRequest") &&
      !/ownerType:\s*"COMPANY"/.test(matcher) &&
      feedSrc.includes("matchPersonalToRequest") &&
      feedSrc.includes("matchCompanyToRequest"),
  );
  check(
    "U no company leak into personal recommended",
    page.includes('opportunityContext={companyId ? "WORKSPACE" : "PERSONAL"}') &&
      !isWorkspaceRecommendedEligible(yonetici) &&
      isPersonalRecommendedEligible(yonetici) &&
      isWorkspaceRecommendedEligible({
        context: "WORKSPACE",
        matchScore: null,
        matchReasons: [],
        opportunityClassification: "HOT",
        isUrgent: true,
      }),
  );
}

console.log("\n=== SORT / TABS / HEADER / OWNER CTA ===\n");
{
  const hub = read("src/components/panel/OpportunitiesHub.tsx");
  const page = read("src/app/panel/firsatlar/page.tsx");
  const workspace = read(
    "src/components/panel/discovery/ProfessionalDiscoveryWorkspace.tsx",
  );
  const detail = read("src/app/panel/talepler/[id]/page.tsx");
  const sorted = sortPersonalRecommended([yonetici, urgentMatch]);
  check(
    "personal recommended sort uses existing signals only",
    sorted[0]?.requestId === "urgent-match" &&
      sorted[1]?.requestId === "yonetici",
  );
  check(
    "personal tabs do not share one filter",
    workspace.includes('label: "Önerilen"') &&
      workspace.includes('label: "Keşfet"') &&
      workspace.includes('label: "Acil"') &&
      workspace.includes("selectOpportunityHubItems") === false &&
      hub.includes("selectOpportunityHubItems") &&
      hub.includes('view === "browse"') &&
      hub.includes('view === "urgent"'),
  );
  check(
    "personal header copy",
    page.includes("Sana uygun fırsatlar") &&
      page.includes(
        "Talepo talepleri senin için değerlendirir; güçlü eşleşmeleri ve nedenlerini burada gösterir.",
      ),
  );
  check(
    "personal empty state",
    hub.includes("Henüz sana güçlü şekilde uyan bir fırsat yok.") &&
      hub.includes("/panel/kayitli-aramalar") &&
      hub.includes("/panel/uyarilar") &&
      hub.includes("/panel/firsatlar?view=browse"),
  );
  check(
    "request owner CTA hidden",
    detail.includes("isRequestOwner") &&
      detail.includes("Bu sizin talebiniz") &&
      detail.includes("createdById === user.id"),
  );
  check(
    "no second matching engine",
    !hub.includes("Talepo Score") &&
      !read("src/lib/panel/opportunity-recommended-eligibility.ts").includes(
        "magic",
      ) &&
      read("src/server/monetization/personal-matching.ts").includes(
        "evaluateDiscoveryFilter",
      ),
  );
  check(
    "taxonomy furniture node still exists",
    getTaxonomyNode("tax:furniture")?.id === "tax:furniture",
  );
}

console.log(
  `\nOpportunity Center Experience V2: ${pass}/${pass + fail} PASS`,
);
if (fail > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("Opportunity Center Experience V2 verifier passed.");
