/* eslint-disable @typescript-eslint/no-require-imports -- Database-free CommonJS verification runner. */
const assert = require("node:assert/strict");
const { createLoader } = require("./lib/isolated-typescript-loader.cjs");
let actorRole = "OWNER", owners = 1, members = 3, analysis = 0, created = 0, removed = 0, passed = 0;
let targetRole = "MEMBER";
const company = { id: "firm", name: "Test", planTier: "PROFESSIONAL", planExpiresAt: null };
const prisma = {
  company: { findUnique: async () => company },
  companyMember: {
    count: async ({ where }) => where.role === "VIEWER" ? analysis : where.role === "OWNER" ? owners : owners + members + analysis,
    findFirst: async ({ where }) => where.id
      ? { id: "target", userId: "invitee", role: targetRole, status: "ACTIVE", user: { name: "Invitee" } }
      : where.role === "OWNER" ? { user: { planTier: "PROFESSIONAL", planExpiresAt: null } } : { role: actorRole, company },
    findUnique: async () => null,
    findMany: async () => ["OWNER", "ADMIN", "MANAGER", "MEMBER", "VIEWER"].map((role, i) => ({ id: String(i), userId: String(i), role })),
    create: async ({ data }) => { created++; return { id: "invitation", ...data }; },
    update: async ({ data }) => { assert.equal(data.status, "REMOVED"); removed++; return { id: "target", ...data }; },
  },
  offer: { findMany: async () => [] },
  user: { findFirst: async () => ({ id: "invitee", name: "Invitee", email: "invitee@example.test" }) },
  notification: { create: async () => ({ id: "notification" }) },
};
const load = createLoader({
  "@/lib/prisma": { prisma },
  "@/server/auth/require-user": { requireUser: async () => ({ id: "actor" }), AuthenticationError: class AuthenticationError extends Error {} },
  "@/lib/membership/require-company-feature": { requireCompanyFeature: async () => ({ companyId: "firm", companyName: "Test" }) },
  "./company-addon-entitlement": { getCompanyAddonSnapshot: async () => ({ extraSeatsActiveCount: 0, extraSeatsExpiresAt: null }) },
});
const { POST, DELETE, GET } = load("src/app/api/company/team/route.ts");
const { GET: GET_INVITES } = load("src/app/api/company/invites/route.ts");
async function check(name, run) {
  await run(); passed++; console.log("PASS — " + name);
}
async function invite(name, role, expected) {
  await check(name, async () => {
    const before = created;
    const response = await POST(new Request("http://localhost/api/company/team", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite: "invitee@example.test", role }),
    }));
    const body = await response.json();
    assert.equal(response.status, expected, JSON.stringify(body));
    assert.equal(created - before, expected === 200 ? 1 : 0);
    if (expected === 200) assert.equal(body.member.role, role ?? "MEMBER");
  });
}
async function remove(name, expected) {
  await check(name, async () => {
    const before = removed;
    const response = await DELETE(new Request("http://localhost/api/company/team", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: "target" }),
    }));
    assert.equal(response.status, expected, JSON.stringify(await response.json()));
    assert.equal(removed - before, expected === 200 ? 1 : 0);
  });
}
async function main() {
  await invite("Fourth member blocked with analyst seat vacant", "MEMBER", 403);
  await invite("Reserved analyst invitation still allowed", "VIEWER", 200);
  analysis = 1;
  await invite("Second analyst invitation blocked", "VIEWER", 403);
  members = 2;
  await invite("Third member slot remains available with analyst present", "MEMBER", 200);
  await invite("Omitted role defaults to MEMBER", undefined, 200);
  for (const invalid of ["OWNER", "ADMIN", "MANAGER", "SUPER_ADMIN", "", "viewer", ["VIEWER"], { role: "VIEWER" }]) {
    await invite("Untrusted or removed role rejected: " + JSON.stringify(invalid), invalid, 400);
  }
  for (const role of ["MEMBER", "VIEWER", "ADMIN", "MANAGER"]) {
    actorRole = role;
    await invite(role + " cannot invite accounts", "MEMBER", 403);
    await remove(role + " cannot remove accounts", 403);
    await check(role + " receives canonical role labels and owner-only management flags", async () => {
      const response = await GET();
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.canRemove, false);
      assert.equal(body.canViewOffers, role === "VIEWER");
      assert.deepEqual(body.members.map((m) => m.role), ["OWNER", "MEMBER", "MEMBER", "MEMBER", "VIEWER"]);
    });
  }
  actorRole = "OWNER";
  await remove("Owner can remove a member", 200);
  targetRole = "VIEWER";
  await remove("Owner can remove an analyst", 200);
  targetRole = "OWNER";
  await remove("Owner cannot remove another stored owner", 400);
  owners = 0; members = 3; analysis = 0;
  await invite("Missing owner is not a spare member slot", "MEMBER", 403);
  await check("Pending invitation responses use canonical roles", async () => {
    const response = await GET_INVITES();
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.invites.map((invite) => invite.role), ["OWNER", "MEMBER", "MEMBER", "MEMBER", "VIEWER"]);
  });
  console.log("\n" + passed + " passed, 0 failed; in-memory invitations only.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
