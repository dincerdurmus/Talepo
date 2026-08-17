import assert from "node:assert/strict";
import {
  getPublicProductLabel,
  getPublicProduct,
  PUBLIC_FEATURE_MATRIX,
  PUBLIC_PLAN_IDS,
  toPublicPlanId,
} from "../src/lib/membership/product-packaging";
import { featuresForPlan } from "../src/lib/membership/entitlements";
import { AVAILABLE_PLAN_IDS } from "../src/lib/membership/plans";

assert.deepEqual([...PUBLIC_PLAN_IDS], [...AVAILABLE_PLAN_IDS]);
assert.equal(getPublicProduct("STANDARD"), "STANDARD");
assert.equal(getPublicProduct("PREMIUM"), "PROFESSIONAL");
assert.equal(getPublicProduct("PROFESSIONAL"), "PROFESSIONAL");
assert.equal(getPublicProduct("CORPORATE"), "PROFESSIONAL");
assert.equal(getPublicProductLabel("STANDARD"), "Bireysel");
assert.equal(getPublicProductLabel("PROFESSIONAL"), "Profesyonel");
assert.equal(getPublicProductLabel("CORPORATE", "WORKSPACE"), "Profesyonel");
assert.equal(toPublicPlanId("PREMIUM"), "PROFESSIONAL");
assert.ok(PUBLIC_FEATURE_MATRIX.some((row) => row.label === "Talepo Radar"));
assert.ok(PUBLIC_FEATURE_MATRIX.some((row) => row.label === "Teklif Zekâsı"));
assert.equal(
  PUBLIC_FEATURE_MATRIX.find((row) => row.label === "Offer Copilot"),
  undefined,
);
const standard = featuresForPlan("STANDARD");
assert.equal(standard.submit_offer, true);
assert.equal(standard.ai_offer_assistant, false);
assert.equal(featuresForPlan("PROFESSIONAL").talepo_radar, true);
assert.equal(featuresForPlan("PROFESSIONAL").hidden_inventory, false);
console.log("verify-standard-pro-packaging-v1: PASS");
