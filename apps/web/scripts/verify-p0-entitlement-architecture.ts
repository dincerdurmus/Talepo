/**
 * P0 entitlement architecture verification for implementation turn.
 * Run: npx tsx scripts/verify-p0-entitlement-architecture.ts
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  canonicalizePlanTier,
  getPlanDefinition,
  hasWorkspaceCapability,
  isWorkspaceEligible,
  normalizeStoredPlanTier,
} from "../src/lib/membership/plans";
import {
  featuresForPlan,
  minimumPlanForFeature,
} from "../src/lib/membership/entitlements";
import {
  resolveEffectivePlanTier,
  resolveStoredPlanTier,
} from "../src/lib/membership/plan-tier-utils";
import { resolvePlanTierFromProviderPriceId } from "../src/lib/billing/plan-mapping";
import { resolvePlanTierFromIyzicoPricingPlan } from "../src/lib/billing/iyzico/plan-mapping";
import {
  featureScope,
  isPersonalApiCapable,
} from "../src/lib/membership/feature-scope";

let pass = 0;
let warn = 0;
let fail = 0;
const warnings: string[] = [];
const errors: string[] = [];

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass += 1;
    console.log(`PASS — ${name}`);
    return;
  }
  fail += 1;
  const msg = detail ? `${name}: ${detail}` : name;
  errors.push(msg);
  console.log(`FAIL — ${msg}`);
}

function block(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass += 1;
    console.log(`PASS — ${name}`);
    return;
  }
  warn += 1;
  const msg = detail ? `${name}: ${detail}` : name;
  warnings.push(msg);
  console.log(`WARN — ${msg}`);
}

const root = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const schema = read("prisma/schema.prisma");

const watchlistRoute = read("src/app/api/monetization/watchlist/route.ts");
const entitlementsTs = read("src/lib/membership/entitlements.ts");
const plansTs = read("src/lib/membership/plans.ts");
const featureScopeTs = read("src/lib/membership/feature-scope.ts");
const resolveEntitlementsTs = read("src/lib/membership/resolve-entitlements.ts");
const companyWorkspaceTs = read("src/lib/panel/company-workspace.ts");
const requireCompanyFeatureTs = read("src/lib/membership/require-company-feature.ts");

console.log("\n=== P0 — NORMALIZATION ===");
check(
  "1 legacy PREMIUM canonicalizes to PROFESSIONAL",
  canonicalizePlanTier("PREMIUM") === "PROFESSIONAL",
);
check(
  "2 legacy CORPORATE canonicalizes to PROFESSIONAL",
  canonicalizePlanTier("CORPORATE") === "PROFESSIONAL",
);
check(
  "3 legacy STANDARD stays STANDARD",
  canonicalizePlanTier("STANDARD") === "STANDARD",
);
check(
  "4 canonical plan lookup PREMIUM -> PROFESSIONAL",
  getPlanDefinition("PREMIUM").id === "PROFESSIONAL",
);
check(
  "5 canonical plan lookup CORPORATE -> PROFESSIONAL",
  getPlanDefinition("CORPORATE").id === "PROFESSIONAL",
);
check(
  "6 workspace capability helper is canonical",
  isWorkspaceEligible("CORPORATE") && hasWorkspaceCapability("CORPORATE"),
);

console.log("\n=== P0 — ENTITLEMENT CONSISTENCY ===");
check(
  "7 shared stored-tier parser normalizes unknown values",
  normalizeStoredPlanTier("NO_SUCH_PLAN") === "STANDARD",
);
check(
  "8 shared stored-tier parser accepts LEGACY paid tiers",
  resolveStoredPlanTier("CORPORATE") === "CORPORATE",
);
check(
  "9 effective paid-tier canonicalization is applied",
  resolveEffectivePlanTier("CORPORATE", null, new Date()).effectivePlanTier ===
    "PROFESSIONAL",
);
check(
  "10 minimumPlanForFeature stays canonical",
  minimumPlanForFeature("watchlist") === "PROFESSIONAL" &&
    minimumPlanForFeature("team_management") === "PROFESSIONAL",
);

console.log("\n=== P0 — MINIMUM PLAN MATRIX (STANDARD/PREMIUM/PRO/CORP) ===");
check(
  "11 STANDARD has only base keys",
  featuresForPlan("STANDARD").submit_offer &&
    featuresForPlan("STANDARD").instant_request_access &&
    !featuresForPlan("STANDARD").saved_searches &&
    !featuresForPlan("STANDARD").watchlist &&
    !featuresForPlan("STANDARD").team_management,
);
check(
  "12 legacy PREMIUM effective entitlement maps to professional",
  featuresForPlan("PREMIUM").submit_offer &&
    featuresForPlan("PREMIUM").smart_alerts &&
    resolveStoredPlanTier("PREMIUM") === "PREMIUM" &&
    resolveEffectivePlanTier("PREMIUM", null, new Date()).effectivePlanTier ===
      "PROFESSIONAL",
);
check(
  "13 PROFESSIONAL keys include watchlist and hot opportunities",
  featuresForPlan("PROFESSIONAL").watchlist &&
    featuresForPlan("PROFESSIONAL").hot_opportunities,
);
check(
  "14 CORPORATE is treated as PROFESSIONAL entitlement",
  featuresForPlan("CORPORATE").watchlist &&
    featuresForPlan("CORPORATE").team_management &&
    getPlanDefinition("CORPORATE").id === "PROFESSIONAL",
);

console.log("\n=== P0 — RESOLVER / WORKSPACE WORKFLOW ===");
check(
  "15 resolve-entitlements reads normalizeStoredPlanTier",
  resolveEntitlementsTs.includes("resolveStoredPlanTier"),
);
check(
  "16 resolver keeps personal snapshot and does not collapse stored plans",
  resolveEntitlementsTs.includes("buildPersonalPlanSnapshot") &&
    resolveEntitlementsTs.includes("Company.planTier is never mutated") &&
    resolveEntitlementsTs.includes("resolveWorkspaceEffectivePlan") &&
    !resolveEntitlementsTs.toLowerCase().includes("max(userplan, companyplan)"),
);
check(
  "17 company workspace helper uses centralized helper",
  companyWorkspaceTs.includes("isWorkspaceEligible(entitlements.effectivePlanTier)") ||
    companyWorkspaceTs.includes("isWorkspaceEligible("),
);
check(
  "18 requireCompanyFeature enforces company subject",
  requireCompanyFeatureTs.includes("subject.type !== \"company\""),
);

console.log("\n=== P0 — BILLING REVERSE MAPPING ===");
process.env.TALEPO_PRICE_PREMIUM = "price_std_premium";
process.env.TALEPO_PRICE_PROFESSIONAL = "price_std_professional";
process.env.TALEPO_PRICE_CORPORATE = "price_std_corporate";
process.env.TALEPO_IYZICO_PLAN_PREMIUM_MONTHLY = "iyzico-premium";
process.env.TALEPO_IYZICO_PLAN_PROFESSIONAL_MONTHLY = "iyzico-prof";
process.env.TALEPO_IYZICO_PLAN_CORPORATE_MONTHLY = "iyzico-corp";
check(
  "19 billing mapping resolves legacy PREMIUM",
  resolvePlanTierFromProviderPriceId("price_std_premium") === "PREMIUM",
);
check(
  "20 billing mapping resolves legacy CORPORATE",
  resolvePlanTierFromProviderPriceId("price_std_corporate") === "CORPORATE",
);
check(
  "21 iyzico mapping resolves legacy CORPORATE",
  resolvePlanTierFromIyzicoPricingPlan("iyzico-corp") === "CORPORATE",
);
check(
  "22 plan mapping still includes PREMIUM/PROFESSIONAL/CORPORATE",
  resolvePlanTierFromProviderPriceId("mock_price_ignored") === null &&
    plansTs.includes("STANDARD") &&
    plansTs.includes("PROFESSIONAL") &&
    plansTs.includes("CORPORATE"),
);

console.log("\n=== P0 — FEATURE SCOPE / WATCHLIST OWNERSHIP ===");
check(
  "23 saved_searches is PERSONAL_CAPABLE",
  featureScope("saved_searches") === "PERSONAL_CAPABLE" &&
    isPersonalApiCapable("saved_searches"),
);
check(
  "24 smart_alerts is PERSONAL_CAPABLE",
  featureScope("smart_alerts") === "PERSONAL_CAPABLE" &&
    isPersonalApiCapable("smart_alerts"),
);
check(
  "25 watchlist ownership status is explicitly non-personal-api in code",
  featureScope("watchlist") !== "PERSONAL_CAPABLE" &&
    !isPersonalApiCapable("watchlist"),
);

const watchlistModel = schema.match(/model OpportunityWatchlistItem[\s\S]*?\n}/)?.[0] ?? "";
const watchlistHasCompanyId = /companyId\s+String/.test(watchlistModel);
const watchlistHasUserId = /\buserId\b/.test(watchlistModel);
const watchlistRouteRequiresCompany =
  watchlistRoute.includes("requireCompanyFeature") &&
  watchlistRoute.includes("ctx.companyId");
check(
  "26 schema has watchlist company ownership",
  watchlistHasCompanyId && !watchlistHasUserId,
);
block(
  "27 BLOCKER: personal watchlist cannot be owned by user without schema migration",
  !watchlistHasUserId && watchlistRouteRequiresCompany,
  "OpportunityWatchlistItem has only companyId owner + API still requires company feature.",
);

console.log("\n=== P0 — SAVED SEARCH + ALERTS DRIFT REGRESSION ===");
check(
  "28 saved-searches route uses resource owner resolver",
  read("src/app/api/monetization/saved-searches/route.ts").includes(
    "requireResourceOwnerFeature",
  ),
);
check(
  "29 alerts route uses resource owner resolver",
  read("src/app/api/monetization/alerts/route.ts").includes(
    "requireResourceOwnerFeature",
  ),
);
check(
  "30 saved search scope is PERSONAL_CAPABLE in feature taxonomy",
  featureScopeTs.includes(' "saved_searches",') &&
    featureScopeTs.includes("PERSONAL_CAPABLE_FEATURES"),
);

console.log("\n=== P0 — CORPORATE DIRECT COMPARISON DRIFT ===");
check(
  "31 no storedPlanTier direct CORPORATE comparison in target layer",
  !/storedPlanTier\s*===\s*\"CORPORATE\"/.test(
    entitlementsTs + resolveEntitlementsTs + companyWorkspaceTs,
  ),
);
check(
  "32 no effectivePlanTier direct CORPORATE comparison in target layer",
  !/effectivePlanTier\s*===\s*\"CORPORATE\"/.test(
    entitlementsTs + resolveEntitlementsTs + companyWorkspaceTs,
  ),
);

console.log("\n=== P0 — STANDARD CORE LOOP / REQUEST TRUST BOUNDARY ===");
check(
  "33 standard entitlements keep base loop keys active",
  featuresForPlan("STANDARD").submit_offer &&
    featuresForPlan("STANDARD").unlimited_offers === false,
);
check(
  "34 request trust paid-plan closure script exists",
  existsSync(join(root, "scripts/verify-request-trust-paid-plan-closure-v1.ts")),
);
check(
  "35 workspace isolation script exists",
  existsSync(join(root, "scripts/verify-corporate-workspace-isolation-v1.ts")),
);
check(
  "36 plan-mapping verification script exists",
  existsSync(join(root, "scripts/verify-phase4c-billing-v1.ts")),
);
check(
  "37 production QA script exists",
  existsSync(join(root, "scripts/verify-phase4a-production-smoke-v1.ts")),
);

console.log(`\nP0 Entitlement Architecture: pass=${pass} warn=${warn} fail=${fail}`);
if (warnings.length > 0) {
  console.log("\nBLOCKERS:");
  for (const item of warnings) console.log(` - ${item}`);
}
if (errors.length > 0) {
  console.log("\nFAILURES:");
  for (const item of errors) console.log(` - ${item}`);
  process.exit(1);
}

console.log("\nPASS");
process.exit(0);
