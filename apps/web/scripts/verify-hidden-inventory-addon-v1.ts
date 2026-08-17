/**
 * Hidden Inventory is a company-only paid add-on — not a Professional grant
 * and not a Corporate package feature.
 *
 * Run: npx tsx scripts/verify-hidden-inventory-addon-v1.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { featuresForPlan } from "../src/lib/membership/entitlements";
import { hasHiddenInventoryAccess } from "../src/lib/membership/hidden-inventory-access";
import {
  canonicalizePlanTier,
  PLAN_DEFINITIONS,
} from "../src/lib/membership/plans";
import { PUBLIC_PLAN_CARD_FEATURES } from "../src/lib/membership/product-packaging";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

const standard = featuresForPlan("STANDARD");
const professional = featuresForPlan("PROFESSIONAL");
const liveCorporate = featuresForPlan(canonicalizePlanTier("CORPORATE"));

assert.equal(standard.hidden_inventory, false);
assert.equal(professional.hidden_inventory, false);
assert.equal(liveCorporate.hidden_inventory, false);
assert.equal(PLAN_DEFINITIONS.PROFESSIONAL.hiddenInventory, false);

assert.equal(
  hasHiddenInventoryAccess({
    effectivePlanTier: "STANDARD",
    subjectType: "user",
    features: standard,
  }),
  false,
);

assert.equal(
  hasHiddenInventoryAccess({
    effectivePlanTier: "PROFESSIONAL",
    subjectType: "user",
    features: professional,
  }),
  false,
);

assert.equal(
  hasHiddenInventoryAccess({
    effectivePlanTier: "PROFESSIONAL",
    subjectType: "company",
    features: professional,
  }),
  false,
);

assert.equal(
  hasHiddenInventoryAccess({
    effectivePlanTier: "PROFESSIONAL",
    subjectType: "company",
    features: { ...professional, hidden_inventory: true },
  }),
  true,
);

const proCard = PUBLIC_PLAN_CARD_FEATURES.PROFESSIONAL.join(" ").toLowerCase();
assert.ok(!proCard.includes("gizli envanter"));
assert.ok(!proCard.includes("dahil"));

const envanter = read("src/app/panel/envanter/page.tsx");
assert.ok(envanter.includes("hasHiddenInventoryAccess"));
assert.ok(!envanter.includes("Kurumsal plana geç"));
assert.ok(!envanter.includes("Kurumsal planda"));
assert.ok(envanter.includes("Ücretli firma eklentisi"));
assert.ok(envanter.includes("/panel/firma/yeni"));

const inventoryList = read("src/app/api/company/inventory/route.ts");
assert.ok(inventoryList.includes("hasHiddenInventoryAccess"));
assert.ok(!inventoryList.includes("workspace.features.hidden_inventory"));

const inventoryItem = read("src/app/api/company/inventory/[id]/route.ts");
assert.ok(inventoryItem.includes("hasHiddenInventoryAccess"));

const requireCompany = read("src/lib/membership/require-company-feature.ts");
assert.ok(requireCompany.includes('feature === "hidden_inventory"'));
assert.ok(requireCompany.includes("hasHiddenInventoryAccess"));

const schema = read("prisma/schema.prisma");
assert.ok(schema.includes("model CompanyAddonEntitlement"));
assert.ok(schema.includes("hiddenInventoryEnabled"));

const entitlements = read("src/lib/membership/entitlements.ts");
const professionalKeysBlock = entitlements.slice(
  entitlements.indexOf("const PROFESSIONAL_KEYS"),
  entitlements.indexOf("const CORPORATE_KEYS"),
);
assert.ok(!professionalKeysBlock.includes('"hidden_inventory"'));
assert.ok(entitlements.includes("const CORPORATE_KEYS"));

const home = read("src/components/panel/CorporateHome.tsx");
assert.ok(!home.includes("Kurumsal planda açılır"));
assert.ok(home.includes("Ücretli eklenti"));

console.log("verify-hidden-inventory-addon-v1: PASS");

