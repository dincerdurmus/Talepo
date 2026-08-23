/**
 * Corporate Pricing & Seat Policy V1.
 * Run: npx tsx scripts/verify-corporate-pricing-seat-policy-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getPlanPriceMapping } from "../src/lib/billing/plan-mapping";
import { featuresForPlan } from "../src/lib/membership/entitlements";
import { PLAN_DEFINITIONS } from "../src/lib/membership/plans";
import { PLAN_PRICING } from "../src/lib/membership/pricing-config";
import {
  buildSeatUsage,
  getIncludedSeats,
  PLAN_SEAT_POLICY,
} from "../src/lib/membership/seat-policy";

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

// --- Pricing SoT ---
check("1 premium price 990", PLAN_PRICING.PREMIUM.priceTry === 990);
check("2 professional price 2490", PLAN_PRICING.PROFESSIONAL.priceTry === 2490);
check("3 corporate price 5990", PLAN_PRICING.CORPORATE.priceTry === 5990);
check(
  "4 corporate monthly not custom",
  PLAN_PRICING.CORPORATE.billingPeriod === "month",
);
check(
  "5 plans mirror pricing SoT (no drift)",
  PLAN_DEFINITIONS.PREMIUM.priceTry === PLAN_PRICING.PREMIUM.priceTry &&
    PLAN_DEFINITIONS.PROFESSIONAL.priceTry ===
      PLAN_PRICING.PROFESSIONAL.priceTry &&
    PLAN_DEFINITIONS.CORPORATE.priceTry === PLAN_PRICING.CORPORATE.priceTry,
);

/**
 * 6 — Kurumsal SATILAMAZ, ama fiyatı okunabilir kalır.
 *
 * Beklenti 2026-08-24'te tersine çevrildi (11-DECISION-LOG → Karar D: paket
 * yapısı tek katmana indirildi, Premium ve Kurumsal kaldırıldı). Eski hâli
 * `checkoutAllowed === true` bekliyordu; yani kaldırılmış bir paketin
 * satılabilir olmasını *şart koşuyordu*. `checkoutAllowed` artık
 * `AVAILABLE_PLAN_IDS`'e bağlı olduğu için kaynakta kapalı.
 *
 * Fiyatın okunabilir kalması bilinçli: mevcut/legacy abonelik kayıtları
 * gösterilebilmeli. Satış yolu ile görüntüleme ayrı şeylerdir.
 */
const corpMap = getPlanPriceMapping("CORPORATE");
check(
  "6 corporate not sellable but price readable",
  corpMap.checkoutAllowed === false && corpMap.displayPriceTry === 5990,
);
check(
  "6b removed tiers are never checkout-allowed",
  getPlanPriceMapping("PREMIUM").checkoutAllowed === false &&
    getPlanPriceMapping("CORPORATE").checkoutAllowed === false &&
    getPlanPriceMapping("PROFESSIONAL").checkoutAllowed === true,
);

// --- Seat policy (not entitlements) ---
check("7 corporate base includedSeats = 1", getIncludedSeats("CORPORATE") === 1);
check(
  "8 standard/premium seat caps null; professional/corporate base is 1",
  getIncludedSeats("STANDARD") === null &&
    getIncludedSeats("PREMIUM") === null &&
    getIncludedSeats("PROFESSIONAL") === 1 &&
    getIncludedSeats("CORPORATE") === 1,
);
check(
  "9 seat policy separate from featuresForPlan",
  !read("src/lib/membership/seat-policy.ts").includes(
    'from "./entitlements"',
  ) &&
    !read("src/lib/membership/seat-policy.ts").includes("prisma") &&
    PLAN_SEAT_POLICY.CORPORATE.includedSeats === 1,
);
check(
  "9b owner counts / pending does not (usage builder)",
  buildSeatUsage({
    planTier: "PROFESSIONAL",
    workspaceEffectivePlanTier: "PROFESSIONAL",
    activeSeats: 1,
  }).atLimit === true &&
    buildSeatUsage({
      planTier: "PROFESSIONAL",
      workspaceEffectivePlanTier: "PROFESSIONAL",
      activeSeats: 1,
      extraSeatsPurchased: 1,
    }).includedSeats === 2 &&
    buildSeatUsage({
      planTier: "PROFESSIONAL",
      workspaceEffectivePlanTier: "PROFESSIONAL",
      activeSeats: 1,
    }).activeSeats === 1,
);
check(
  "9c server assert uses ACTIVE count only",
  read("src/server/company/assert-company-seat.ts").includes(
    'status: "ACTIVE"',
  ) &&
    read("src/server/company/assert-company-seat.ts").includes(
      "SEAT_LIMIT_REACHED",
    ),
);

