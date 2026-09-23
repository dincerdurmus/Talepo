/* eslint-disable @typescript-eslint/no-require-imports -- Runs real services and HTTP handlers against isolated records. */
const assert = require("node:assert/strict");
const { createLoader } = require("./lib/isolated-typescript-loader.cjs");
let passed = 0;

function harness() {
  let state = {
    request: { id: "request-1", title: "İnceleme talebi", createdById: "owner-1", status: "PENDING_REVIEW", category: { isActive: true }, deletedAt: null, publishedAt: null, visibleToSuppliersAt: null, expiresAt: null, isModerationHidden: true, moderationHiddenAt: null, moderationHiddenById: null, moderationReason: null },
    item: { id: "case-1", subjectType: "REQUEST", subjectId: "request-1", category: "REQUEST_REVIEW", status: "OPEN", priority: "MEDIUM", targetUserId: "owner-1", targetUser: null, reporterId: null, reporter: null, assigneeId: null, assignee: null, createdAt: new Date(), updatedAt: new Date(), resolvedAt: null, internalNote: null, resolutionNote: null },
    notifications: [], audits: [],
  };
  const flags = { role: "ADMIN", mfa: true, failNotification: false, failAudit: false, failDistribution: false, distributions: 0, warnings: 0 };
  const pick = (row, select) => !select ? structuredClone(row) : Object.fromEntries(Object.keys(select).map(key => [key, structuredClone(row[key])]));
  const matches = (row, where) => Object.entries(where).every(([key, value]) => value === undefined || (value && typeof value === "object" && "in" in value ? value.in.includes(row[key]) : row[key] === value));
  const db = {
    request: {
      findFirst: async ({ where, select }) => matches(state.request, where) ? pick(state.request, select) : null,
      findMany: async ({ select }) => [pick(state.request, select)],
      updateMany: async ({ where, data }) => {
        if (!matches(state.request, where)) return { count: 0 };
        Object.assign(state.request, data); return { count: 1 };
      },
      update: async ({ data }) => { Object.assign(state.request, data); return state.request; },
    },
    moderationCase: {
      findUnique: async ({ where }) => where.id === state.item.id ? structuredClone(state.item) : null,
      findMany: async () => [structuredClone(state.item)],
      count: async () => 0,
      updateMany: async ({ where, data }) => {
        if (!matches(state.item, where)) return { count: 0 };
        Object.assign(state.item, data); return { count: 1 };
      },
      update: async ({ data }) => { Object.assign(state.item, data); return structuredClone(state.item); },
    },
    notification: { create: async ({ data }) => { if (flags.failNotification) throw new Error("notification failed"); state.notifications.push(data); return data; } },
    adminAuditLog: {
      create: async ({ data }) => { if (flags.failAudit) throw new Error("audit failed"); state.audits.push(data); return data; },
      findMany: async () => [],
    },
    user: { findMany: async () => [] }, offer: { findMany: async () => [] },
  };
  let tail = Promise.resolve();
  const prisma = { ...db, $transaction: async fn => {
    const before = tail;
    let release;
    tail = new Promise(resolve => { release = resolve; });
    await before;
    const snapshot = structuredClone(state);
    try { return await fn(db); } catch (error) { state = snapshot; throw error; } finally { release(); }
  } };
  const load = createLoader({
    "@/lib/prisma": { prisma },
    "@/lib/request-understanding/publish-disposition": { REQUEST_REVIEW_MODERATION_CATEGORY: "REQUEST_REVIEW" },
    "./distribute-request": { distributeRequestToCompanies: async () => {
      assert.equal(state.request.status, "PUBLISHED"); assert.equal(state.item.status, "RESOLVED");
      assert.equal(state.notifications.length, 1); assert.equal(state.audits.length, 1);
      flags.distributions++;
      if (flags.failDistribution) throw new Error("fanout failed");
      return { matchedCompanyCount: 2, notifiedUserCount: 2 };
    } },
    "@/lib/observability/logger": { createSubsystemLogger: () => ({ info() {}, warn() { flags.warnings++; } }) },
    "@/server/auth/require-platform-admin": { requirePlatformAdmin: async () => {
      if (!flags.mfa || !["ADMIN", "SUPER_ADMIN", "SUPPORT"].includes(flags.role)) { const error = new Error("Denied"); error.name = "PlatformAuthorizationError"; throw error; }
      return { id: "admin-1", platformRole: flags.role };
    } },
  });
  const service = load("src/server/request/review-hold-decision.ts");
  const route = load("src/app/api/admin/moderation/route.ts");
  const input = { requestId: "request-1", adminUserId: "admin-1", caseId: "case-1" };
  const patch = body => route.PATCH(new Request("http://localhost/api/admin/moderation", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: "case-1", ...body }) }));
  return { get state() { return state; }, flags, service, route, load, input, patch };
}

