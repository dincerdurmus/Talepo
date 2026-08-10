/**
 * V2 entitlement matrix verification.
 * Run: node scripts/verify-entitlements.mjs
 */
import assert from "node:assert/strict";

const FEATURE_KEYS = [
  "submit_offer",
  "smart_alerts",
  "hidden_inventory",
  "professional_analytics",
  "hot_opportunities",
  "team_management",
];

const PLAN_FEATURE_KEYS = {
  STANDARD: ["submit_offer", "feature_request_boost"],
  PREMIUM: [
    "submit_offer",
    "unlimited_offers",
    "instant_request_access",
    "smart_alerts",
    "ai_offer_assistant",
    "advanced_filters",
  ],
  PROFESSIONAL: [
    "submit_offer",
    "smart_alerts",
    "hot_opportunities",
    "competition_signals",
    "professional_analytics",
  ],
  CORPORATE: [
    "submit_offer",
    "smart_alerts",
    "hot_opportunities",
    "professional_analytics",
    "hidden_inventory",
    "team_management",
    "automatic_opportunity_hunter",
  ],
};

function featuresForPlan(tier) {
  const all = Object.fromEntries(FEATURE_KEYS.map((k) => [k, false]));
  for (const key of PLAN_FEATURE_KEYS[tier] ?? []) {
    if (key in all) all[key] = true;
  }
  return all;
}

assert.equal(FEATURE_KEYS.includes("submit_offer"), true);

const std = featuresForPlan("STANDARD");
assert.equal(std.smart_alerts, false);
assert.equal(std.hidden_inventory, false);

const prem = featuresForPlan("PREMIUM");
assert.equal(prem.smart_alerts, true);
assert.equal(prem.professional_analytics, false);

const pro = featuresForPlan("PROFESSIONAL");
assert.equal(pro.hot_opportunities, true);
assert.equal(pro.hidden_inventory, false);

const corp = featuresForPlan("CORPORATE");
assert.equal(corp.hidden_inventory, true);
assert.equal(corp.team_management, true);

console.log("verify-entitlements: OK");
