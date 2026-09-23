/* eslint-disable @typescript-eslint/no-require-imports -- Database-free CommonJS verification runner. */
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { createLoader } = require("./lib/isolated-typescript-loader.cjs");
let role = "OWNER", profileWrites = 0, categoryWrites = 0, assignmentWrites = 0, passed = 0;
let memberRole = "MEMBER", memberCompany = "firm", memberActive = true;
const company = { id: "firm", name: "Test company" };
const prisma = {
  company: { findFirst: async () => company },
  companyCategory: { findMany: async () => [] },
  companyMember: { findFirst: async ({ where }) => {
    assert.equal(where.status, "ACTIVE");
    if (where.id) {
      assert.ok(where.role.in.includes("MEMBER"));
      assert.ok(!where.role.in.includes("VIEWER"));
      return memberActive && where.companyId === memberCompany && where.role.in.includes(memberRole)
        ? { id: where.id, role: memberRole } : null;
    }
    return role ? { role, company } : null;
  } },
  opportunityMatch: { updateMany: async ({ where, data }) => {
    assert.equal(where.companyId, "firm");
    assert.ok(data.assignedToMemberId === "target" || data.assignedToMemberId === null);
    assignmentWrites++;
    return { count: 1 };
  } },
};
const load = createLoader({
  "@/lib/prisma": { prisma },
  "@/server/auth/require-user": {
    requireUser: async () => ({ id: "actor" }),
    AuthenticationError: class AuthenticationError extends Error {},
    DatabaseUnavailableError: class DatabaseUnavailableError extends Error {},
  },
  "@/lib/membership/company-context": { getCompanyContextOptions: async () => ({ companyId: "firm" }) },
  "@/lib/membership/resolve-entitlements": { resolveEntitlements: async () => ({
    userId: "actor", subject: { type: "company", ...company }, companyRole: role,
    effectivePlanTier: "PROFESSIONAL", features: {},
  }) },
  "@/lib/membership/membership-rules": { hasPersonalPlanMismatch: () => false, TEAM_PLAN_SCOPE_NOTE: "Team" },
  "@/server/company/create-company": { CompanyValidationError: class CompanyValidationError extends Error {} },
  "@/server/company/sync-company-categories": {
    CategorySelectionError: class CategorySelectionError extends Error {},
    normalizeCategorySlugs: (slugs) => slugs,
    syncCompanyCategories: async (companyId) => { assert.equal(companyId, "firm"); categoryWrites++; },
  },
  "@/server/company/update-company": {
    CompanyUpdateError: class CompanyUpdateError extends Error {},
    updateCompanyProfile: async (companyId) => { assert.equal(companyId, "firm"); profileWrites++; return company; },
  },
  "@/server/request/distribute-request": { backfillMatchesForCompany: async () => {} },
  "@/components/panel/CompanySettingsForm": { CompanySettingsForm: () => React.createElement("form", { "data-testid": "profile-editor" }) },
  "@/components/panel/CompanyCategoriesForm": { CompanyCategoriesForm: () => React.createElement("form", { "data-testid": "category-editor" }) },
});
const { PATCH } = load("src/app/api/company/route.ts");
const { assertCanMutateBilling } = load("src/server/billing/assert-billing-permission.ts");
const { canAssignOpportunities } = load("src/server/monetization/opportunity-assignment.ts");
const { assignOpportunity } = load("src/server/monetization/opportunity-hunter.ts");
const CompanySettingsPage = load("src/app/panel/firma/page.tsx").default;
const { formatMemberRole } = load("src/lib/panel/company-format.ts");
async function check(name, run) {
  await run(); passed++; console.log("PASS — " + name);
}
async function main() {
  for (const actorRole of ["OWNER", "MEMBER", "VIEWER", "ADMIN", "MANAGER"]) {
    role = actorRole;
    const owner = actorRole === "OWNER";
    await check(actorRole + " company billing permission", async () => {
      const operation = assertCanMutateBilling({ actorUserId: "actor", subject: { type: "COMPANY", id: "firm" } });
      if (owner) await operation;
      else await assert.rejects(operation, (error) => error.code === "BILLING_FORBIDDEN");
    });
    await check(actorRole + " company profile and categories HTTP permission", async () => {
      const beforeProfile = profileWrites, beforeCategories = categoryWrites;
      const response = await PATCH(new Request("http://localhost/api/company", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: { name: "Updated" }, categorySlugs: ["automotive"] }),
      }));
      assert.equal(response.status, owner ? 200 : 403, JSON.stringify(await response.json()));
      assert.equal(profileWrites - beforeProfile, owner ? 1 : 0);
      assert.equal(categoryWrites - beforeCategories, owner ? 1 : 0);
    });
    await check(actorRole + " company settings screen exposes edits only for owner", async () => {
      const html = renderToStaticMarkup(await CompanySettingsPage());
      assert.equal(html.includes('data-testid="profile-editor"'), owner);
      assert.equal(html.includes('data-testid="category-editor"'), owner);
      if (!owner) assert.ok(html.includes("Firma profilini görüntüle"));
    });
    await check(actorRole + " opportunity assignment authority", () => assert.equal(canAssignOpportunities(actorRole), owner));
  }
  await check("Company members retain their own personal billing access", async () => {
    await assertCanMutateBilling({ actorUserId: "actor", subject: { type: "USER", id: "actor" } });
    await assert.rejects(assertCanMutateBilling({ actorUserId: "actor", subject: { type: "USER", id: "another" } }));
  });
  await check("Missing company membership cannot mutate billing", async () => {
    role = null;
    await assert.rejects(assertCanMutateBilling({ actorUserId: "actor", subject: { type: "COMPANY", id: "firm" } }));
  });
  for (const targetRole of ["OWNER", "MEMBER", "ADMIN", "MANAGER", "VIEWER"]) {
    memberRole = targetRole;
    await check(targetRole + " task assignment target respects operating role", async () => {
      const before = assignmentWrites;
      if (targetRole === "VIEWER") await assert.rejects(assignOpportunity("op", "target", "firm"));
      else await assignOpportunity("op", "target", "firm");
      assert.equal(assignmentWrites - before, targetRole === "VIEWER" ? 0 : 1);
    });
  }
  await check("Task assignment excludes removed and unrelated members", async () => {
    const before = assignmentWrites;
    memberRole = "MEMBER";
    memberCompany = "other-firm";
    await assert.rejects(assignOpportunity("op", "target", "firm"));
    memberCompany = "firm"; memberActive = false;
    await assert.rejects(assignOpportunity("op", "target", "firm"));
    assert.equal(assignmentWrites, before);
  });
  await check("Company role labels expose only Owner, Member and Analyst", () => {
    assert.equal(formatMemberRole("OWNER"), "Sahip (Owner)");
    assert.equal(formatMemberRole("MEMBER"), "Üye");
    assert.equal(formatMemberRole("ADMIN"), "Üye");
    assert.equal(formatMemberRole("MANAGER"), "Üye");
    assert.equal(formatMemberRole("VIEWER"), "Analist");
  });
  console.log("\n" + passed + " passed, 0 failed; in-memory records only.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
