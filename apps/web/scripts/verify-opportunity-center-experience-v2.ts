/**
 * Opportunity Center Experience V2 — recommendation eligibility + decision UX.
 * Run: npx tsx scripts/verify-opportunity-center-experience-v2.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  evaluateDiscoveryFilter,
  type CanonicalDiscoveryFilter,
  type RequestDiscoveryProjection,
} from "../src/lib/discovery";
import { canonicalFilterFromSavedSearchFilters } from "../src/lib/monetization/saved-search-canonical";
import {
  buildOpportunityHubSummary,
  isFreshOpportunity,
} from "../src/lib/panel/opportunity-hub-summary";
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
import { primaryRequestCoverImageUrl } from "../src/lib/panel/request-cover-image";
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
      hub.includes("matchReasonList") &&
      hub.includes("fitReasons.map") &&
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
      hub.includes("Genel fırsat") &&
      !hub.includes("Uygunluk için yeterli veri yok") &&
      !hub.includes("Güçlü talep eşleşmesi"),
  );
  check(
    "K percentage not mislabeled as probability",
    hub.includes("Veri güveni") &&
      hub.includes("Sinyal") &&
      hub.includes("/100") &&
      !hub.includes("başarı olasılığı") &&
      !hub.includes("başarı ihtimali") &&
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
        "Kayıtlı aramalarına göre en güçlü fırsatlar burada.",
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
    "compact card uses existing OpportunityCard family",
    hub.includes("function OpportunityCard") &&
      hub.includes("CategoryVisualThumb") &&
      hub.includes("allowCategoryStockImage={false}") &&
      hub.includes("md:flex-row") &&
      hub.includes("Yüksek eşleşme") &&
      !hub.includes("Neden sana uygun") &&
      !hub.includes("Fırsat neden ilginç") &&
      !hub.includes("Dikkat edilmesi gerekenler"),
  );
  check(
    "summary metrics are page-level from full feed",
    hub.includes("function FeedSummaryStrip") &&
      hub.includes("buildOpportunityHubSummary") &&
      hub.includes("metrics={<FeedSummaryStrip items={feed} />}") &&
      !hub.includes("FeedSummaryStrip items={visible}") &&
      hub.includes("En güçlü sinyal") &&
      !hub.includes("Fırsat Bugün") &&
      !hub.includes("Aktif 28 gün kaldı"),
  );
  check(
    "personal tabs stay Önerilen / Keşfet / Acil",
    workspace.includes('label: "Önerilen"') &&
      workspace.includes("Lightbulb") &&
      workspace.includes("Compass") &&
      !workspace.includes("Takip Ettiklerim"),
  );
  check(
    "taxonomy furniture node still exists",
    getTaxonomyNode("tax:furniture")?.id === "tax:furniture",
  );
}

console.log("\n=== SUMMARY + MEDIA CONSISTENCY ===\n");
{
  const hub = read("src/components/panel/OpportunitiesHub.tsx");
  const feedSrc = read("src/server/monetization/opportunities-feed.ts");
  const thumb = read("src/components/visuals/CategoryVisualThumb.tsx");
  const exploreCard = read("src/components/panel/ExploreRequestCard.tsx");
  const detail = read("src/app/panel/talepler/[id]/page.tsx");
  const eligibility = read(
    "src/lib/panel/opportunity-recommended-eligibility.ts",
  );
  const now = Date.parse("2026-08-17T12:00:00.000Z");

  function summaryItem(
    overrides: Partial<Parameters<typeof buildOpportunityHubSummary>[0][number]> & {
      requestId: string;
    },
  ) {
    return {
      context: "PERSONAL" as const,
      matchScore: null,
      matchReasons: [] as string[],
      opportunityClassification: "NORMAL" as const,
      isUrgent: false,
      publishedAt: new Date("2026-08-16T10:00:00.000Z"),
      createdAt: new Date("2026-08-16T10:00:00.000Z"),
      intelligence: { opportunityScore: 50, confidence: 0.5 },
      ...overrides,
    };
  }

  const recommended = summaryItem({
    requestId: "rec",
    matchScore: 100,
    matchReasons: ["Kayıtlı aramanızla eşleşiyor: Mobilya"],
    opportunityClassification: "GOOD",
    intelligence: { opportunityScore: 62, confidence: 0.8 },
  });
  const urgentOnly = summaryItem({
    requestId: "urgent",
    isUrgent: true,
    opportunityClassification: "HOT",
    intelligence: { opportunityScore: 88, confidence: 0.3 },
  });
  const fresh = summaryItem({
    requestId: "fresh",
    publishedAt: new Date("2026-08-17T08:00:00.000Z"),
    createdAt: new Date("2026-08-17T08:00:00.000Z"),
  });
  const universe = [recommended, urgentOnly, fresh];
  const suggested = selectOpportunityHubItems(universe, "suggested");
  const urgentView = selectOpportunityHubItems(universe, "urgent");
  const pageSummary = buildOpportunityHubSummary(universe, now);
  const suggestedSummary = buildOpportunityHubSummary(suggested, now);

  check(
    "A summary counts independent of selected tab",
    pageSummary.recommendedCount === 1 &&
      pageSummary.urgentCount === 1 &&
      suggestedSummary.urgentCount === 0 &&
      hub.includes("metrics={<FeedSummaryStrip items={feed} />}") &&
      !hub.includes("FeedSummaryStrip items={visible}"),
  );
  check(
    "B urgent total correct across views",
    pageSummary.urgentCount === 1 &&
      urgentView.length === 1 &&
      urgentView[0]?.requestId === "urgent" &&
      suggested.every((item) => item.requestId !== "urgent"),
  );
  check(
    "C Personal recommended count follows match eligibility",
    pageSummary.recommendedCount === 1 &&
      isPersonalRecommendedEligible(recommended) &&
      !isPersonalRecommendedEligible(urgentOnly) &&
      !isPersonalRecommendedEligible(fresh),
  );
  check(
    "D media mapper returns real primary image",
    primaryRequestCoverImageUrl("https://cdn.example.com/car.jpg") ===
      "https://cdn.example.com/car.jpg" &&
      primaryRequestCoverImageUrl("  https://cdn.example.com/car.jpg  ") ===
        "https://cdn.example.com/car.jpg" &&
      feedSrc.includes("primaryRequestCoverImageUrl(req.coverImageUrl)") &&
      detail.includes("coverImageUrl={request.coverImageUrl}"),
  );
  check(
    "E fallback when no media",
    primaryRequestCoverImageUrl(null) === null &&
      primaryRequestCoverImageUrl("") === null &&
      primaryRequestCoverImageUrl("   ") === null &&
      primaryRequestCoverImageUrl("javascript:alert(1)") === null,
  );
  check(
    "F OpportunityCard uses real media when available",
    hub.includes("primaryRequestCoverImageUrl(item.coverImageUrl)") &&
      hub.includes("allowCategoryStockImage={false}") &&
      hub.includes("CategoryVisualThumb"),
  );
  check(
    "G Keşfet card same media where supported",
    exploreCard.includes("primaryRequestCoverImageUrl(coverImageUrl)") &&
      exploreCard.includes("CategoryVisualThumb") &&
      read("src/app/panel/talepler/page.tsx").includes(
        "coverImageUrl={request.coverImageUrl}",
      ),
  );
  check(
    "H no fake image",
    !hub.includes("unsplash") &&
      !hub.includes("loremflickr") &&
      !hub.includes("placeholder.com") &&
      !feedSrc.includes("resolveRequestCoverImage") &&
      !thumb.includes("resolveRequestCoverImage") &&
      hub.includes("allowCategoryStockImage={false}"),
  );
  check(
    "I no N+1 external/provider for media",
    feedSrc.includes("coverImageUrl: true") &&
      !/for \(const req of requests\)[\s\S]*resolveRequestCoverImage/.test(
        feedSrc,
      ) &&
      !thumb.includes("fetch(") &&
      !hub.includes("resolveRequestCoverImage"),
  );
  check(
    "J recommendation rules preserved",
    isPersonalRecommendedEligible(yonetici) &&
      !isPersonalRecommendedEligible(iphone) &&
      eligibility.includes("hasGroundedPersonalMatch") &&
      eligibility.includes("isWorkspaceRecommendedEligible"),
  );
  check(
    "K Personal/Workspace isolation",
    !isWorkspaceRecommendedEligible(yonetici) &&
      isWorkspaceRecommendedEligible({
        context: "WORKSPACE",
        matchScore: null,
        matchReasons: [],
        opportunityClassification: "HOT",
        isUrgent: true,
      }) &&
      pageSummary.recommendedCount ===
        universe.filter(isRecommendedEligible).length,
  );
  check(
    "L routing",
    opportunityRequestDetailHref("abc") === "/panel/talepler/abc" &&
      hub.includes("Talebi incele"),
  );
  check(
    "M Saved Search regression",
    isPersonalRecommendedEligible(yonetici) &&
      read("src/server/monetization/personal-matching.ts").includes(
        "evaluateDiscoveryFilter",
      ),
  );
  check(
    "N nested form regression source present",
    existsSync(join(root, "scripts/verify-saved-search-nested-form-v1.ts")),
  );
  check(
    "new count uses 24h freshness not selected tab",
    pageSummary.newCount === 1 &&
      isFreshOpportunity(fresh, now) &&
      !isFreshOpportunity(recommended, now),
  );
  check(
    "strongest signal from recommended set not tab average",
    pageSummary.strongestSignalScore === 62 &&
      pageSummary.strongestSignalConfidence === 0.8 &&
      buildOpportunityHubSummary([], now).strongestSignalScore === null,
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
