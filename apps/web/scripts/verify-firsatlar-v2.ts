/**
 * Fırsatlar V2 — reason-first IA, FOLLOW attribution, Acil tab removal.
 * Run: npx tsx scripts/verify-firsatlar-v2.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  demoteAlreadyOffered,
  hasGroundedPersonalMatch,
  isOtherOpportunityEligible,
  isPersonalRecommendedEligible,
  sortPersonalRecommended,
} from "../src/lib/panel/opportunity-recommended-eligibility";
import {
  RADAR_FAST_RECENT_OFFERS,
  RADAR_HOT_ELIGIBLE_OFFERS,
  RADAR_HOT_RECENT_OFFERS,
  RADAR_MIN_ELIGIBLE_OFFERS,
  classifyRadarTier,
} from "../src/lib/monetization/talepo-radar";
import { OFFER_ACQUISITION_SOURCE_LABELS } from "../src/lib/offer/offer-attribution";
import {
  matchPersonalAgainstPreferences,
  type PersonalPreferenceFilter,
} from "../src/server/monetization/personal-matching-core";
import type { RequestDiscoveryProjection } from "../src/lib/discovery";

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

const root = join(__dirname, "..");
function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

const page = read("src/app/panel/firsatlar/page.tsx");
const workspace = read(
  "src/components/panel/discovery/ProfessionalDiscoveryWorkspace.tsx",
);
const hub = read("src/components/panel/OpportunitiesHub.tsx");
const feed = read("src/server/monetization/opportunities-feed.ts");
const core = read("src/server/monetization/personal-matching-core.ts");
const radarLib = read("src/lib/monetization/talepo-radar.ts");
const oi = read("src/lib/monetization/offer-intelligence.ts");

console.log("\n=== TABS / IA ===\n");
{
  check(
    "13 no Acil user-facing tab",
    !workspace.includes('label: "Acil"') &&
      !workspace.includes('id: "urgent"'),
  );
  check(
    "29 four personal opportunity tabs",
    workspace.includes('label: "Önerilen"') &&
      workspace.includes('label: "Talepo Radar"') &&
      workspace.includes('label: "Fırsat Havuzu"') &&
      workspace.includes('label: "Takip"') &&
      workspace.includes('id: "tracking"'),
  );
  check(
    "8 Fırsat Havuzu label",
    workspace.includes('label: "Fırsat Havuzu"') &&
      !workspace.includes('label: "Diğer Fırsatlar"'),
  );
  check(
    "16 legacy urgent redirects to browse",
    page.includes('params.view === "urgent"') &&
      page.includes('q.set("view", "browse")') &&
      page.includes('q.set("urgent", "1")') &&
      page.includes("redirect("),
  );
  check("14 urgent badge preserved", hub.includes('tone="urgent">Acil'));
}

console.log("\n=== ATTRIBUTION ===\n");
{
  check(
    "3 recommended FOLLOW touch",
    feed.includes('source: "FOLLOW"') &&
      feed.includes("matchedPreference") &&
      feed.includes("savedSearchId") &&
      feed.includes("alertRuleId"),
  );
  check(
    "matchedPreference in personal match",
    core.includes("matchedPreference") && core.includes("preference.id"),
  );
  check(
    "non-grounded still DISCOVERY",
    feed.includes('source: "DISCOVERY"'),
  );
  check(
    "9 Radar RADAR attribution unchanged",
    read("src/server/monetization/talepo-radar.ts").includes(
      'source: "RADAR"',
    ),
  );
  check(
    "30 Analiz FOLLOW label",
    OFFER_ACQUISITION_SOURCE_LABELS.FOLLOW === "Takiplerim" &&
      OFFER_ACQUISITION_SOURCE_LABELS.RADAR === "Talepo Radar" &&
      OFFER_ACQUISITION_SOURCE_LABELS.OPPORTUNITY === "Fırsatlar" &&
      OFFER_ACQUISITION_SOURCE_LABELS.DISCOVERY === "Talepler",
  );
}

console.log("\n=== REASON / SCORE UI ===\n");
{
  check(
    "2 primary reason badge",
    hub.includes("primaryReason") &&
      hub.includes("<OpportunityBadge tone=\"match\">{primaryReason}"),
  );
  check(
    "21 personal hides 0–100 primary",
    hub.includes("showScoreStrip") &&
      hub.includes('opportunityContext === "WORKSPACE"'),
  );
  check(
    "no personal Güçlü fırsat on grounded",
    hub.includes("hasGroundedMatch") &&
      hub.includes("return null") &&
      hub.includes("Personal grounded match"),
  );
  check(
    "23 no competitor prices / OI on cards",
    !hub.includes("median") &&
      !hub.includes("viewerVsMedian") &&
      !oi.includes("OpportunityCard"),
  );
}

console.log("\n=== ALREADY OFFERED / DUPLICATE ===\n");
{
  check(
    "alreadyOffered on feed item",
    feed.includes("alreadyOffered") && feed.includes("alreadyOfferedIds"),
  );
  check(
    "17/18/19 demote helper",
    hub.includes("demoteAlreadyOffered") &&
      hub.includes("Teklif verdiniz"),
  );
  const a = {
    context: "PERSONAL" as const,
    matchScore: 100,
    matchReasons: ["Takibinizle eşleşiyor: A"],
    opportunityClassification: "NORMAL" as const,
    isUrgent: false,
    alreadyOffered: true,
    publishedAt: new Date("2026-01-02"),
    createdAt: new Date("2026-01-02"),
    opportunityScore: 10,
    competition: "LOW" as const,
  };
  const b = { ...a, alreadyOffered: false, matchScore: 50 };
  const sorted = sortPersonalRecommended([a, b]);
  check("17 offered demoted in recommended sort", sorted[0] === b);
  const demoted = demoteAlreadyOffered([
    { alreadyOffered: true },
    { alreadyOffered: false },
  ]);
  check("19 demoteAlreadyOffered works", demoted[0]?.alreadyOffered === false);
}

console.log("\n=== ELIGIBILITY / POOL ===\n");
{
  const grounded = {
    context: "PERSONAL" as const,
    matchScore: 100,
    matchReasons: ["Takibinizle eşleşiyor: X"],
    opportunityClassification: "NORMAL" as const,
    isUrgent: false,
  };
  const other = {
    ...grounded,
    matchScore: null,
    matchReasons: [] as string[],
  };
  check("1 grounded recommended eligible", isPersonalRecommendedEligible(grounded));
  check(
    "10 pool complement",
    isOtherOpportunityEligible(other) &&
      !isOtherOpportunityEligible(grounded),
  );
  check(
    "11 no recommended in pool",
    hasGroundedPersonalMatch(grounded) &&
      !hasGroundedPersonalMatch(other),
  );
}

console.log("\n=== RADAR / ENTITLEMENT ===\n");
{
  check("8 Radar BASE 10", RADAR_MIN_ELIGIBLE_OFFERS === 10);
  check(
    "8 Radar FAST/HOT",
    RADAR_FAST_RECENT_OFFERS === 6 &&
      RADAR_HOT_RECENT_OFFERS === 10 &&
      RADAR_HOT_ELIGIBLE_OFFERS === 20 &&
      classifyRadarTier({ eligibleOfferCount: 12, recentOfferCount: 7 }) ===
        "FAST",
  );
  check(
    "page gate hot_opportunities + legacy alias",
    page.includes("hot_opportunities") &&
      page.includes("advanced_opportunity_analysis") &&
      page.includes("hasFirsatlarPageAccess"),
  );
  check(
    "radar gate talepo_radar",
    page.includes("talepo_radar") && page.includes("canRadar"),
  );
  check(
    "24 Standard locked gate",
    page.includes("FeatureUpgradeGate") &&
      page.includes("Professional ile aç") &&
      !page.includes("blur"),
  );
}

console.log("\n=== FOLLOW MATCH IDS ===\n");
{
  const projection = {
    version: 1,
    kind: "discovery_projection",
    taxonomyNodeIds: ["tax:furniture"],
    primaryLeafId: "tax:furniture",
    categoryId: "furniture",
    attributes: {},
    constraints: {},
    matchContract: { must: [], preferred: [], excluded: [], anyFields: [], ranges: [] },
    filterContract: { include: {}, exclude: {}, preferred: {}, range: {}, any: [] },
    builtAt: "2026-08-17T00:00:00.000Z",
  } as RequestDiscoveryProjection;

  const prefs: PersonalPreferenceFilter[] = [
    {
      kind: "saved_search",
      id: "ss-1",
      name: "Mobilya",
      criteria: { categorySlug: "furniture" } as never,
      fingerprint: "fp1",
    },
  ];
  // Without real evaluateDiscoveryFilter match this may be null — still assert API shape.
  const result = matchPersonalAgainstPreferences(projection, prefs, {});
  check(
    "match result exposes matchedPreference field",
    Object.prototype.hasOwnProperty.call(result, "matchedPreference"),
  );
}

console.log("\n=== SUMMARY ===\n");
console.log(`verify-firsatlar-v2: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) {
  for (const e of errors) console.error(" -", e);
  process.exit(1);
}
