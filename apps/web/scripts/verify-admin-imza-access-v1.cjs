/* eslint-disable @typescript-eslint/no-require-imports -- Database-free admin route verification. */
const assert = require("node:assert/strict");
const { createLoader } = require("./lib/isolated-typescript-loader.cjs");

class AuthenticationError extends Error {}
class PlatformAuthorizationError extends Error {}
class NotFound extends Error {}
const Shell = () => null;
const emptyComponent = () => null;
const routes = [
  ["src/app/admin/page.tsx", {}],
  ["src/app/admin/[section]/page.tsx", { params: Promise.resolve({ section: "users" }), searchParams: Promise.resolve({}) }],
  ["src/app/admin/[section]/[id]/page.tsx", { params: Promise.resolve({ section: "users", id: "user-1" }) }],
  ["src/app/admin/notlar/page.tsx", {}],
  ["src/app/admin/health/page.tsx", {}],
  ["src/app/admin/requests/[id]/page.tsx", { params: Promise.resolve({ id: "request-1" }), searchParams: Promise.resolve({}) }],
];
let passed = 0;

function harness({ role = "ADMIN", authError, mfa = true } = {}) {
  const reads = [];
  const user = { id: "user-1", name: "Test kullanıcısı", email: "test@example.invalid", adminMfaEnabled: true, platformRole: "USER", planTier: "STANDARD", status: "ACTIVE", createdAt: new Date("2026-09-01T09:00:00Z"), lastLoginAt: null };
  const prisma = new Proxy({}, { get(_target, model) {
    return new Proxy({}, { get(_target, operation) {
      return async () => {
        reads.push(`${String(model)}.${String(operation)}`);
        if (operation === "findMany") return [];
        if (model === "user" && operation === "findUnique") return user;
        if (model === "request" && operation === "findFirst") return { id: "request-1", title: "Örnek talep", requestNumber: 1, offerCount: 0, status: "PUBLISHED", createdAt: user.createdAt, category: { name: "Örnek kategori", isActive: true }, offers: [] };
        throw new Error(`Unexpected database operation: ${String(model)}.${String(operation)}`);
      };
    } });
  } });
  const stubs = {
    "next/navigation": { notFound() { throw new NotFound(); } },
    "next/headers": { cookies: async () => ({ get: () => ({ value: "test-only-cookie" }) }) },
    "next/link": { __esModule: true, default: emptyComponent },
    "@/lib/prisma": { prisma },
    "@/server/auth/require-user": { AuthenticationError },
    "@/server/auth/require-platform-admin": { PlatformAuthorizationError, requirePlatformAdmin: async () => {
      if (authError) throw authError;
      return { id: "admin-1", name: "Test yöneticisi", platformRole: role };
    } },
    "@/server/admin/mfa": { ADMIN_MFA_COOKIE: "test-mfa", verifyMfaSession: () => mfa },
    "@/server/admin/support-request-access": { verifySupportRequestAccessToken: () => false },
    "@/server/request/public-visibility": { requestPublicationState: () => ({ isPublished: true, label: "Yayında", status: "PUBLISHED" }) },
    "@/lib/request-category-engine": { getBuiltInCategoryById: () => null },
    "@/components/admin/AdminShell": { AdminShell: Shell },
    pg: { Client: class { async connect() {} async end() {} async query() { return { rows: [{ userCount: 10, companyCount: 4, requestCount: 8, offerCount: 12 }] }; } } },
  };
  for (const name of ["AdminOverview", "AdminUsersTable", "AdminSecurityGate", "AdminOperationsCenter", "DateRangeComparison", "AdminHealthMeta", "AdminChartInsights", "AdminPrivacyNotice", "CategoryManagement", "RequestOffersDrawer", "CompanyMembersDrawer", "CompanyOperationsPanel", "CompanySeatAssignment", "UserDetailDrawer", "RoleNoteComposer", "HealthCenter"]) {
    stubs[`@/components/admin/${name}`] = { [name]: emptyComponent };
  }
  return { load: createLoader(stubs), reads };
}

async function main() {
  for (const [path, props] of routes) {
    for (const authError of [new AuthenticationError(), new PlatformAuthorizationError()]) {
      const test = harness({ authError });
      await assert.rejects(() => test.load(path).default(props), NotFound);
      assert.deepEqual(test.reads, [], "Denied sessions must not read page data.");
      passed++;
    }
    const mfa = harness({ mfa: false });
    if (path === "src/app/admin/page.tsx") {
      const result = await mfa.load(path).default(props);
      assert.notEqual(result.type, Shell, "The full admin shell must not be rendered before MFA.");
      assert.deepEqual(mfa.reads, ["user.findUnique"]);
    } else {
      await assert.rejects(() => mfa.load(path).default(props), NotFound);
      assert.deepEqual(mfa.reads, []);
    }
    passed++;
    const allowed = harness();
    const result = await allowed.load(path).default(props);
    assert.equal(result.type, Shell, `${path} must use the shared admin shell.`);
    assert.equal(result.props.role, "ADMIN");
    passed++;
  }
  for (const [section, role] of [["companies", "SUPPORT"], ["offers", "MODERATOR"], ["notifications", "SUPPORT"], ["curation", "SUPPORT"]]) {
    const denied = harness({ role });
    await assert.rejects(() => denied.load("src/app/admin/[section]/page.tsx").default({ params: Promise.resolve({ section }), searchParams: Promise.resolve({}) }), NotFound);
    assert.deepEqual(denied.reads, []);
    passed++;
  }
  const { getAdminNavigation } = createLoader()("src/lib/admin-navigation.ts");
  const hrefs = (role) => getAdminNavigation(role).map((item) => item.href);
  assert.deepEqual(hrefs("USER"), []); passed++;
  for (const role of ["SUPPORT", "MODERATOR", "ANALYST"]) {
    assert(!hrefs(role).includes("/admin#categories")); passed++;
  }
  for (const role of ["ADMIN", "SUPER_ADMIN"]) { assert(hrefs(role).includes("/admin#categories")); passed++; }
  assert(!hrefs("SUPPORT").includes("/admin/companies")); passed++;
  assert(!hrefs("MODERATOR").includes("/admin/offers")); passed++;
  assert(hrefs("ANALYST").includes("/admin/health")); passed++;
  console.log(`Admin İmza access: ${passed} passed, 0 failed; no database or network access.`);
}

// Only the stub pg client reads this variable; no connection is created.
const priorDirect = process.env.DIRECT_URL;
process.env.DIRECT_URL = "postgresql://local:local@127.0.0.1:1/admin_ui_validation";
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => {
  if (priorDirect === undefined) delete process.env.DIRECT_URL; else process.env.DIRECT_URL = priorDirect;
});
