/**
 * Offer Intelligence Exposure V1 — decision assistance, not acquisition.
 * Run: npx tsx scripts/verify-offer-intelligence-exposure-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

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
  "prisma/migrations/20260817210000_offer_intelligence_exposure_v1/migration.sql",
);
const record = read("src/server/monetization/offer-intelligence-exposure.ts");
const getOi = read("src/server/monetization/offer-intelligence.ts");
const getRoute = read("src/app/api/monetization/offer-intelligence/route.ts");
const postRoute = read(
  "src/app/api/monetization/offer-intelligence/exposure/route.ts",
);
const card = read("src/components/panel/OfferIntelligenceCard.tsx");
const attribution = read("src/lib/offer/offer-attribution.ts");
const resolveAttr = read("src/server/offer/resolve-offer-attribution.ts");
const commercial = read("src/server/monetization/commercial-performance.ts");
const dash = read("src/components/panel/AnalyticsDashboard.tsx");
const lock = read("src/lib/offer/submitted-commercial-lock.ts");

console.log("\n=== MODEL / IMMUTABILITY ===\n");
{
  check("OfferIntelligenceExposure model", schema.includes("model OfferIntelligenceExposure"));
  check("offerId primary key 1:1", migration.includes('PRIMARY KEY ("offerId")'));
  check("additive migration", migration.includes("CREATE TABLE \"OfferIntelligenceExposure\""));
  check(
    "5/6/7 first viewedAt create-only",
    record.includes("offerIntelligenceExposure.create") &&
      !record.includes("offerIntelligenceExposure.update") &&
      !record.includes("viewedAt:"),
  );
  check(
    "unique race → alreadyPresent",
    record.includes("isPrismaUniqueViolation") &&
      record.includes("alreadyPresent: true"),
  );
}

console.log("\n=== TRIGGER / AUTH ===\n");
{
  check(
    "3 GET does not write exposure",
    !getRoute.includes("recordOfferIntelligenceExposure") &&
      !getOi.includes("offerIntelligenceExposure"),
  );
  check(
    "4 READY mount POSTs exposure",
    card.includes('"use client"') &&
      card.includes("/api/monetization/offer-intelligence/exposure") &&
      card.includes('intelligence.state !== "READY"'),
  );
  check(
    "23 locked preview not exposure",
    card.includes("LOCKED_PLAN") &&
      card.includes('state !== "READY"'),
  );
  check(
    "1/2 server re-checks READY via getRequestOfferIntelligence",
    record.includes("getRequestOfferIntelligence") &&
      record.includes('state !== "READY"'),
  );
  check(
    "8 client offerId spoof ignored",
    postRoute.includes("requestId") &&
      postRoute.includes("Reject client-supplied offerId") &&
      !postRoute.includes("body.offerId"),
  );
  check(
    "9 buyer NOT_APPLICABLE path reused",
    getOi.includes("NOT_APPLICABLE") &&
      getOi.includes("createdById === input.userId"),
  );
  check(
    "personal/company viewer offer where",
    record.includes("companyId: null") && record.includes("submittedById"),
  );
}

console.log("\n=== ATTRIBUTION SEPARATION ===\n");
{
  check(
    "11 OfferAttribution unchanged by exposure",
    !record.includes("offerAttribution") &&
      !record.includes("issueOfferAttributionTouch") &&
      !attribution.includes("OFFER_INTELLIGENCE"),
  );
  check(
    "12 Radar + OI can coexist (separate models)",
    schema.includes("model OfferAttribution") &&
      schema.includes("model OfferIntelligenceExposure") &&
      !resolveAttr.includes("OFFER_INTELLIGENCE"),
  );
}

console.log("\n=== LIFECYCLE / NEGOTIATION ===\n");
{
  check(
    "13/14 amount & delivery immutable policy present",
    lock.includes("OFFER_AMOUNT_IMMUTABLE_MESSAGE"),
  );
  check(
    "15 exposure does not create negotiation",
    !record.includes("OfferNegotiation") &&
      !record.includes("negotiate"),
  );
  check(
    "exposure does not write Offer.amount",
    !record.includes("amount:") && !postRoute.includes("amount"),
  );
}

console.log("\n=== ANALIZ ===\n");
{
  check(
    "observational OI section",
    dash.includes("Teklif Zekâsı etkisi") &&
      dash.includes("intelligenceAssistance") &&
      !dash.includes("sayesinde") &&
      !dash.includes("optimize etti"),
  );
  check(
    "13/14 no fake viewed vs non-viewed comparison",
    commercial.includes("comparisonAvailable: false") &&
      dash.includes("karşılaştırma bu sürümde yok"),
  );
  check(
    "19 agreedPrice volume",
    commercial.includes("OfferIntelligenceExposure") &&
      commercial.includes('d."agreedPrice"'),
  );
  check(
    "18 bilateral completed",
    commercial.includes("BOTH_CONFIRMED"),
  );
  check(
    "22 no legacy backfill",
    !record.includes("backfill") && !commercial.includes("inferExposure"),
  );
}

if (fail > 0) {
  console.log(`\nFAILED ${fail}/${pass + fail}`);
  for (const e of errors) console.log(` - ${e}`);
  process.exit(1);
}

console.log(`\nverify-offer-intelligence-exposure-v1: ${pass} PASS`);
