/**
 * Production QA static checks — honest status, no fake PASS for browser tests.
 * Run: node scripts/verify-production-qa.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "src");

function read(rel) {
  return fs.readFileSync(path.join(src, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(src, rel));
}

const results = [];

function codeCheck(name, fn) {
  try {
    fn();
    results.push({ item: name, status: "CODE_PASS" });
  } catch (error) {
    results.push({ item: name, status: "CODE_FAIL", error: String(error) });
    throw error;
  }
}

// 1. Alert → notification wiring
codeCheck("Alert notification on publish", () => {
  assert.match(read("server/request/distribute-request.ts"), /deliverAlertRuleNotifications/);
  assert.match(read("server/monetization/alert-notifications.ts"), /deliverAlertRuleNotifications/);
});

// 2. Saved search district
codeCheck("Saved search district parity", () => {
  assert.match(read("lib/monetization/saved-search-url.ts"), /district/);
  assert.match(read("lib/explore/category-filters.ts"), /district/);
});

// 3. Smart matching surfaces
codeCheck("Smart matching on explore + detail", () => {
  assert.ok(exists("components/panel/SmartMatchPanel.tsx"));
  assert.match(read("app/panel/talepler/[id]/page.tsx"), /SmartMatchPanel/);
});

// 4. Incomplete profile — no fake score
codeCheck("Incomplete profile no fake score", () => {
  assert.ok(exists("lib/monetization/company-profile-readiness.ts"));
  assert.match(read("components/panel/SmartMatchPanel.tsx"), /profileIncomplete|missingProfileFields/);
});

// 5. Watchlist on detail
codeCheck("Watchlist on request detail", () => {
  assert.ok(exists("components/panel/WatchlistToggle.tsx"));
  assert.match(read("app/panel/talepler/[id]/page.tsx"), /WatchlistToggle/);
});

// 6. Premium blocked from watchlist
codeCheck("Premium watchlist gate", () => {
  assert.match(read("components/panel/WatchlistToggle.tsx"), /FeatureUpgradeGate|professional/i);
});

// 7. RequestChange banner
codeCheck("RequestChange on watchlisted detail", () => {
  assert.ok(exists("components/panel/RequestChangeBanner.tsx"));
  assert.match(read("server/monetization/request-changes.ts"), /recordRequestChanges/);
});

// 8. STANDARD server-side gates
codeCheck("Monetization server-side gates", () => {
  for (const route of [
    "app/api/monetization/alerts/route.ts",
    "app/api/monetization/saved-searches/route.ts",
    "app/api/monetization/watchlist/route.ts",
    "app/api/monetization/opportunities/route.ts",
    "app/api/monetization/analytics/route.ts",
  ]) {
    assert.match(read(route), /requireCompanyFeature/);
  }
});

// 9. IDOR — company scoping
codeCheck("Cross-company IDOR scoping (static)", () => {
  for (const route of [
    "app/api/monetization/alerts/route.ts",
    "app/api/monetization/saved-searches/route.ts",
    "app/api/monetization/watchlist/route.ts",
  ]) {
    assert.match(read(route), /companyId: ctx\.companyId/);
  }
});

// 10. MVP contact filter
codeCheck("Contact filter blocks phone/IBAN", () => {
  assert.match(read("lib/membership/contact-filter.ts"), /containsBlockedContactInfo/);
  assert.match(read("server/offer/offer-service.ts"), /containsBlockedContactInfo/);
});

// Data Foundation hooks
codeCheck("Price observation hooks", () => {
  assert.match(read("server/request/create-request.ts"), /recordRequestPriceObservation/);
  assert.match(read("server/offer/offer-service.ts"), /recordOfferPriceObservation/);
  assert.match(read("server/offer/offer-service.ts"), /recordAcceptedOfferObservation/);
  assert.match(read("server/offer/offer-service.ts"), /createPendingDealOutcome/);
});

// Browser/manual items — honest NOT_TESTED
const manualRequired = [
  "Premium alert → in-app notification (live publish)",
  "Saved search save/reload district E2E",
  "Smart matching scores in browser",
  "Watchlist add/remove on detail",
  "RequestChange after budget update",
  "MVP flow: Request → Offer → Accept → Conversation → Message",
  "Live cross-company IDOR attempt",
];

console.log("verify-production-qa: CODE CHECKS PASS");
console.log("\nMANUAL_REQUIRED:");
for (const item of manualRequired) {
  console.log(`  - ${item} → NOT_TESTED (browser/live DB)`);
}

console.log("\nStatic results:");
for (const r of results) {
  console.log(`  [${r.status}] ${r.item}`);
}
