/**
 * Professional Company Monetization V1.
 * Run: npx tsx scripts/verify-pro-company-monetization-v1.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  EXTRA_SEAT_ADDON,
  HIDDEN_INVENTORY_ADDON,
  applyCompanyWorkspaceFeatureOverlay,
  isHiddenInventoryAddonActive,
} from "../src/lib/membership/company-addon-policy";
import { featuresForPlan } from "../src/lib/membership/entitlements";
import { hasHiddenInventoryAccess } from "../src/lib/membership/hidden-inventory-access";
import {
  PUBLIC_PLAN_IDS,
  getPublicFacingPlanId,
} from "../src/lib/membership/product-packaging";
import {
  WORKSPACE_BASE_INCLUDED_SEATS,
  buildSeatUsage,
  getIncludedSeats,
} from "../src/lib/membership/seat-policy";
import {
  canCreateCompanyWorkspace,
  resolveWorkspaceEffectivePlan,
} from "../src/lib/membership/workspace-effective-plan";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

assert.deepEqual([...PUBLIC_PLAN_IDS], ["STANDARD", "PROFESSIONAL"]);
assert.equal(canCreateCompanyWorkspace("STANDARD"), false);
assert.equal(canCreateCompanyWorkspace("PROFESSIONAL"), true);
assert.equal(canCreateCompanyWorkspace("PREMIUM"), true);
assert.equal(canCreateCompanyWorkspace("CORPORATE"), true);

const inherited = resolveWorkspaceEffectivePlan({
  companyStoredPlanTier: "STANDARD",
  companyExpiresAt: null,
  ownerStoredPlanTier: "PROFESSIONAL",
  ownerExpiresAt: null,
});
assert.equal(inherited.effectivePlanTier, "PROFESSIONAL");
assert.equal(inherited.inheritedFromOwner, true);
assert.equal(
  getPublicFacingPlanId("STANDARD", "PROFESSIONAL"),
  "PROFESSIONAL",
);

const legacyCorp = resolveWorkspaceEffectivePlan({
  companyStoredPlanTier: "CORPORATE",
  companyExpiresAt: null,
  ownerStoredPlanTier: "STANDARD",
  ownerExpiresAt: null,
});
assert.equal(legacyCorp.effectivePlanTier, "PROFESSIONAL");
assert.equal(legacyCorp.inheritedFromOwner, false);

assert.equal(WORKSPACE_BASE_INCLUDED_SEATS, 1);
assert.equal(getIncludedSeats("PROFESSIONAL"), 1);
assert.equal(
  buildSeatUsage({
    planTier: "STANDARD",
    workspaceEffectivePlanTier: "PROFESSIONAL",
    activeSeats: 1,
  }).atLimit,
  true,
);
assert.equal(
  buildSeatUsage({
    planTier: "STANDARD",
    workspaceEffectivePlanTier: "PROFESSIONAL",
    activeSeats: 1,
    extraSeatsPurchased: 2,
  }).includedSeats,
  3,
);

assert.equal(HIDDEN_INVENTORY_ADDON.checkoutEnabled, false);
assert.equal(HIDDEN_INVENTORY_ADDON.priceTry, null);
assert.equal(EXTRA_SEAT_ADDON.checkoutEnabled, false);
assert.equal(EXTRA_SEAT_ADDON.priceTry, null);

const proFeatures = featuresForPlan("PROFESSIONAL");
assert.equal(proFeatures.hidden_inventory, false);

const overlaidLocked = applyCompanyWorkspaceFeatureOverlay({
  features: proFeatures,
  workspaceEffectiveIsProfessional: true,
  hiddenInventoryAddonActive: false,
});
assert.equal(overlaidLocked.team_management, true);
assert.equal(overlaidLocked.hidden_inventory, false);
assert.equal(
  hasHiddenInventoryAccess({
    effectivePlanTier: "PROFESSIONAL",
    subjectType: "company",
    features: overlaidLocked,
  }),
  false,
);

const overlaidOpen = applyCompanyWorkspaceFeatureOverlay({
  features: proFeatures,
  workspaceEffectiveIsProfessional: true,
  hiddenInventoryAddonActive: true,
});
assert.equal(overlaidOpen.hidden_inventory, true);
assert.equal(
  hasHiddenInventoryAccess({
    effectivePlanTier: "PROFESSIONAL",
    subjectType: "company",
    features: overlaidOpen,
  }),
  true,
);
assert.equal(
  hasHiddenInventoryAccess({
    effectivePlanTier: "PROFESSIONAL",
    subjectType: "user",
    features: overlaidOpen,
  }),
  false,
);
assert.equal(
  isHiddenInventoryAddonActive({ enabled: true, expiresAt: new Date(0) }),
  false,
);

const createCompany = read("src/server/company/create-company.ts");
assert.ok(createCompany.includes("canCreateCompanyWorkspace"));
assert.ok(createCompany.includes('planTier: "STANDARD"'));

const firmaYeni = read("src/app/panel/firma/yeni/page.tsx");
assert.ok(firmaYeni.includes("FeatureUpgradeGate"));
assert.ok(firmaYeni.includes("canCreateCompanyWorkspace"));

const resolver = read("src/lib/membership/resolve-entitlements.ts");
assert.ok(resolver.includes("resolveWorkspaceEffectivePlan"));
assert.ok(resolver.includes("applyCompanyWorkspaceFeatureOverlay"));
assert.ok(resolver.includes("Company.planTier is never mutated"));

const assertSeat = read("src/server/company/assert-company-seat.ts");
assert.ok(assertSeat.includes("getCompanyAddonSnapshot"));
assert.ok(assertSeat.includes("Ek koltuk gerekli"));

const teamRoute = read("src/app/api/company/team/route.ts");
assert.ok(teamRoute.includes("assertCanActivateCompanySeat"));

const planMgr = read("src/components/panel/PlanManager.tsx");
assert.ok(!planMgr.includes("Kurumsal'a geç"));
assert.ok(planMgr.includes("lg:grid-cols-2"));

const schema = read("prisma/schema.prisma");
assert.ok(schema.includes("model CompanyAddonEntitlement"));
assert.ok(schema.includes("hiddenInventoryEnabled"));
assert.ok(schema.includes("extraSeatsPurchased"));

const entitlements = read("src/lib/membership/entitlements.ts");
const professionalKeysBlock = entitlements.slice(
  entitlements.indexOf("const PROFESSIONAL_KEYS"),
  entitlements.indexOf("const CORPORATE_KEYS"),
);
assert.ok(!professionalKeysBlock.includes('"hidden_inventory"'));

console.log("verify-pro-company-monetization-v1: PASS");
