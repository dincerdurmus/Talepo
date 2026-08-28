/**
 * Verify acceptance persona seed + ownership/plan isolation on staging.
 * Run: npm run acceptance:verify-personas
 */
import {
  ACCEPTANCE_COMPANY,
  ACCEPTANCE_MARKER,
  PERSONAS,
  type PersonaKey,
} from "./lib/acceptance-personas-v1.constants";
import { formatAcceptanceError, redactAcceptanceOutput } from "./lib/acceptance-redaction-v1";
import { loadAcceptanceEnv } from "./lib/load-acceptance-env";

/**
 * Product modules are bound inside main(), AFTER the acceptance env is applied
 * and the target verified. A static import here would pull in `src/lib/prisma`,
 * which reads DATABASE_URL at module scope — so a refused target would blow up
 * before any catch boundary exists and Node would print a raw stack.
 */
let prisma!: typeof import("../src/lib/prisma").prisma;
let assertEntitlement!: typeof import("../src/lib/membership/assert-entitlement").assertEntitlement;
let hasFeature!: typeof import("../src/lib/membership/entitlements").hasFeature;
let canonicalizePlanTier!: typeof import("../src/lib/membership/plans").canonicalizePlanTier;
let isLegacyCorporateAccount!: typeof import("../src/lib/membership/plans").isLegacyCorporateAccount;
let resolveEntitlements!: typeof import("../src/lib/membership/resolve-entitlements").resolveEntitlements;
let EntitlementError!: typeof import("../src/lib/membership/types").EntitlementError;
let assertCompanyMembership!: typeof import("../src/lib/panel/company-workspace").assertCompanyMembership;
let countActiveCompanySeats!: typeof import("../src/server/company/assert-company-seat").countActiveCompanySeats;
let getCompanySeatUsage!: typeof import("../src/server/company/assert-company-seat").getCompanySeatUsage;

/** Bind every runtime product export. Called only after the env is verified. */
async function bindProductModules(): Promise<void> {
  ({ prisma } = await import("../src/lib/prisma"));
  ({ assertEntitlement } = await import("../src/lib/membership/assert-entitlement"));
  ({ hasFeature } = await import("../src/lib/membership/entitlements"));
  ({ canonicalizePlanTier, isLegacyCorporateAccount } = await import(
    "../src/lib/membership/plans"
  ));
  ({ resolveEntitlements } = await import("../src/lib/membership/resolve-entitlements"));
  ({ EntitlementError } = await import("../src/lib/membership/types"));
  ({ assertCompanyMembership } = await import("../src/lib/panel/company-workspace"));
  ({ countActiveCompanySeats, getCompanySeatUsage } = await import(
    "../src/server/company/assert-company-seat"
  ));
}

const problems: string[] = [];

function check(name: string, ok: boolean, detail: string): void {
  if (ok) {
    console.log(`  ok   ${name}`);
    return;
  }
  console.log(`  FAIL ${name} — ${detail}`);
  problems.push(name);
}

function fail(msg: string): never {
  // Every operator-facing line goes through the single redaction authority.
  console.error(`FAIL — ${redactAcceptanceOutput(msg)}`);
  process.exit(1);
}

function entitlementDenied(fn: () => void): boolean {
  try {
    fn();
    return false;
  } catch (e) {
    return e instanceof EntitlementError;
  }
}

async function loadPersona(key: PersonaKey) {
  const spec = PERSONAS[key];
  const user = await prisma.user.findUnique({
    where: { email: spec.email },
    select: {
      id: true,
      email: true,
      planTier: true,
      membershipNumber: true,
      biography: true,
      companyMemberships: {
        where: { company: { slug: ACCEPTANCE_COMPANY.slug } },
        select: {
          role: true,
          status: true,
          company: { select: { id: true, planTier: true, name: true } },
        },
      },
    },
  });
  if (!user) fail(`Missing persona ${key} (${spec.email})`);
  if (!user.biography?.includes(ACCEPTANCE_MARKER)) {
    fail(`Persona ${key} missing acceptance marker`);
  }
  return user;
}

