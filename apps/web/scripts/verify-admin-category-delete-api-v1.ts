/**
 * Controlled live API + server-rendered admin screen QA.
 * Creates only uniquely marked temporary records and removes them in finally.
 */
import assert from "node:assert/strict";
import { join } from "node:path";
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: join(__dirname, "..", ".env") });
loadDotenv({ path: join(__dirname, "..", ".env.local"), override: true });

if (!process.argv.includes("--apply")) {
  throw new Error("Canlı API QA için açık --apply onayı gerekli.");
}

const baseUrl = process.argv.find((item) => item.startsWith("--base-url="))?.slice(11)
  ?? "http://localhost:3199";

type CookieHeaders = Headers & { getSetCookie?: () => string[] };

class CookieJar {
  private readonly values = new Map<string, string>();

  capture(headers: Headers) {
    const cookieHeaders = headers as CookieHeaders;
    const values = cookieHeaders.getSetCookie?.() ?? (headers.get("set-cookie") ? [headers.get("set-cookie")!] : []);
    for (const value of values) {
      const pair = value.split(";", 1)[0];
      const separator = pair.indexOf("=");
      if (separator > 0) this.values.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
  }

  header() {
    return [...this.values].map(([name, value]) => `${name}=${value}`).join("; ");
  }
}

async function requestWithCookies(jar: CookieJar, path: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    redirect: init.redirect ?? "manual",
    headers: { ...init.headers, ...(jar.header() ? { cookie: jar.header() } : {}) },
  });
  jar.capture(response.headers);
  return response;
}

async function login(email: string, password: string) {
  const jar = new CookieJar();
  const csrfResponse = await requestWithCookies(jar, "/api/auth/csrf");
  assert.equal(csrfResponse.status, 200, "CSRF endpoint failed");
  const csrf = await csrfResponse.json() as { csrfToken?: string };
  assert(csrf.csrfToken, "CSRF token missing");

  const loginResponse = await requestWithCookies(jar, "/api/auth/callback/credentials?json=true", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      csrfToken: csrf.csrfToken,
      email,
      password,
      callbackUrl: `${baseUrl}/admin`,
      json: "true",
    }),
  });
  assert([200, 302].includes(loginResponse.status), `Login failed (${loginResponse.status})`);

  const sessionResponse = await requestWithCookies(jar, "/api/auth/session");
  const session = await sessionResponse.json() as { user?: { email?: string } };
  assert.equal(session.user?.email, email, "Authenticated session did not resolve QA user");

  const mfaResponse = await requestWithCookies(jar, "/api/admin/mfa", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "bypass" }),
  });
  assert.equal(mfaResponse.status, 200, "Local MFA bypass failed");
  return jar;
}

function categoryRow(html: string, categoryId: string) {
  const marker = `data-category-id="${categoryId}"`;
  const start = html.indexOf(marker);
  assert(start >= 0, `Admin screen did not render category ${categoryId}`);
  const next = html.indexOf("data-category-id=", start + marker.length);
  return html.slice(start, next >= 0 ? next : undefined);
}

