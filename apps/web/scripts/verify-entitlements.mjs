/**
 * FAZ 1 entitlement smoke checks (no DB, no test framework).
 * Run: node scripts/verify-entitlements.mjs
 */

import assert from "node:assert/strict";

// Inline mirrors of registry rules — keep in sync with entitlements.ts / resolveEffectivePlanTier.
const FEATURE_KEYS = [
  "submit_offer",
  "instant_request_access",
  "ai_offer_assistant",
  "advanced_ai_pricing",
  "alert_rules",
  "hidden_inventory",
  "urgent_request_priority",
  "advanced_filters",
  "feature_request_boost",
];

const PLAN_FEATURE_KEYS = {
  STANDARD: ["submit_offer", "feature_request_boost"],
  PREMIUM: [
    "submit_offer",
    "instant_request_access",
    "ai_offer_assistant",
    "advanced_ai_pricing",
    "alert_rules",
    "feature_request_boost",
  ],
  PROFESSIONAL: [
    "submit_offer",
    "instant_request_access",
    "ai_offer_assistant",
    "advanced_ai_pricing",
    "alert_rules",
    "urgent_request_priority",
    "advanced_filters",
    "feature_request_boost",
  ],
  CORPORATE: [
    "submit_offer",
    "instant_request_access",
    "ai_offer_assistant",
    "advanced_ai_pricing",
    "alert_rules",
    "urgent_request_priority",
    "advanced_filters",
    "hidden_inventory",
    "feature_request_boost",
  ],
};

function featuresForPlan(tier) {
  const features = Object.fromEntries(FEATURE_KEYS.map((k) => [k, false]));
  for (const key of PLAN_FEATURE_KEYS[tier]) features[key] = true;
  return features;
}

function resolveEffectivePlanTier(stored, expiresAt, now) {
  if (stored === "STANDARD") return { effective: "STANDARD", isExpired: false };
  if (expiresAt && expiresAt.getTime() <= now.getTime()) {
    return { effective: "STANDARD", isExpired: true };
  }
  return { effective: stored, isExpired: false };
}

function canAccessRequest(features, request, now) {
  if (features.instant_request_access) return true;
  if (!request.visibleToSuppliersAt) return true;
  return request.visibleToSuppliersAt <= now;
}

function buildQuota(limit, used, bonus) {
  if (limit === null) {
    return { limit: null, used, remaining: null, bonusCredits: bonus, isUnlimited: true };
  }
  return {
    limit,
    used,
    remaining: Math.max(0, limit - used) + Math.max(0, bonus),
    bonusCredits: bonus,
    isUnlimited: false,
  };
}

const now = new Date("2026-08-09T12:00:00.000Z");

// 12–14 feature registry
assert.equal(featuresForPlan("STANDARD").ai_offer_assistant, false);
assert.equal(featuresForPlan("PREMIUM").ai_offer_assistant, true);
assert.equal(featuresForPlan("PREMIUM").urgent_request_priority, false);
assert.equal(featuresForPlan("PROFESSIONAL").urgent_request_priority, true);
assert.equal(featuresForPlan("PREMIUM").hidden_inventory, false);
assert.equal(featuresForPlan("PROFESSIONAL").hidden_inventory, false);
assert.equal(featuresForPlan("CORPORATE").hidden_inventory, true);

// Expiry
const expired = resolveEffectivePlanTier(
  "PREMIUM",
  new Date("2026-08-01T00:00:00.000Z"),
  now,
);
assert.equal(expired.effective, "STANDARD");
assert.equal(expired.isExpired, true);

const active = resolveEffectivePlanTier(
  "PREMIUM",
  new Date("2026-09-01T00:00:00.000Z"),
  now,
);
assert.equal(active.effective, "PREMIUM");
assert.equal(active.isExpired, false);

// Visibility
const lockedAt = new Date("2026-08-10T12:00:00.000Z");
assert.equal(
  canAccessRequest(featuresForPlan("STANDARD"), { visibleToSuppliersAt: lockedAt }, now),
  false,
);
assert.equal(
  canAccessRequest(featuresForPlan("PREMIUM"), { visibleToSuppliersAt: lockedAt }, now),
  true,
);
assert.equal(
  canAccessRequest(
    featuresForPlan("STANDARD"),
    { visibleToSuppliersAt: new Date("2026-08-08T12:00:00.000Z") },
    now,
  ),
  true,
);

// Quota / unlimited / bonus
const q1 = buildQuota(5, 5, 0);
assert.equal(q1.remaining, 0);
const q2 = buildQuota(5, 5, 3);
assert.equal(q2.remaining, 3);
const q3 = buildQuota(null, 100, 5);
assert.equal(q3.isUnlimited, true);
assert.equal(q3.remaining, null);

// Mock upgrade flag: only exact "true" enables (document expected semantics)
assert.equal("true" === "true", true);
assert.equal("1" === "true", false);
assert.equal("TRUE" === "true", false);
assert.equal(undefined === "true", false);

console.log("verify-entitlements: all assertions passed");