const corp = featuresForPlan("CORPORATE");
const pro = featuresForPlan("PROFESSIONAL");
check(
  "10 corporate inherits professional features",
  corp.hot_opportunities === true &&
    corp.professional_analytics === true &&
    pro.hidden_inventory === false &&
    corp.hidden_inventory === true,
);

// --- Server gate ---
const invite = read("src/server/company/respond-invite.ts");
check(
  "11 accept invite gates seats",
  invite.includes("assertCanActivateCompanySeat") &&
    invite.includes("FOR UPDATE"),
);
check(
  "12 seat error taxonomy",
  read("src/server/company/assert-company-seat.ts").includes(
    "SEAT_LIMIT_REACHED",
  ) &&
    read("src/server/company/assert-company-seat.ts").includes(
      "Firma çalışma alanında",
    ),
);
check(
  "13 invite API maps EntitlementError",
  read("src/app/api/company/invites/route.ts").includes(
    "entitlementErrorResponse",
  ),
);
check(
  "14 unique membership prevents double-count",
  read("prisma/schema.prisma").includes("@@unique([companyId, userId])"),
);
check(
  "15 invites create INVITED not ACTIVE",
  read("src/app/api/company/team/route.ts").includes('status: "INVITED"') &&
    !read("src/app/api/company/team/route.ts").includes(
      'status: "ACTIVE",\n            role',
    ),
);

// --- UI ---
const planMgr = read("src/components/panel/PlanManager.tsx");
check(
  "16 plan UI is Standard+Professional only, no Corporate checkout",
  planMgr.includes('planId === "PREMIUM" || planId === "CORPORATE"') &&
    planMgr.includes("lg:grid-cols-2") &&
    !planMgr.includes("Şirket çalışma alanı") &&
    !planMgr.includes("Kurumsal'a geç") &&
    !planMgr.includes("5 ekip koltuğu dahil"),
);
check(
  "17 team seat usage UI",
  read("src/components/panel/TeamManager.tsx").includes("koltuk kullanılıyor") &&
    read("src/app/panel/ekip/page.tsx").includes("getCompanySeatUsage"),
);

// --- Billing subject / no client price / no add-on ---
const checkout = read("src/server/billing/create-checkout.ts");
check(
  "18 client not price authority",
  checkout.includes("ignore any client price") &&
    checkout.includes("assertCheckoutPlan"),
);
check(
  "19 no additional-seat billing / seat not in iyzico",
  !read("src/lib/membership/seat-policy.ts").includes("iyzico") &&
    !read("src/server/company/assert-company-seat.ts").includes("iyzico") &&
    !read("src/lib/billing/plan-mapping.ts").includes("includedSeats") &&
    !read("src/server/billing/create-checkout.ts").includes("seat"),
);
check(
  "20 no Enterprise plan",
  !Object.keys(PLAN_PRICING).includes("ENTERPRISE") &&
    !read("src/lib/membership/plans.ts").includes("ENTERPRISE"),
);

const mapping = read("src/lib/billing/plan-mapping.ts");
check(
  "21 missing iyzico corporate ref fails safely",
  mapping.includes("missing_provider_price_") &&
    mapping.includes('TALEPO_IYZICO_PLAN_${planTier}_MONTHLY'),
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