async function json(response: Response) {
  return response.json() as Promise<{ ok?: boolean; message?: string; dependencies?: Record<string, number> }>;
}

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { hashPassword } = await import("../src/lib/auth/password");
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const password = `QaDelete!${nonce}`;
  const userIds: string[] = [];
  let companyId: string | null = null;
  let emptyCategoryId: string | null = null;
  let linkedCategoryId: string | null = null;

  try {
    const health = await fetch(baseUrl, { redirect: "manual" });
    assert(health.status < 500, `Dev server unavailable at ${baseUrl}`);

    const superAdmin = await prisma.user.create({
      data: {
        email: `qa-category-super-${nonce}@talepo.test`,
        name: "QA Category Super Admin",
        membershipNumber: `QA-SA-${nonce}`,
        passwordHash: hashPassword(password),
        platformRole: "SUPER_ADMIN",
        status: "ACTIVE",
      },
      select: { id: true, email: true },
    });
    userIds.push(superAdmin.id);
    const admin = await prisma.user.create({
      data: {
        email: `qa-category-admin-${nonce}@talepo.test`,
        name: "QA Category Admin",
        membershipNumber: `QA-AD-${nonce}`,
        passwordHash: hashPassword(password),
        platformRole: "ADMIN",
        status: "ACTIVE",
      },
      select: { id: true, email: true },
    });
    userIds.push(admin.id);

    const emptyCategory = await prisma.category.create({
      data: { name: `QA Empty ${nonce}`, slug: `qa-empty-${nonce}`, sortOrder: 999_990 },
      select: { id: true, name: true },
    });
    emptyCategoryId = emptyCategory.id;
    const linkedCategory = await prisma.category.create({
      data: { name: `QA Linked ${nonce}`, slug: `qa-linked-${nonce}`, sortOrder: 999_991 },
      select: { id: true, name: true },
    });
    linkedCategoryId = linkedCategory.id;
    const company = await prisma.company.create({
      data: { name: `QA Category Company ${nonce}`, slug: `qa-category-company-${nonce}`, createdById: superAdmin.id },
      select: { id: true },
    });
    companyId = company.id;
    await prisma.companyCategory.create({ data: { companyId: company.id, categoryId: linkedCategory.id } });
    await prisma.alertRule.create({
      data: { ownerType: "USER", userId: superAdmin.id, name: `QA Category Alert ${nonce}`, categoryId: linkedCategory.id, isActive: true },
    });
    await prisma.companyInventoryItem.create({
      data: { companyId: company.id, name: `QA Category Stock ${nonce}`, categoryId: linkedCategory.id, isActive: true },
    });
    await prisma.requestForm.create({
      data: { categoryId: linkedCategory.id, name: `QA Category Form ${nonce}`, version: 1, isActive: true },
    });
    await prisma.categorySuggestion.create({
      data: { userId: superAdmin.id, categoryId: linkedCategory.id, name: `QA Category Suggestion ${nonce}` },
    });
    const linkedRequest = await prisma.request.create({
      data: {
        createdById: superAdmin.id,
        categoryId: linkedCategory.id,
        title: `QA Category Request ${nonce}`,
        description: "Temporary category dependency QA",
      },
      select: { id: true },
    });
    await prisma.priceObservation.create({
      data: {
        sourceType: "TALEPO_REQUEST",
        requestId: linkedRequest.id,
        categoryId: linkedCategory.id,
        price: 100,
        idempotencyKey: `QA_CATEGORY_DELETE:${nonce}`,
      },
    });

    const superJar = await login(superAdmin.email!, password);
    const adminJar = await login(admin.email!, password);
    const anonymous = new CookieJar();
    const endpoint = `/api/admin/categories/${emptyCategory.id}`;
    const validBody = { reason: "Kontrollü API silme QA", confirmationName: emptyCategory.name };

    const anonymousResponse = await requestWithCookies(anonymous, endpoint, {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(validBody),
    });
    assert.equal(anonymousResponse.status, 401, "Anonymous delete must return 401");

    const anonymousHealthResponse = await requestWithCookies(anonymous, "/api/admin/health?days=30");
    assert.equal(anonymousHealthResponse.status, 401, "Anonymous health request must return 401");

    const adminResponse = await requestWithCookies(adminJar, endpoint, {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(validBody),
    });
    assert.equal(adminResponse.status, 403, "Admin delete must return 403");

    const missingNameResponse = await requestWithCookies(superJar, endpoint, {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: validBody.reason }),
    });
    assert.equal(missingNameResponse.status, 400, "Missing server-side name confirmation must return 400");
    assert(await prisma.category.findUnique({ where: { id: emptyCategory.id } }), "Missing confirmation deleted category");

    const nullBodyResponse = await requestWithCookies(superJar, endpoint, {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(null),
    });
    assert.equal(nullBodyResponse.status, 400, "Null JSON body must return 400");

    const numericReasonResponse = await requestWithCookies(superJar, endpoint, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: 12345, confirmationName: emptyCategory.name }),
    });
    assert.equal(numericReasonResponse.status, 400, "Numeric reason must return 400");
    assert(await prisma.category.findUnique({ where: { id: emptyCategory.id } }), "Malformed input deleted category");

    const wrongNameResponse = await requestWithCookies(superJar, endpoint, {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...validBody, confirmationName: "wrong" }),
    });
    assert.equal(wrongNameResponse.status, 400, "Wrong server-side name confirmation must return 400");

    const linkedResponse = await requestWithCookies(superJar, `/api/admin/categories/${linkedCategory.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: validBody.reason, confirmationName: linkedCategory.name }),
    });
    assert.equal(linkedResponse.status, 409, "Linked category delete must return 409");
    const linkedBody = await json(linkedResponse);
    assert.equal(linkedBody.dependencies?.companies, 1, "Company dependency not reported");
    assert.equal(linkedBody.dependencies?.requests, 1, "Request dependency not reported");
    assert.equal(linkedBody.dependencies?.forms, 1, "Form dependency not reported");
    assert.equal(linkedBody.dependencies?.suggestions, 1, "Suggestion dependency not reported");
    assert.equal(linkedBody.dependencies?.alerts, 1, "Alert dependency not reported");
    assert.equal(linkedBody.dependencies?.inventory, 1, "Inventory dependency not reported");
    assert.equal(linkedBody.dependencies?.priceObservations, 1, "Price dependency not reported");
    assert(await prisma.companyCategory.findFirst({ where: { categoryId: linkedCategory.id } }), "Company link was removed");
    const alert = await prisma.alertRule.findFirst({ where: { categoryId: linkedCategory.id }, select: { categoryId: true, isActive: true } });
    assert.deepEqual(alert, { categoryId: linkedCategory.id, isActive: true }, "Alert changed after rejected delete");
    assert(await prisma.companyInventoryItem.findFirst({ where: { categoryId: linkedCategory.id } }), "Inventory was detached");

    const screenResponse = await requestWithCookies(superJar, "/admin");
    assert.equal(screenResponse.status, 200, "Admin screen did not render");
    const html = await screenResponse.text();
    assert(categoryRow(html, emptyCategory.id).includes('data-action="delete-category"'), "Empty category screen row lacks delete action");
    assert(!categoryRow(html, linkedCategory.id).includes('data-action="delete-category"'), "Linked category screen row exposes delete action");

    const deleteResponse = await requestWithCookies(superJar, endpoint, {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(validBody),
    });
    assert.equal(deleteResponse.status, 200, `Valid Super Admin delete failed: ${(await json(deleteResponse)).message ?? "unknown"}`);
    emptyCategoryId = null;
    assert.equal(await prisma.category.findUnique({ where: { id: emptyCategory.id } }), null, "Confirmed category still exists");
    assert(await prisma.adminAuditLog.findFirst({
      where: { actorId: superAdmin.id, metadata: { path: ["operation"], equals: "DELETE" } },
      select: { id: true },
    }), "Delete audit record missing");

    console.log("PASS: category delete API auth, server confirmation, dependency policy and admin render QA");
  } finally {
    if (linkedCategoryId) {
      await prisma.priceObservation.deleteMany({ where: { categoryId: linkedCategoryId } });
      await prisma.request.deleteMany({ where: { categoryId: linkedCategoryId } });
      await prisma.requestForm.deleteMany({ where: { categoryId: linkedCategoryId } });
      await prisma.categorySuggestion.deleteMany({ where: { categoryId: linkedCategoryId } });
      await prisma.alertRule.deleteMany({ where: { categoryId: linkedCategoryId } });
      await prisma.companyInventoryItem.deleteMany({ where: { categoryId: linkedCategoryId } });
      await prisma.companyCategory.deleteMany({ where: { categoryId: linkedCategoryId } });
    }
    if (companyId) await prisma.company.deleteMany({ where: { id: companyId } });
    if (emptyCategoryId) await prisma.category.deleteMany({ where: { id: emptyCategoryId } });
    if (linkedCategoryId) await prisma.category.deleteMany({ where: { id: linkedCategoryId } });
    if (userIds.length) {
      await prisma.adminAuditLog.deleteMany({ where: { actorId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    assert.equal(
      await prisma.category.count({ where: { slug: { in: [`qa-empty-${nonce}`, `qa-linked-${nonce}`] } } }),
      0,
      "QA category cleanup incomplete",
    );
    assert.equal(
      await prisma.user.count({ where: { email: { in: [`qa-category-super-${nonce}@talepo.test`, `qa-category-admin-${nonce}@talepo.test`] } } }),
      0,
      "QA user cleanup incomplete",
    );
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
