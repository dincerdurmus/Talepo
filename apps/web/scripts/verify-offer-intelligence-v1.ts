/**
 * Teklif Zekâsı V1 — anonymous offer intelligence.
 * Run: npx tsx scripts/verify-offer-intelligence-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { featuresForPlan } from "../src/lib/membership/entitlements";
import {
  canRevealOfferStats,
  computeOfferPriceStats,
  emptyOfferIntelligence,
  OFFER_INTELLIGENCE_FEATURE,
  OFFER_INTELLIGENCE_MIN_OTHERS,
  OFFER_INTELLIGENCE_STATUSES,
  viewerVsMedianPct,
} from "../src/lib/monetization/offer-intelligence";
import { FEATURE_META } from "../src/lib/membership/feature-meta";
import { PRO_FEATURE_PRESENTATION } from "../src/lib/membership/feature-presentation";

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

console.log("\n=== STATISTICS ===\n");
{
  const odd = computeOfferPriceStats([10, 30, 20]);
  check("6 min", odd?.min === 10);
  check("6 max", odd?.max === 30);
  check("6 odd median", odd?.median === 20);
  check("6 average", odd?.average === 20);

  const even = computeOfferPriceStats([68500, 71000, 72500, 75300]);
  check("7 even median", even?.median === 71750);
  check("7 even min/max", even?.min === 68500 && even?.max === 75300);

  check("9 viewer vs median +0.7", viewerVsMedianPct(73000, 72500) === 0.7);
  check("9 viewer below", viewerVsMedianPct(70000, 72500) === -3.4);
  check("9 equal", viewerVsMedianPct(72, 72) === 0);
  check("median 0 pct null", viewerVsMedianPct(10, 0) === null);
}

console.log("\n=== PRIVACY / GATES ===\n");
{
  check("5 min others is 3", OFFER_INTELLIGENCE_MIN_OTHERS === 3);
  check("3 own+1 other closed", canRevealOfferStats(1) === false);
  check("4 own+2 others closed", canRevealOfferStats(2) === false);
  check("5 own+3 others open", canRevealOfferStats(3) === true);
  check("DRAFT not eligible", !(OFFER_INTELLIGENCE_STATUSES as readonly string[]).includes("DRAFT"));
  check("WITHDRAWN not eligible", !(OFFER_INTELLIGENCE_STATUSES as readonly string[]).includes("WITHDRAWN"));
  check("EXPIRED not eligible", !(OFFER_INTELLIGENCE_STATUSES as readonly string[]).includes("EXPIRED"));
  check(
    "submitted statuses included",
    OFFER_INTELLIGENCE_STATUSES.includes("SUBMITTED") &&
      OFFER_INTELLIGENCE_STATUSES.includes("VIEWED") &&
      OFFER_INTELLIGENCE_STATUSES.includes("ACCEPTED") &&
      OFFER_INTELLIGENCE_STATUSES.includes("REJECTED"),
  );

  const locked = emptyOfferIntelligence("LOCKED_OWN_OFFER");
  check("2 no prices without own offer", locked.min === null && locked.median === null);
  const plan = emptyOfferIntelligence("LOCKED_PLAN");
  check("1 standard no aggregates", plan.state === "LOCKED_PLAN" && plan.max === null);
}

console.log("\n=== ENTITLEMENT / SURFACES ===\n");
{
  const server = read("src/server/monetization/offer-intelligence.ts");
  const api = read("src/app/api/monetization/offer-intelligence/route.ts");
  const card = read("src/components/panel/OfferIntelligenceCard.tsx");
  const detail = read("src/app/panel/talepler/[id]/page.tsx");
  const formPage = read("src/app/panel/talepler/[id]/teklif/page.tsx");
  const offerForm = read("src/components/panel/OfferForm.tsx");

  check(
    "feature is professional_analytics Pro/Corp",
    OFFER_INTELLIGENCE_FEATURE === "professional_analytics" &&
      featuresForPlan("STANDARD")[OFFER_INTELLIGENCE_FEATURE] === false &&
      featuresForPlan("PREMIUM")[OFFER_INTELLIGENCE_FEATURE] === false &&
      featuresForPlan("PROFESSIONAL")[OFFER_INTELLIGENCE_FEATURE] === true &&
      featuresForPlan("CORPORATE")[OFFER_INTELLIGENCE_FEATURE] === true,
  );
  check("API requires auth", api.includes("requireUser()"));
  check("API does not take viewerOfferId", !api.includes("viewerOfferId") && !api.includes("companyId"));
  check(
    "server excludes identity fields from other offers",
    (() => {
      const others = server.slice(server.indexOf("const others ="));
      return (
        others.includes("select: { amount: true }") &&
        !others.includes("submittedBy") &&
        !others.includes("description")
      );
    })(),
  );
  check("buyer NOT_APPLICABLE", server.includes('emptyOfferIntelligence("NOT_APPLICABLE")'));
  check("own-offer gate", server.includes('LOCKED_OWN_OFFER'));
  check("company viewer uses companyId", server.includes("? { companyId }"));
  check("currency not mixed", server.includes("currency,") && server.includes("currency,"));
  check("detail has card", detail.includes("OfferIntelligenceCard") && detail.includes("getRequestOfferIntelligence"));
  check("owner skips intelligence", detail.includes("isRequestOwner") && detail.includes("offerIntelligence"));
  check("16 offer form has no intelligence", !formPage.includes("OfferIntelligence") && !offerForm.includes("OfferIntelligence"));
  check("no exact price list in card", !card.includes("otherPrices") && !card.includes("fiyat listesi"));
  check("no win prediction copy", !card.includes("Kazanma") && !card.includes("iyi teklif"));
  check("not Price Intelligence", card.includes("Piyasa fiyatı değildir") && !card.includes("Price Intelligence"));
  check(
    "copy is Teklif Zekâsı",
    FEATURE_META.professional_analytics.label === "Teklif Zekâsı" &&
      PRO_FEATURE_PRESENTATION.professional_analytics?.label === "Teklif Zekâsı",
  );
  check("DTO has no offer ids in type file", !read("src/lib/monetization/offer-intelligence.ts").includes("offerId"));
}

if (fail > 0) {
  console.log(`\nFAILED ${fail}/${pass + fail}`);
  for (const e of errors) console.log(` - ${e}`);
  process.exit(1);
}

console.log(`\nverify-offer-intelligence-v1: ${pass} PASS`);
