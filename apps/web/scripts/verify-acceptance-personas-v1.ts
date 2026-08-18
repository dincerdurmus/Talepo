/**
 * Verify acceptance persona seed + ownership/plan isolation on staging.
 * Run: npm run acceptance:verify-personas
 */
import "./lib/load-acceptance-env";
import { assertEntitlement } from "../src/lib/membership/assert-entitlement";
import { hasFeature } from "../src/lib/membership/entitlements";
import { resolveEntitlements } from "../src/lib/membership/resolve-entitlements";
import { getIncludedSeats } from "../src/lib/membership/seat-policy";
import { EntitlementError } from "../src/lib/membership/types";
import { assertCompanyMembership } from "../src/lib/panel/company-workspace";
import { countActiveCompanySeats } from "../src/server/company/assert-company-seat";
import { prisma } from "../src/lib/prisma";
import {
  ACCEPTANCE_COMPANY,
  ACCEPTANCE_MARKER,
  PERSONAS,
  type PersonaKey,
} from "./lib/acceptance-personas-v1.constants";

function fail(msg: string): never {
  console.error(`FAIL — ${msg}`);
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

  const activeSeats = await countActiveCompanySeats(company.id);
  const seatLimit = getIncludedSeats("CORPORATE");
  console.log(`SEATS USED: ${activeSeats} / ${seatLimit}`);

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
  const dCompanyCorp = entDCompany.effectivePlanTier === "CORPORATE";
  const ePersonalSavedDenied = entitlementDenied(() =>
    assertEntitlement(entEPersonal, "saved_searches"),
  );
  const eCompanyCorp = entECompany.effectivePlanTier === "CORPORATE";

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
  if (!dCompanyCorp) fail("D company context must be Corporate");
  if (!ePersonalSavedDenied || entEPersonal.effectivePlanTier !== "STANDARD") {
    fail("E personal must remain Standard-isolated");
  }
  if (!eCompanyCorp) fail("E company context must be Corporate");
  if (fCompanyMembership) fail("F must not resolve company membership");

  for (const key of ["D", "E"] as const) {
    const personal = await resolveEntitlements(users[key].id, { preferUserSubject: true });
    if (personal.personalPlan.effectivePlanTier !== "STANDARD") {
      fail(`${key} personalPlan snapshot must remain STANDARD`);
    }
  }

  console.log("\nPASS — acceptance personas verified");
  console.log("DB WRITE: no");
  console.log("SECRETS PRINTED: no");
}

main()
  .catch((e) => {
    if (e instanceof EntitlementError) {
      fail(`${e.code}: ${e.message}`);
    }
    const msg = e instanceof Error ? e.message : String(e);
    fail(msg.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[redacted-uri]"));
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