async function check(name, run) { await run(); passed++; console.log("PASS — " + name); }

async function main() {
  await check("Approval commits publication, expiry, case closure, audit and one owner notification before fanout", async () => {
    const h = harness(); const result = await h.service.approveHeldRequest(h.input);
    assert.equal(result.applied, true); assert.equal(h.state.request.status, "PUBLISHED");
    assert.equal(h.state.request.isModerationHidden, false); assert.ok(h.state.request.publishedAt instanceof Date);
    assert.ok(h.state.request.expiresAt > h.state.request.publishedAt); assert.equal(h.state.item.status, "RESOLVED");
    assert.equal(h.state.notifications.length, 1); assert.equal(h.state.audits.length, 1); assert.equal(h.flags.distributions, 1);
  });
  await check("Rejection stays invisible, closes its case and delivers the reason once", async () => {
    const h = harness(); await h.service.rejectHeldRequest({ ...h.input, reason: "Talep kapsamı uygun değil." });
    assert.equal(h.state.request.publishedAt, null); assert.equal(h.state.request.visibleToSuppliersAt, null); assert.equal(h.state.request.expiresAt, null);
    assert.equal(h.state.request.isModerationHidden, true); assert.equal(h.state.item.status, "RESOLVED");
    assert.match(h.state.notifications[0].message, /Talep kapsamı uygun değil/); assert.equal(h.flags.distributions, 0);
  });
  for (const first of ["approve", "reject"]) await check(`Repeated and opposite decisions after ${first} do not write or notify again`, async () => {
    const h = harness();
    if (first === "approve") await h.service.approveHeldRequest(h.input); else await h.service.rejectHeldRequest({ ...h.input, reason: "Uygun değil" });
    assert.equal((await h.service.approveHeldRequest(h.input)).applied, false);
    assert.equal((await h.service.rejectHeldRequest({ ...h.input, reason: "Uygun değil" })).applied, false);
    assert.equal(h.state.notifications.length, 1); assert.equal(h.state.audits.length, 1);
  });
  await check("Competing admins produce a single decision in the serialized transaction adapter", async () => {
    const h = harness(); const results = await Promise.all([h.service.approveHeldRequest(h.input), h.service.rejectHeldRequest({ ...h.input, adminUserId: "admin-2", reason: "Uygun değil" })]);
    assert.equal(results.filter(result => result.applied).length, 1); assert.equal(h.state.notifications.length, 1);
  });
  for (const failure of ["failNotification", "failAudit"]) await check(`${failure} rolls back request, case and all notifications`, async () => {
    const h = harness(); h.flags[failure] = true;
    await assert.rejects(h.service.approveHeldRequest(h.input));
    assert.equal(h.state.request.status, "PENDING_REVIEW"); assert.equal(h.state.item.status, "OPEN");
    assert.equal(h.state.notifications.length, 0); assert.equal(h.state.audits.length, 0); assert.equal(h.flags.distributions, 0);
  });
  await check("Fanout failure preserves the committed approval for backfill", async () => {
    const h = harness(); h.flags.failDistribution = true;
    assert.equal((await h.service.approveHeldRequest(h.input)).applied, true);
    assert.equal(h.state.request.status, "PUBLISHED"); assert.equal(h.flags.warnings, 1);
  });
  await check("Closed category prevents publication but permits rejection", async () => {
    const h = harness(); h.state.request.category.isActive = false;
    await assert.rejects(h.service.approveHeldRequest(h.input), error => error.status === 409);
    assert.equal(h.state.item.status, "OPEN");
    assert.equal((await h.service.rejectHeldRequest({ ...h.input, reason: "Kategori kapalı" })).applied, true);
  });
  for (const mismatch of ["closed", "other-subject"]) await check(`${mismatch} case cannot publish its request`, async () => {
    const h = harness(); if (mismatch === "closed") h.state.item.status = "RESOLVED"; else h.state.item.subjectId = "other";
    assert.equal((await h.service.approveHeldRequest(h.input)).applied, false); assert.equal(h.state.request.status, "PENDING_REVIEW");
  });
  for (const role of ["SUPPORT", "ANALYST", "USER"]) await check(`${role} cannot approve through HTTP`, async () => {
    const h = harness(); h.flags.role = role; const response = await h.patch({ reviewDecision: "APPROVE" });
    assert.equal(response.status, 403); assert.equal(h.state.request.status, "PENDING_REVIEW"); assert.equal(h.state.audits.length, 0);
  });
  await check("MFA denial stops the HTTP mutation", async () => { const h = harness(); h.flags.mfa = false; assert.equal((await h.patch({ reviewDecision: "APPROVE" })).status, 403); });
  await check("HTTP approval succeeds and a second submission returns a conflict", async () => {
    const h = harness(); assert.equal((await h.patch({ reviewDecision: "APPROVE" })).status, 200);
    assert.equal((await h.patch({ reviewDecision: "APPROVE" })).status, 409); assert.equal(h.state.notifications.length, 1);
  });
  await check("HTTP rejects an empty rejection reason", async () => { const h = harness(); assert.equal((await h.patch({ reviewDecision: "REJECT", resolutionNote: " " })).status, 400); assert.equal(h.state.item.status, "OPEN"); });
  await check("HTTP cannot close a pending case without a publication decision", async () => { const h = harness(); assert.equal((await h.patch({ status: "RESOLVED" })).status, 400); assert.equal(h.state.item.status, "OPEN"); });
  await check("HTTP reports storage failure as failure without a partial approval", async () => {
    const h = harness(); h.flags.failNotification = true; assert.equal((await h.patch({ reviewDecision: "APPROVE" })).status, 500);
    assert.equal(h.state.request.status, "PENDING_REVIEW"); assert.equal(h.state.item.status, "OPEN");
  });
  await check("Legacy restore of a held request uses the same atomic decision", async () => {
    const h = harness(); assert.equal((await h.patch({ enforcement: "RESTORE_CONTENT", resolutionNote: "Yayın uygun" })).status, 200); assert.equal(h.state.notifications.length, 1);
  });
  await check("Normal published content retains hide/restore behavior", async () => {
    const h = harness(); h.state.request.status = "PUBLISHED"; h.state.request.isModerationHidden = false; h.state.item.category = "COMPLAINT";
    assert.equal((await h.patch({ enforcement: "HIDE_CONTENT", resolutionNote: "İçerik uygun değil" })).status, 200);
    assert.equal(h.state.request.isModerationHidden, true); assert.equal(h.flags.distributions, 0);
  });
  await check("GET exposes request state and title for the dedicated review queue", async () => {
    const h = harness(); const response = await h.route.GET(new Request("http://localhost/api/admin/moderation"));
    assert.equal(response.status, 200); const value = await response.json();
    assert.equal(value.items[0].contentModeration.status, "PENDING_REVIEW"); assert.equal(value.items[0].contentModeration.title, h.state.request.title);
  });
  await check("Queue hides completed/rejected requests and published content", async () => {
    const h = harness(); const { isPendingReviewCase } = h.load("src/lib/request/review-hold.ts");
    const item = { ...h.state.item, contentModeration: h.state.request }; assert.equal(isPendingReviewCase(item), true);
    assert.equal(isPendingReviewCase({ ...item, status: "RESOLVED" }), false);
    assert.equal(isPendingReviewCase({ ...item, contentModeration: { ...h.state.request, moderationHiddenById: "admin-1" } }), false);
    assert.equal(isPendingReviewCase({ ...item, contentModeration: { status: "PUBLISHED" } }), false);
  });
  await check("Unknown billing drift is not rendered as zero or healthy", async () => {
    const h = harness(); const { healthMetricDisplay, healthMetricSummary } = h.load("src/lib/admin-health-presentation.ts");
    assert.equal(healthMetricDisplay("billingDrift", -1), "Ölçülemedi");
    assert.equal(healthMetricSummary({ billingDrift: -1, billingDriftScanned: -1 }).unknown.length, 2);
    assert.equal(healthMetricSummary({ zeroReach: 2, billingDrift: 1, billingDriftTruncated: 1 }).alerts.length, 3);
    assert.equal(healthMetricDisplay("billingDriftTruncated", 1), "Sınıra ulaşıldı");
    assert.equal(healthMetricDisplay("billingDriftTruncated", -1), "Ölçülemedi");
  });
  console.log(`\n${passed} passed, 0 failed; isolated transactions, no external database or notifications.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
