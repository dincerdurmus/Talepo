import assert from "node:assert/strict";
import { getPublicProductLabel, getPublicProduct, PUBLIC_FEATURE_MATRIX } from "../src/lib/membership/product-packaging";
import { featuresForPlan } from "../src/lib/membership/entitlements";

assert.equal(getPublicProduct("STANDARD"), "STANDARD");
for (const tier of ["PREMIUM", "PROFESSIONAL", "CORPORATE"] as const) assert.equal(getPublicProduct(tier), "PRO");
assert.equal(getPublicProductLabel("CORPORATE", "WORKSPACE"), "PRO Workspace");
assert.equal(getPublicProductLabel("CORPORATE", "PERSONAL"), "PRO");
assert.equal(PUBLIC_FEATURE_MATRIX.length, 6);
const standard = featuresForPlan("STANDARD");
assert.equal(standard.submit_offer, true);
assert.equal(standard.ai_offer_assistant, false);
assert.equal(standard.advanced_ai_pricing, false);
for (const tier of ["PREMIUM", "PROFESSIONAL", "CORPORATE"] as const) {
  const features = featuresForPlan(tier);
  assert.equal(features.ai_offer_assistant, true);
  assert.equal(features.advanced_ai_pricing, true);
}
assert.equal(PUBLIC_FEATURE_MATRIX.find((row) => row.label === "Offer Copilot")?.standard, "—");
assert.equal(PUBLIC_FEATURE_MATRIX.find((row) => row.label === "Follow-up Intelligence")?.pro, "Dahil");
console.log("verify-standard-pro-packaging-v1: PASS");
