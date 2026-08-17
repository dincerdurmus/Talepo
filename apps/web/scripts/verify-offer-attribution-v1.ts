/**
 * Offer Attribution V1 — signed touch + immutable OfferAttribution.
 * Run: npx tsx scripts/verify-offer-attribution-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  ANALIZ_SOURCE_PERFORMANCE_SOURCES,
  OFFER_ACQUISITION_SOURCES,
  OFFER_ATTRIBUTION_TOUCH_TTL_MS,
  appendAttributionTouch,
  isOfferAcquisitionSource,
} from "../src/lib/offer/offer-attribution";
import {
  issueOfferAttributionTouch,
  verifyOfferAttributionTouch,
} from "../src/server/offer/offer-attribution-touch";

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

const schema = read("prisma/schema.prisma");
const migration = read(
  "prisma/migrations/20260817200000_offer_attribution_v1/migration.sql",
);
const resolve = read("src/server/offer/resolve-offer-attribution.ts");
const touch = read("src/server/offer/offer-attribution-touch.ts");
const create = read("src/server/offer/offer-service.ts");
const route = read("src/app/api/offers/route.ts");
const form = read("src/components/panel/OfferForm.tsx");
const commercial = read("src/server/monetization/commercial-performance.ts");
const dash = read("src/components/panel/AnalyticsDashboard.tsx");
const radar = read("src/server/monetization/talepo-radar.ts");
const oc = read("src/server/monetization/corporate-opportunity-center.ts");
const alerts = read("src/server/monetization/alert-notifications.ts");
const oi = read("src/server/monetization/offer-intelligence.ts");

console.log("\n=== TAXONOMY / TOUCH ===\n");
{
  check(
    "taxonomy includes product sources",
    OFFER_ACQUISITION_SOURCES.includes("RADAR") &&
      OFFER_ACQUISITION_SOURCES.includes("FOLLOW") &&
      OFFER_ACQUISITION_SOURCES.includes("OPPORTUNITY") &&
      OFFER_ACQUISITION_SOURCES.includes("DISCOVERY") &&
      OFFER_ACQUISITION_SOURCES.includes("UNKNOWN"),
  );
  check("TTL is 24h", OFFER_ATTRIBUTION_TOUCH_TTL_MS === 24 * 60 * 60 * 1000);

  const token = issueOfferAttributionTouch({
    userId: "u1",
    requestId: "r1",
    source: "RADAR",
    radarTier: "HOT",
    nowMs: 1_000_000,
  });
  const ok = verifyOfferAttributionTouch(token, {
    userId: "u1",
    requestId: "r1",
    nowMs: 1_000_000 + 60_000,
  });
  check("1 Radar touch verifies", Boolean(ok && ok.src === "RADAR" && ok.tier === "HOT"));

  const spoof = verifyOfferAttributionTouch(token, {
    userId: "attacker",
    requestId: "r1",
    nowMs: 1_000_000 + 60_000,
  });
  check("6 fake user cannot redeem Radar touch", spoof === null);

  const wrongReq = verifyOfferAttributionTouch(token, {
    userId: "u1",
    requestId: "other",
    nowMs: 1_000_000 + 60_000,
  });
  check("9 wrong request cannot redeem", wrongReq === null);

  const expired = verifyOfferAttributionTouch(token, {
    userId: "u1",
    requestId: "r1",
    nowMs: 1_000_000 + OFFER_ATTRIBUTION_TOUCH_TTL_MS + 1,
  });
  check("expired touch rejected", expired === null);

  const bare = "not-a-token";
  check(
    "6 bare client source string is not a valid touch",
    verifyOfferAttributionTouch(bare, { userId: "u1", requestId: "r1" }) ===
      null,
  );

  const href = appendAttributionTouch("/panel/talepler/r1", token);
  check("touch appends acq param", href.includes("acq="));
}

console.log("\n=== MODEL / CREATE PATH ===\n");
{
  check("OfferAttribution model", schema.includes("model OfferAttribution"));
  check("OfferAcquisitionSource enum", schema.includes("enum OfferAcquisitionSource"));
  check("additive migration", migration.includes("CREATE TABLE \"OfferAttribution\""));
  check(
    "createOffer resolves + persists attribution",
    create.includes("resolveOfferAttribution") &&
      create.includes("persistOfferAttribution"),
  );
  check(
    "API accepts attributionTouch only (not bare source authority)",
    route.includes("attributionTouch") &&
      !route.includes('source: String(body.source'),
  );
  check("OfferForm posts attributionTouch", form.includes("attributionTouch"));
  check(
    "21 immutable — no updateOfferAttribution / offerAttribution.update",
    !create.includes("offerAttribution.update") &&
      !resolve.includes("offerAttribution.update"),
  );
  check(
    "10 legacy no backfill script",
    !resolve.includes("backfill") && !create.includes("inferSource"),
  );
}

console.log("\n=== SERVER VALIDATION ===\n");
{
  check(
    "7 FOLLOW ownership check",
    resolve.includes("assertFollowOwnership") &&
      resolve.includes("alertRule") &&
      resolve.includes("savedSearch"),
  );
  check(
    "8 OPPORTUNITY ownership + request relationship",
    resolve.includes("assertOpportunityOwnership") &&
      resolve.includes("opportunityMatch") &&
      resolve.includes("requestId: input.requestId"),
  );
  check(
    "22 RequestMatch ≠ OpportunityMatch",
    !resolve.includes("RequestMatch") &&
      !commercial.includes("RequestMatch"),
  );
  check(
    "failed claim → UNKNOWN",
    resolve.includes('source: "UNKNOWN"') &&
      resolve.includes("unknownSnapshot"),
  );
}

console.log("\n=== SURFACE STAMPS ===\n");
{
  check("1 Radar stamps RADAR", radar.includes('source: "RADAR"'));
  check(
    "3 Opportunity stamps OPPORTUNITY + match id",
    oc.includes('source: "OPPORTUNITY"') &&
      oc.includes("opportunityMatchId: m.id"),
  );
  check(
    "2 Follow alert stamps FOLLOW",
    alerts.includes('source: "FOLLOW"') &&
      alerts.includes("alertRuleId: match.alertRuleId"),
  );
  check(
    "4 Discovery stamps present",
    read("src/server/monetization/discovery-workspace-query.ts").includes(
      'source: "DISCOVERY"',
    ) &&
      read("src/app/panel/talepler/page.tsx").includes('source: "DISCOVERY"'),
  );
}

console.log("\n=== OFFER INTELLIGENCE / FUNNEL ===\n");
{
  check(
    "23 Offer Intelligence is not acquisition source",
    !isOfferAcquisitionSource("OFFER_INTELLIGENCE" as never) &&
      !ANALIZ_SOURCE_PERFORMANCE_SOURCES.includes(
        "OFFER_INTELLIGENCE" as never,
      ) &&
      !oi.includes("OfferAttribution") &&
      !oi.includes("issueOfferAttributionTouch"),
  );
  check(
    "14 volume uses agreedPrice in source query",
    commercial.includes('d."agreedPrice"') &&
      commercial.includes("OfferAttribution"),
  );
  check(
    "15 bilateral completed filter in source funnel",
    commercial.includes('confirmationLevel" = \'BOTH_CONFIRMED\''),
  );
  check(
    "source UI present",
    dash.includes("Talepo sana nereden iş getiriyor") &&
      dash.includes("sourcePerformance"),
  );
  check(
    "18 no FX conversion",
    !commercial.includes("exchange") && dash.includes("Birden fazla para birimi"),
  );
}

if (fail > 0) {
  console.log(`\nFAILED ${fail}/${pass + fail}`);
  for (const e of errors) console.log(` - ${e}`);
  process.exit(1);
}

console.log(`\nverify-offer-attribution-v1: ${pass} PASS`);