async function main() {
  loadAcceptanceEnv();
  await bindProductModules();
  if (process.env.TALEPO_ENVIRONMENT !== "acceptance") {
    fail('TALEPO_ENVIRONMENT must be "acceptance"');
  }

  console.log("=== verify-acceptance-personas-v1 ===\n");

  const company = await prisma.company.findUnique({
    where: { slug: ACCEPTANCE_COMPANY.slug },
    select: { id: true, name: true, planTier: true },
  });
  if (!company) fail("Acceptance company missing");

  const users = {
    A: await loadPersona("A"),
    B: await loadPersona("B"),
    C: await loadPersona("C"),
    D: await loadPersona("D"),
    E: await loadPersona("E"),
    F: await loadPersona("F"),
  };

  console.log("--- PLAN / WORKSPACE STATE ---");
  console.log(`USER A: personal ${users.A.planTier}`);
  console.log(`USER B: personal ${users.B.planTier}`);
  console.log(`USER C: personal ${users.C.planTier}`);

  const dMembership = users.D.companyMemberships[0];
  const eMembership = users.E.companyMemberships[0];
  console.log(`USER D PERSONAL: ${users.D.planTier}`);
  console.log(`USER D COMPANY: ${dMembership ? company.planTier : "none"}`);
  console.log(`USER D ROLE: ${dMembership?.role ?? "none"}`);
  console.log(`USER E PERSONAL: ${users.E.planTier}`);
  console.log(`USER E COMPANY: ${eMembership ? company.planTier : "none"}`);
  console.log(`USER E ROLE: ${eMembership?.role ?? "none"}`);
  console.log(`USER F: personal ${users.F.planTier}, no company`);

  // Seat maths comes from the production authority, not a local subtraction:
  // getCompanySeatUsage is exactly what the seat gate calls, so purchased extra
  // seats and workspace plan resolution cannot silently disagree with the app.
  const activeSeats = await countActiveCompanySeats(company.id);
  const seatUsage = await getCompanySeatUsage({ companyId: company.id });
  const seatLimit = seatUsage.includedSeats;
  const overSeats = seatLimit === null ? 0 : Math.max(0, activeSeats - seatLimit);
  console.log(`SEATS USED: ${seatUsage.activeSeats}`);
  console.log(`SEATS INCLUDED: ${seatLimit ?? "unlimited"}`);
  console.log(`SEATS OVER LIMIT: ${overSeats}`);
  console.log(`SEATS AT LIMIT: ${seatUsage.atLimit}`);

  console.log("\n--- PLAN CANONICALISATION (measured on the production functions) ---");
  // The row keeps the legacy enum; the engine decides what it MEANS today.
  check(
    "P1-company-row-stores-legacy-corporate",
    company.planTier === "CORPORATE",
    `stored planTier is ${company.planTier}`,
  );
  check(
    "P2-canonical-plan-is-professional",
    canonicalizePlanTier(company.planTier) === "PROFESSIONAL",
    `canonicalizePlanTier returned ${canonicalizePlanTier(company.planTier)}`,
  );
  check(
    "P5-legacy-corporate-still-recognised",
    isLegacyCorporateAccount(company.planTier),
    "isLegacyCorporateAccount no longer recognises the stored value",
  );
  check(
    "P6-d-is-active-owner",
    dMembership?.role === "OWNER" && dMembership.status === "ACTIVE",
    `role=${dMembership?.role ?? "none"} status=${dMembership?.status ?? "none"}`,
  );
  check(
    "P7-e-is-active-member",
    eMembership?.role === "MEMBER" && eMembership.status === "ACTIVE",
    `role=${eMembership?.role ?? "none"} status=${eMembership?.status ?? "none"}`,
  );
  check(
    "P8-f-has-no-membership",
    users.F.companyMemberships.length === 0,
    `F holds ${users.F.companyMemberships.length} membership(s)`,
  );
  check("P9-active-seats-is-2", activeSeats === 2, `active seats = ${activeSeats}`);
  check("P10-included-seats-is-1", seatLimit === 1, `included seats = ${seatLimit}`);
  // Reported as its own counter, never hidden: the acceptance workspace runs
  // one seat over its included allowance and that is a deliberate fixture.
  check(
    "P11-over-seat-state-is-1",
    overSeats === 1,
    `over-seat count = ${overSeats} (expected the seeded 2-seat workspace on a 1-seat allowance)`,
  );

  if (users.A.planTier !== "STANDARD") fail("A must be STANDARD");
  if (users.B.planTier !== "PREMIUM") fail("B must be PREMIUM");
  if (users.C.planTier !== "PROFESSIONAL") fail("C must be PROFESSIONAL");
  if (users.D.planTier !== "STANDARD") fail("D personal must stay STANDARD");
  if (users.E.planTier !== "STANDARD") fail("E personal must stay STANDARD");
  if (dMembership?.role !== "OWNER" || dMembership.status !== "ACTIVE") {
    fail("D must be ACTIVE OWNER");
  }
  if (eMembership?.role !== "MEMBER" || eMembership.status !== "ACTIVE") {
    fail("E must be ACTIVE MEMBER");
  }
  if (users.F.companyMemberships.length > 0) fail("F must have no company membership");
  if (company.planTier !== "CORPORATE") fail("Company plan must be CORPORATE");
  if (activeSeats !== 2) fail(`Expected 2 active seats, got ${activeSeats}`);

  console.log("\n--- ENTITLEMENT SANITY ---");

  const entA = await resolveEntitlements(users.A.id, { preferUserSubject: true });
  const entB = await resolveEntitlements(users.B.id, { preferUserSubject: true });
  const entDPersonal = await resolveEntitlements(users.D.id, { preferUserSubject: true });
  const entDCompany = await resolveEntitlements(users.D.id, { companyId: company.id });
  const entEPersonal = await resolveEntitlements(users.E.id, { preferUserSubject: true });
  const entECompany = await resolveEntitlements(users.E.id, { companyId: company.id });

  const bSavedOk = hasFeature(entB.features, "saved_searches");
  const bAlertOk = hasFeature(entB.features, "smart_alerts");
  const aSavedDenied = entitlementDenied(() =>
    assertEntitlement(entA, "saved_searches"),
  );
  const aAlertDenied = entitlementDenied(() => assertEntitlement(entA, "smart_alerts"));
  const dPersonalSavedDenied = entitlementDenied(() =>
    assertEntitlement(entDPersonal, "saved_searches"),
  );
  // Frozen acceptance value. The workspace row still STORES the legacy
  // "CORPORATE" enum, but the product now ships two plans and the engine
  // canonicalises it. PROFESSIONAL is the contract; this is not a
  // "whatever-comes-out" snapshot.
  const CANONICAL_COMPANY_PLAN = "PROFESSIONAL";
  const dCompanyCorp = entDCompany.effectivePlanTier === CANONICAL_COMPANY_PLAN;
  const ePersonalSavedDenied = entitlementDenied(() =>
    assertEntitlement(entEPersonal, "saved_searches"),
  );
  const eCompanyCorp = entECompany.effectivePlanTier === CANONICAL_COMPANY_PLAN;

  const fCompanyMembership = await assertCompanyMembership(users.F.id, company.id);

  console.log(`PREMIUM PERSONAL SAVED_SEARCH ENTITLEMENT: ${bSavedOk ? "yes" : "no"}`);
  console.log(`PREMIUM PERSONAL ALERT ENTITLEMENT: ${bAlertOk ? "yes" : "no"}`);
  console.log(`STANDARD DENIAL (A): saved=${aSavedDenied}, alerts=${aAlertDenied}`);
  console.log(
    `CORPORATE OWNER PERSONAL ISOLATION: personalStandard=${entDPersonal.effectivePlanTier === "STANDARD"}, personalSavedDenied=${dPersonalSavedDenied}`,
  );
  console.log(`CORPORATE OWNER COMPANY: corporate=${dCompanyCorp}`);
  console.log(
    `CORPORATE MEMBER PERSONAL ISOLATION: personalStandard=${entEPersonal.effectivePlanTier === "STANDARD"}, personalSavedDenied=${ePersonalSavedDenied}`,
  );
  console.log(
    `CORPORATE MEMBER COMPANY: corporate=${eCompanyCorp}, role=${eMembership?.role}`,
  );
  console.log(`EXTERNAL COMPANY DENIAL: ${fCompanyMembership ? "FAIL" : "yes"}`);

  if (!bSavedOk || !bAlertOk) fail("Premium B must have saved_searches and smart_alerts");
  if (!aSavedDenied || !aAlertDenied) fail("Standard A must be denied both");
  if (!dPersonalSavedDenied || entDPersonal.effectivePlanTier !== "STANDARD") {
    fail("D personal must remain Standard-isolated");
  }
  check(
    "P3-d-company-context-plan",
    dCompanyCorp,
    `entitlement resolved ${entDCompany.effectivePlanTier}`,
  );
  if (!ePersonalSavedDenied || entEPersonal.effectivePlanTier !== "STANDARD") {
    fail("E personal must remain Standard-isolated");
  }
  check(
    "P4-e-company-context-plan",
    eCompanyCorp,
    `entitlement resolved ${entECompany.effectivePlanTier}`,
  );
  if (fCompanyMembership) fail("F must not resolve company membership");

  for (const key of ["D", "E"] as const) {
    const personal = await resolveEntitlements(users[key].id, { preferUserSubject: true });
    if (personal.personalPlan.effectivePlanTier !== "STANDARD") {
      fail(`${key} personalPlan snapshot must remain STANDARD`);
    }
  }

  console.log(`\nPROBLEMS=${problems.length}`);
  if (problems.length > 0) console.log(problems.map((p) => `  - ${p}`).join("\n"));
  console.log("DB WRITE: no");
  console.log("SECRETS PRINTED: no");
  console.log("\n===== HUKUM =====");
  console.log(
    problems.length === 0
      ? "PASS — acceptance personas verified"
      : "FAIL — acceptance persona contract not met",
  );
  if (problems.length > 0) process.exit(1);
}

main()
  .catch((e) => {
    // EntitlementError is bound only after the env is verified, so a failure
    // in loadAcceptanceEnv() would make `instanceof` throw INSIDE the handler.
    if (EntitlementError && e instanceof EntitlementError) {
      fail(`${e.code}: ${e.message}`);
    }
    // Shared redactor: Prisma/pg errors carry the host with no URI scheme
    // ("Can't reach database server at `db.<ref>.supabase.co`"), which the old
    // URI-only replace let through.
    fail(formatAcceptanceError(e));
  })
  .finally(async () => {
    await prisma?.$disconnect();
  });
