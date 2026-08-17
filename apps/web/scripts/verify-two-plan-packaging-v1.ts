import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  AVAILABLE_PLAN_IDS,
  canonicalizePlanTier,
  getAvailablePlans,
  getPlanDefinition,
  PLAN_DEFINITIONS,
} from "../src/lib/membership/plans";
import {
  getPublicFacingPlanId,
  getPublicFacingPlanLabel,
  getPublicProduct,
  getPublicProductLabel,
  isSelfServeCheckoutPlan,
  PROFESSIONAL_WORKSPACE_NOTE,
  PUBLIC_FEATURE_MATRIX,
  PUBLIC_PLAN_CARD_FEATURES,
  PUBLIC_PLAN_IDS,
  toPublicPlanId,
} from "../src/lib/membership/product-packaging";
import { PLAN_FEATURES } from "../src/lib/membership/plan-visuals";
import { featuresForPlan } from "../src/lib/membership/entitlements";
import { resolveEffectivePlanTier } from "../src/lib/membership/plan-tier-utils";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

assert.deepEqual([...PUBLIC_PLAN_IDS], ["STANDARD", "PROFESSIONAL"]);
assert.deepEqual([...AVAILABLE_PLAN_IDS], ["STANDARD", "PROFESSIONAL"]);
assert.deepEqual(
  getAvailablePlans().map((plan) => plan.id),
  ["STANDARD", "PROFESSIONAL"],
);

assert.equal(toPublicPlanId("PREMIUM"), "PROFESSIONAL");
assert.equal(toPublicPlanId("CORPORATE"), "PROFESSIONAL");
assert.equal(canonicalizePlanTier("PREMIUM"), "PROFESSIONAL");
assert.equal(canonicalizePlanTier("CORPORATE"), "PROFESSIONAL");
assert.equal(
  resolveEffectivePlanTier("PREMIUM", null, new Date()).effectivePlanTier,
  "PROFESSIONAL",
);
assert.equal(
  resolveEffectivePlanTier("CORPORATE", null, new Date()).effectivePlanTier,
  "PROFESSIONAL",
);
assert.equal(getPublicFacingPlanId("PREMIUM", "PROFESSIONAL"), "PROFESSIONAL");
assert.equal(getPublicFacingPlanId("CORPORATE", "PROFESSIONAL"), "PROFESSIONAL");
assert.equal(getPublicFacingPlanId("STANDARD", "PROFESSIONAL"), "PROFESSIONAL");
assert.equal(getPublicFacingPlanLabel("PREMIUM", "PROFESSIONAL"), "Profesyonel");
assert.equal(getPublicFacingPlanLabel("CORPORATE", "PROFESSIONAL"), "Profesyonel");
assert.equal(getPublicFacingPlanLabel("STANDARD", "PROFESSIONAL"), "Profesyonel");
assert.equal(getPublicProduct("PREMIUM"), "PROFESSIONAL");
assert.equal(getPublicProduct("CORPORATE"), "PROFESSIONAL");
assert.equal(getPublicProductLabel("PREMIUM"), "Profesyonel");
assert.equal(getPublicProductLabel("CORPORATE", "WORKSPACE"), "Profesyonel");
assert.equal(getPlanDefinition("PREMIUM").id, "PROFESSIONAL");
assert.equal(getPlanDefinition("CORPORATE").id, "PROFESSIONAL");

assert.equal(isSelfServeCheckoutPlan("PROFESSIONAL"), true);
assert.equal(isSelfServeCheckoutPlan("CORPORATE"), false);
assert.equal(isSelfServeCheckoutPlan("PREMIUM"), false);

