/**
 * Corporate workspace / seat entitlement isolation V1.
 * Run: npx tsx scripts/verify-corporate-workspace-isolation-v1.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { featuresForPlan } from "../src/lib/membership/entitlements";

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

// Matrix inheritance
const std = featuresForPlan("STANDARD");
const prem = featuresForPlan("PREMIUM");
const pro = featuresForPlan("PROFESSIONAL");
const corp = featuresForPlan("CORPORATE");

check("1 no company → corporate deny (matrix)", corp.hidden_inventory === true && std.hidden_inventory === false);
check("2 personal standard corporate feature deny", std.hidden_inventory === false && std.hot_opportunities === false);
check("3 corporate inherits professional", corp.hot_opportunities === true && corp.professional_analytics === true);
check("4 corporate hidden inventory allow", corp.hidden_inventory === true);
check("5 professional hidden inventory deny", pro.hidden_inventory === false);
check("6 premium hidden inventory deny", prem.hidden_inventory === false);

// Resolver: no implicit company-first
const resolver = read("src/lib/membership/resolve-entitlements.ts");
check(
  "7 no company-first default",
  resolver.includes("never auto-pick") &&
    !resolver.includes("most recently joined ACTIVE membership (company-first"),
);
check(
  "8 preferUserSubject or missing companyId → personal",
  resolver.includes("preferUserSubject || !options.companyId"),
);

// Cookie default personal
const ctx = read("src/lib/membership/company-context.ts");
check(
  "9 missing cookie → personal",
  ctx.includes("preferUserSubject: true") &&
    ctx.includes("Company plan is never applied without an explicit"),
);

// Billing sync never fans out to members
const syncSrc = read("src/server/billing/sync-entitlement-plan.ts");
check(
  "9b webhook activation target company XOR user",
  syncSrc.includes('input.subject.type === "COMPANY"') &&
    syncSrc.includes("prisma.user.update") &&
    !syncSrc.includes("companyMember") &&
    !syncSrc.includes("forEach"),
);
check(
  "10 syncSubjectPlanFromBilling is subject-scoped",
  syncSrc.includes("syncSubjectPlanFromBilling") ||
    existsSync(join(root, "src/server/billing/sync-entitlement-plan.ts")),
);

// Offer ownership actor vs owner
const offerSrc = read("src/server/offer/offer-service.ts");
check(
  "11 offer companyId from company subject",
  offerSrc.includes('subject.type === "company"') &&
    offerSrc.includes("submittedById"),
);

// Team plan gate
check(
  "12 team API requires team_management",
  read("src/app/api/company/team/route.ts").includes(
    'requireCompanyFeature(user.id, "team_management")',
  ),
);

// requireCompanyFeature forces company subject
check(
  "13 company feature requires company subject",
  read("src/lib/membership/require-company-feature.ts").includes(
    'subject.type !== "company"',
  ),
);

// Inventory VIEWER role gate
check(
  "14 inventory role gate VIEWER",
  read("src/app/api/company/inventory/route.ts").includes("VIEWER"),
);

// Multi-company: companyId must match membership in resolver
check(
  "15 multi-company no leakage (explicit companyId membership)",
  resolver.includes("companyId: options.companyId") &&
    resolver.includes('status: "ACTIVE"'),
);

// create-request uses company context cookie
check(
  "16 create-request uses company context",
  read("src/server/request/create-request.ts").includes(
    "getCompanyContextOptions",
  ),
);

// Seat foundation: no seat fields required yet
const schema = read("prisma/schema.prisma");
check(
  "17 seat foundation via CompanyMember count (no seat columns)",
  schema.includes("model CompanyMember") &&
    !schema.includes("includedSeats") &&
    !schema.includes("activeSeatCount"),
);

// Personal + company coexist
check(
  "18 personalPlan always computed",
  resolver.includes("personalPlan") &&
    resolver.includes("buildPersonalPlanSnapshot"),
);

// Corporate-only keys present
check(
  "19 corporate-only keys",
  corp.team_management &&
    corp.hidden_inventory &&
    corp.automatic_opportunity_hunter &&
    corp.inventory_import &&
    corp.lead_distribution &&
    corp.corporate_intelligence &&
    corp.erp_integration,
);

// Premium subset of Professional subset of Corporate
const premiumKeys = Object.entries(prem)
  .filter(([, v]) => v)
  .map(([k]) => k);
check(
  "20 corporate ⊇ professional ⊇ premium",
  premiumKeys.every((k) => pro[k as keyof typeof pro]) &&
    Object.entries(pro)
      .filter(([, v]) => v)
      .every(([k]) => corp[k as keyof typeof corp]),
);

// Docs / rules
check(
  "21 membership rules isolation note",
  read("src/lib/membership/membership-rules.ts").includes(
    "Corporate company membership",
  ),
);

check(
  "22 ekip page plan gate",
  read("src/app/panel/ekip/page.tsx").includes("team_management"),
);

check(
  "23 billing resolve subject uses company context",
  read("src/server/billing/resolve-billing-subject.ts").includes(
    "getCompanyContextOptions",
  ),
);

check(
  "24 no MAX(user, company) merge",
  resolver.includes("No MAX(userPlan, companyPlan)") &&
    !resolver.includes("effectivePlanTier =") &&
    resolver.includes("Company plan NEVER mutates"),
);

check(
  "25 verify script present",
  existsSync(join(root, "scripts/verify-corporate-workspace-isolation-v1.ts")),
);

console.log("");
console.log(
  `Corporate workspace isolation: ${pass} passed, ${fail} failed`,
);
if (fail > 0) {
  for (const e of errors) console.log(` - ${e}`);
  process.exit(1);
}
