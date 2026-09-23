/* eslint-disable @typescript-eslint/no-require-imports -- Database-free CommonJS verification runner. */
const assert = require("node:assert/strict");
const { createLoader } = require("./lib/isolated-typescript-loader.cjs");
const load = createLoader();
const policy = load("src/lib/membership/seat-policy.ts");
const permissions = load("src/lib/membership/company-permissions.ts");
const prices = load("src/lib/billing/price-book.ts");
let passed = 0;
async function check(name, test) {
  try { await test(); passed++; console.log("PASS — " + name); }
  catch (error) { console.error("FAIL — " + name); throw error; }
}
const now = new Date("2026-09-13T12:00:00Z");
function usage(operating, analysis, extra = 0, extraExpiry) {
  return policy.buildSeatUsage({
    planTier: "STANDARD", workspaceEffectivePlanTier: "PROFESSIONAL",
    activeSeats: operating + analysis, activeAnalysisSeats: analysis, activeOwnerSeats: Math.min(1, operating),
    extraSeatsPurchased: extra, extraSeatsExpiresAt: extraExpiry, now,
  });
}
async function main() {
  await check("Five included seats, exactly 1 owner + 3 members + 1 analyst", () => {
    assert.equal(policy.WORKSPACE_BASE_INCLUDED_SEATS, 5);
    assert.equal(usage(1, 0).ownerSeats.limit, 1);
    assert.equal(usage(1, 0).memberSeats.limit, 3);
    assert.equal(usage(1, 0).operatingSeats.limit, 4);
    assert.equal(usage(1, 0).analysisSeats.limit, 1);
    assert.equal(usage(1, 0).operatingSeats.remaining, 3);
  });
  for (const tier of ["PROFESSIONAL", "PREMIUM", "CORPORATE"]) {
    await check(tier + " canonical seat capacity is five", () => assert.equal(policy.getIncludedSeats(tier), 5));
  }
  for (const entry of prices.PRICE_BOOK.filter((p) => p.context === "WORKSPACE")) {
    await check(entry.interval + " sales catalog matches runtime seats", () => assert.equal(entry.includedSeats, 5));
  }
  for (let owners = 0; owners <= 2; owners++) {
    for (let members = 0; members <= 4; members++) {
      for (let analysts = 0; analysts <= 2; analysts++) {
        await check(owners + " owners / " + members + " members / " + analysts + " analysts keep reserved seats", () => {
          const total = owners + members + analysts;
          const s = policy.buildSeatUsage({ planTier: "PROFESSIONAL", activeSeats: total, activeOwnerSeats: owners, activeAnalysisSeats: analysts });
          assert.equal(policy.seatPoolForRole(s, "OWNER").atLimit, owners >= 1 || total >= 5 || owners + members >= 4);
          assert.equal(policy.seatPoolForRole(s, "MEMBER").atLimit, members >= 3 || total >= 5 || owners + members >= 4);
          assert.equal(policy.seatPoolForRole(s, "ADMIN").atLimit, policy.seatPoolForRole(s, "MEMBER").atLimit);
          assert.equal(policy.seatPoolForRole(s, "MANAGER").atLimit, policy.seatPoolForRole(s, "MEMBER").atLimit);
          assert.equal(policy.seatPoolForRole(s, "VIEWER").atLimit, analysts >= 1 || total >= 5);
        });
      }
    }
  }
  await check("Paid extras extend operating capacity only; expiry removes extras", () => {
    assert.equal(usage(4, 1, 2).operatingSeats.limit, 6);
    assert.equal(usage(4, 1, 2).analysisSeats.limit, 1);
    assert.equal(usage(4, 1, 2).ownerSeats.limit, 1);
    assert.equal(usage(4, 1, 2).memberSeats.limit, 5);
    assert.equal(usage(4, 1, 2, new Date("2026-09-12")).operatingSeats.limit, 4);
  });
  for (const role of ["OWNER", "ADMIN", "MANAGER", "MEMBER", "VIEWER", "SUPER_ADMIN", "", null, undefined]) {
    await check(String(role) + " company write authority", () => {
      assert.equal(permissions.canMutateCompanyWorkspace(role), ["OWNER", "ADMIN", "MANAGER", "MEMBER"].includes(role));
      assert.equal(permissions.canManageCompany(role), role === "OWNER");
      assert.equal(permissions.canViewTeamOffers(role), role === "OWNER" || role === "VIEWER");
    });
  }
  await check("Analysis reads team offers but cannot invite or receive operating privileges", () => {
    assert.equal(permissions.canViewTeamOffers("VIEWER"), true);
    assert.equal(permissions.canInviteCompanyRole("VIEWER", "MEMBER"), false);
    assert.equal(permissions.canInviteCompanyRole("MANAGER", "ADMIN"), false);
    assert.deepEqual([...permissions.COMPANY_ROLES], ["OWNER", "MEMBER", "VIEWER"]);
    assert.deepEqual([...permissions.COMPANY_INVITE_ROLES], ["MEMBER", "VIEWER"]);
    assert.equal(permissions.isCompanyInviteRole("ADMIN"), false);
    assert.equal(permissions.isCompanyInviteRole("MANAGER"), false);
    assert.equal(permissions.isCompanyInviteRole("OWNER"), false);
    assert.equal(permissions.isCompanyInviteRole("SUPER_ADMIN"), false);
    assert.equal(permissions.isCompanyInviteRole({ role: "MEMBER" }), false);
  });

  // Real production membership + workspace guards with in-memory database records.
  let selected = "company-a";
  const memberships = new Map([["company-a", "VIEWER"], ["company-b", "MEMBER"]]);
  const accessLoad = createLoader({
    "next/headers": { cookies: async () => ({ get: () => selected ? { value: selected } : undefined }) },
    "@/lib/prisma": { prisma: { companyMember: { findFirst: async ({ where }) => {
      const role = memberships.get(where.companyId);
      return role ? { role, company: { id: where.companyId, name: "Test firm" } } : null;
    } } } },
  });
  const access = accessLoad("src/server/company/company-write-access.ts");
  await check("Analysis workspace returns a readable 403", () =>
    assert.rejects(access.assertSelectedCompanyWriteAccess("u"), (e) => e.code === "COMPANY_READ_ONLY" && e.status === 403));
  await check("Personal Professional status cannot override VIEWER", async () => {
    // The actual role guard never consults personal plan.
    await assert.rejects(access.assertCompanyWriteAccess("u", "company-a"), (e) => e.code === "COMPANY_READ_ONLY");
  });
  await check("Switching workspace cannot modify the old firm's resources", async () => {
    selected = "company-b";
    assert.equal(await access.assertSelectedCompanyWriteAccess("u"), "company-b");
    await assert.rejects(access.assertCompanyWriteAccess("u", "company-a"), (e) => e.code === "COMPANY_READ_ONLY");
  });
  await check("Personal mode retains personal writes, not company writes", async () => {
    selected = "__personal__";
    assert.equal(await access.assertSelectedCompanyWriteAccess("u"), null);
    await access.assertCompanyWriteAccess("u", null);
    await assert.rejects(access.assertCompanyWriteAccess("u", "company-a"));
  });
  await check("Removed membership is denied, even with a stale workspace cookie", async () => {
    selected = "removed-company";
    await assert.rejects(access.assertSelectedCompanyWriteAccess("u"), (e) => e.code === "COMPANY_ACCESS_DENIED");
  });

  // Actual activation gate counts only active records, by role.
  let people = [
    { role: "OWNER", status: "ACTIVE" },
    { role: "ADMIN", status: "ACTIVE" },
    { role: "MANAGER", status: "ACTIVE" },
    { role: "MEMBER", status: "ACTIVE" },
    { role: "VIEWER", status: "INVITED" },
  ];
  const seatDb = {
    company: { findUnique: async () => ({ planTier: "STANDARD", planExpiresAt: null }) },
    companyMember: {
      count: async ({ where }) => people.filter((p) => p.status === where.status && (!where.role || p.role === where.role)).length,
      findFirst: async () => ({ user: { planTier: "PROFESSIONAL", planExpiresAt: null } }),
    },
  };
  const seatsLoad = createLoader({
    "@/lib/prisma": { prisma: seatDb },
    "./company-addon-entitlement": { getCompanyAddonSnapshot: async () => ({ extraSeatsActiveCount: 0, extraSeatsExpiresAt: null }) },
  });
  const seats = seatsLoad("src/server/company/assert-company-seat.ts");
  await check("Four operators block a fifth while still allowing an analyst", async () => {
    await assert.rejects(seats.assertCanActivateCompanySeat({ companyId: "c", role: "MEMBER" }), (e) => e.code === "SEAT_LIMIT_REACHED");
    await seats.assertCanActivateCompanySeat({ companyId: "c", role: "VIEWER" });
  });
  await check("An active analyst blocks another analyst, irrespective of operating vacancies", async () => {
    people[4].status = "ACTIVE";
    people[3].status = "REMOVED";
    await seats.assertCanActivateCompanySeat({ companyId: "c", role: "MEMBER" });
    await assert.rejects(seats.assertCanActivateCompanySeat({ companyId: "c", role: "VIEWER" }));
  });
  await check("Removing an analyst frees only the analysis seat", async () => {
    people[3].status = "ACTIVE";
    people[4].status = "REMOVED";
    await seats.assertCanActivateCompanySeat({ companyId: "c", role: "VIEWER" });
    await assert.rejects(seats.assertCanActivateCompanySeat({ companyId: "c", role: "ADMIN" }));
  });
  await check("Second owner is denied even when member slots are empty", async () => {
    people = [{ role: "OWNER", status: "ACTIVE" }];
    await assert.rejects(seats.assertCanActivateCompanySeat({ companyId: "c", role: "OWNER" }), (e) => e.code === "SEAT_LIMIT_REACHED");
    await seats.assertCanActivateCompanySeat({ companyId: "c", role: "MEMBER" });
  });
  await check("Owner vacancy is not a fourth member slot", async () => {
    people = Array.from({ length: 3 }, () => ({ role: "MEMBER", status: "ACTIVE" }));
    await assert.rejects(seats.assertCanActivateCompanySeat({ companyId: "c", role: "MEMBER" }), (e) => e.code === "SEAT_LIMIT_REACHED");
    await seats.assertCanActivateCompanySeat({ companyId: "c", role: "OWNER" });
    await seats.assertCanActivateCompanySeat({ companyId: "c", role: "VIEWER" });
  });
  await check("Unknown activation roles fail closed", () => assert.rejects(seats.assertCanActivateCompanySeat({ companyId: "c", role: "SUPER_ADMIN" }), (e) => e.code === "INVALID_COMPANY_ROLE"));
  await check("Legacy Standard cannot gain a second owner", () => {
    const s = policy.buildSeatUsage({ planTier: "STANDARD", activeSeats: 1, activeOwnerSeats: 1 });
    assert.equal(policy.seatPoolForRole(s, "OWNER").atLimit, true);
  });
  console.log("\n" + passed + " passed, 0 failed");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
