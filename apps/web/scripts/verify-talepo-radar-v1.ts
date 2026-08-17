/**
 * Talepo Radar V1 — marketplace activity signal.
 * Run: npx tsx scripts/verify-talepo-radar-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { featuresForPlan } from "../src/lib/membership/entitlements";
import { FEATURE_META } from "../src/lib/membership/feature-meta";
import { PRO_FEATURE_PRESENTATION } from "../src/lib/membership/feature-presentation";
import { OFFER_INTELLIGENCE_STATUSES } from "../src/lib/monetization/offer-intelligence";
import {
  RADAR_BRAND_LINE,
  RADAR_ELIGIBLE_OFFER_STATUSES,
  RADAR_FAST_RECENT_OFFERS,
  RADAR_HOT_ELIGIBLE_OFFERS,
  RADAR_HOT_RECENT_OFFERS,
  RADAR_MIN_ELIGIBLE_OFFERS,
  TALEPO_RADAR_FEATURE,
  classifyRadarTier,
  compareRadarItems,
  formatRadarReason,
} from "../src/lib/monetization/talepo-radar";

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

console.log("\n=== THRESHOLDS / CLASSIFICATION ===\n");
{
  check("base threshold is 10", RADAR_MIN_ELIGIBLE_OFFERS === 10);
  check(
    "1 nine offers is not Radar",
    classifyRadarTier({ eligibleOfferCount: 9, recentOfferCount: 9 }) === "NONE",
  );
  check(
    "2 ten offers is Radar",
    classifyRadarTier({ eligibleOfferCount: 10, recentOfferCount: 0 }) === "RADAR",
  );
  check(
    "FAST needs recent velocity",
    classifyRadarTier({
      eligibleOfferCount: 10,
      recentOfferCount: RADAR_FAST_RECENT_OFFERS,
    }) === "FAST",
  );
  check(
    "HOT by volume",
    classifyRadarTier({
      eligibleOfferCount: RADAR_HOT_ELIGIBLE_OFFERS,
      recentOfferCount: 0,
    }) === "HOT",
  );
  check(
    "HOT by velocity",
    classifyRadarTier({
      eligibleOfferCount: 10,
      recentOfferCount: RADAR_HOT_RECENT_OFFERS,
    }) === "HOT",
  );
  check(
    "no time claim without velocity",
    formatRadarReason({ eligibleOfferCount: 12, recentOfferCount: null }) ===
      "12 teklif · Olağan dışı ilgi" &&
      !formatRadarReason({
        eligibleOfferCount: 12,
        recentOfferCount: null,
      }).includes("saatte"),
  );
  const ranked = [
    {
      tier: "RADAR" as const,
      alreadyOffered: false,
      recentOfferCount: 0,
      eligibleOfferCount: 12,
      publishedAtMs: 2,
    },
    {
      tier: "RADAR" as const,
      alreadyOffered: true,
      recentOfferCount: 0,
      eligibleOfferCount: 18,
      publishedAtMs: 9,
    },
    {
      tier: "HOT" as const,
      alreadyOffered: false,
      recentOfferCount: 4,
      eligibleOfferCount: 21,
      publishedAtMs: 1,
    },
  ].sort(compareRadarItems);
  check("ranking HOT before RADAR", ranked[0]?.tier === "HOT");
  check(
    "already offered demoted within same tier",
    ranked[1]?.alreadyOffered === false && ranked[2]?.alreadyOffered === true,
  );
}

console.log("\n=== ELIGIBLE COUNT AUTHORITY ===\n");
{
  check(
    "eligible statuses match Offer Intelligence",
    RADAR_ELIGIBLE_OFFER_STATUSES.join() === OFFER_INTELLIGENCE_STATUSES.join(),
  );
  check("DRAFT excluded", !(RADAR_ELIGIBLE_OFFER_STATUSES as readonly string[]).includes("DRAFT"));
  check(
    "WITHDRAWN excluded",
    !(RADAR_ELIGIBLE_OFFER_STATUSES as readonly string[]).includes("WITHDRAWN"),
  );
  check(
    "EXPIRED excluded",
    !(RADAR_ELIGIBLE_OFFER_STATUSES as readonly string[]).includes("EXPIRED"),
  );
}

const policy = read("src/lib/monetization/talepo-radar.ts");
const server = read("src/server/monetization/talepo-radar.ts");
const feed = read("src/server/monetization/opportunities-feed.ts");
const page = read("src/app/panel/firsatlar/page.tsx");
const workspace = read(
  "src/components/panel/discovery/ProfessionalDiscoveryWorkspace.tsx",
);
const hub = read("src/components/panel/OpportunitiesHub.tsx");
const offerService = read("src/server/offer/offer-service.ts");
const intelligence = read("src/server/monetization/offer-intelligence.ts");

console.log("\n=== QUERY / EXCLUSIONS ===\n");
{
  check("4 own request excluded", server.includes("createdById: { not: input.userId }"));
  check(
    "6/7 open + not deleted",
    server.includes("PUBLISHED") &&
      server.includes("RECEIVING_OFFERS") &&
      server.includes("deletedAt: null"),
  );
  check("8 visibility filter applied", server.includes("buildSupplierVisibilityFilter"));
  check(
    "5 already offered demoted not excluded from query",
    server.includes("alreadyOffered") &&
      !server.includes("if (offered) continue"),
  );
  check(
    "offerCount is prefilter only",
    server.includes("offerCount: { gte: RADAR_MIN_ELIGIBLE_OFFERS }") &&
      server.includes("eligibleOfferCount"),
  );
  check("recount uses eligible statuses", server.includes("RADAR_ELIGIBLE_OFFER_STATUSES"));
  check("velocity is bounded groupBy", server.includes("submittedAt: { gte: windowStart }"));
  check(
    "9 not gated by personal match",
    !server.includes("matchPersonalAgainstPreferences") &&
      !server.includes("loadPersonalPreferenceFilters"),
  );
  check("no new matching engine", !server.includes("matchPersonalToRequest"));
  check(
    "displayed count is eligible recount",
    server.includes("offerCount: eligibleOfferCount"),
  );
}

console.log("\n=== UI / COPY ===\n");
{
  check("brand line", RADAR_BRAND_LINE === "Gözden Kaçar, Talepo’dan Kaçmaz");
  check("tab exists", workspace.includes('label: "Talepo Radar"'));
  check("tab order after Önerilen", workspace.indexOf('id: "radar"') > workspace.indexOf('id: "suggested"') && workspace.indexOf('id: "radar"') < workspace.indexOf('id: "browse"'));
  check("hero copy", workspace.includes("RADAR_BRAND_LINE"));
  check("canonical request detail reused", hub.includes("opportunityRequestDetailHref"));
  check("OpportunityCard reused", hub.includes("item.radar"));
  check(
    "11 no predictive wording",
    !policy.includes("Kesin ticarete") &&
      !workspace.includes("Satış ihtimali") &&
      !hub.includes("%85") &&
      !hub.includes("Bunu kaçırma") &&
      !policy.includes("kazanma ihtimali"),
  );
  check("no competitor prices on radar cards", !hub.includes("OfferIntelligence"));
  check(
    "14 recommended/other/urgent still present",
    workspace.includes('label: "Önerilen"') &&
      workspace.includes("Diğer Fırsatlar") &&
      workspace.includes('label: "Acil"'),
  );
}

console.log("\n=== ENTITLEMENT / NOTIFICATION ===\n");
{
  const std = featuresForPlan("STANDARD");
  const prem = featuresForPlan("PREMIUM");
  const pro = featuresForPlan("PROFESSIONAL");
  const corp = featuresForPlan("CORPORATE");
  check("3 Standard no radar key", std.talepo_radar === false);
  check("3 Premium no radar key", prem.talepo_radar === false);
  check("Professional has radar", pro.talepo_radar === true);
  check("Corporate inherits radar", corp.talepo_radar === true);
  check("FEATURE_META has Radar", FEATURE_META.talepo_radar.label === "Talepo Radar");
  check(
    "presentation separate from Teklif Zekâsı",
    PRO_FEATURE_PRESENTATION.talepo_radar?.label === "Talepo Radar" &&
      PRO_FEATURE_PRESENTATION.professional_analytics?.label === "Teklif Zekâsı",
  );
  check("feature key constant", TALEPO_RADAR_FEATURE === "talepo_radar");
  check(
    "12/13 no createOffer radar notify",
    !offerService.includes("talepo_radar") &&
      !offerService.includes("Gözden Kaçar"),
  );
  check(
    "notification backlog: no radar notify module",
    !server.includes("createNotification"),
  );
  check("page loads dedicated radar query", page.includes("loadTalepoRadarFeed"));
  check("radar view does not reuse match feed", page.includes('view !== "radar"'));
}

console.log("\n=== NO NEW ENGINES ===\n");
{
  check("intelligence files not rewritten for radar", !intelligence.includes("talepo_radar"));
  check("feed still personal-match for Önerilen", feed.includes("matchPersonalAgainstPreferences"));
  check("no OfferRevision", !server.includes("OfferRevision"));
  check("no auction", !policy.includes("auction"));
}

if (fail > 0) {
  console.log(`\nFAILED ${fail} / ${pass + fail}`);
  for (const error of errors) console.log(` - ${error}`);
  process.exit(1);
}

console.log(`\nverify-talepo-radar-v1: ${pass} PASS`);