const proCard = PUBLIC_PLAN_CARD_FEATURES.PROFESSIONAL.join(" ");
assert.ok(proCard.includes("Talepo Radar"));
assert.ok(proCard.includes("Teklif Zekâsı"));
assert.ok(proCard.includes("Takiplerim"));
assert.ok(proCard.includes("Fırsatlar"));
assert.ok(!proCard.toLowerCase().includes("ai"));
assert.ok(!proCard.includes("Price Intelligence"));
assert.ok(!proCard.toLowerCase().includes("gizli envanter"));
assert.ok(!proCard.includes("koltuk"));
assert.ok(PROFESSIONAL_WORKSPACE_NOTE.includes("Firma çalışma alanı"));
assert.ok(!PROFESSIONAL_WORKSPACE_NOTE.toLowerCase().includes("dahil"));

assert.equal(PLAN_FEATURES.PREMIUM, PLAN_FEATURES.PROFESSIONAL);
assert.equal(PLAN_FEATURES.CORPORATE, PLAN_FEATURES.PROFESSIONAL);
assert.ok(PUBLIC_FEATURE_MATRIX.some((row) => row.label === "Talepo Radar"));
assert.ok(PUBLIC_FEATURE_MATRIX.some((row) => row.label === "Teklif Zekâsı"));
assert.ok(!PUBLIC_FEATURE_MATRIX.some((row) => "corporate" in row));
assert.ok(!PUBLIC_FEATURE_MATRIX.some((row) => row.label === "Offer Copilot"));
assert.ok(!PUBLIC_FEATURE_MATRIX.some((row) => row.label === "Price Intelligence"));

const livePro = featuresForPlan(
  resolveEffectivePlanTier("PREMIUM", null, new Date()).effectivePlanTier,
);
assert.equal(livePro.talepo_radar, true);
assert.equal(livePro.professional_analytics, true);
assert.equal(livePro.hidden_inventory, false);

const liveCorp = featuresForPlan(
  resolveEffectivePlanTier("CORPORATE", null, new Date()).effectivePlanTier,
);
assert.equal(liveCorp.talepo_radar, true);
assert.equal(liveCorp.professional_analytics, true);
assert.equal(liveCorp.hidden_inventory, false);
assert.equal(featuresForPlan("PROFESSIONAL").hidden_inventory, false);

const planPage = read("src/app/panel/plan/page.tsx");
assert.ok(planPage.includes("showPlanChoices"));
assert.ok(!planPage.includes("showPlanChoices={false}"));

const premiumRoute = read("src/app/panel/plan/premium/page.tsx");
assert.ok(premiumRoute.includes('redirect("/panel/plan")'));

const checkout = read("src/app/api/billing/checkout/route.ts");
assert.ok(checkout.includes('planTier !== "PROFESSIONAL"'));

const pricing = read("src/components/home/PricingPlans.tsx");
assert.ok(!pricing.includes("Premiumlu"));
assert.ok(!pricing.includes("5 ekip koltuğu"));
assert.ok(!pricing.includes("5990"));
assert.ok(!pricing.includes("Üç paket"));
assert.ok(!pricing.includes("md:grid-cols-3"));
assert.ok(pricing.includes("md:grid-cols-2"));
assert.ok(pricing.includes("Profesyonel'e geç"));
assert.ok(!pricing.includes("Kurumsal'a geç"));

const planMgr = read("src/components/panel/PlanManager.tsx");
assert.ok(!planMgr.includes("Premiumlu"));
assert.ok(!planMgr.includes("PremiumUpgradeCta"));
assert.ok(!planMgr.includes("Kurumsal'a geç"));
assert.ok(!planMgr.includes("Şirket çalışma alanı"));
assert.ok(planMgr.includes("lg:grid-cols-2"));
assert.ok(!planMgr.includes("lg:grid-cols-3"));
assert.ok(planMgr.includes('planId === "PREMIUM" || planId === "CORPORATE"'));

const planDetails = read("src/components/panel/PlanDetails.tsx");
assert.ok(!planDetails.includes("Kurumsal paket"));

assert.equal(PLAN_DEFINITIONS.STANDARD.label, "Bireysel");
assert.equal(PLAN_DEFINITIONS.PROFESSIONAL.label, "Profesyonel");
assert.equal(PLAN_DEFINITIONS.PROFESSIONAL.hiddenInventory, false);

console.log("verify-two-plan-packaging-v1: PASS");
