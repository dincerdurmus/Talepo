/* eslint-disable @typescript-eslint/no-require-imports -- Database-free CommonJS verification runner. */
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { createLoader } = require("./lib/isolated-typescript-loader.cjs");
let passed = 0;
async function check(name, run) {
  try { await run(); passed++; console.log("PASS — " + name); }
  catch (error) { console.error("FAIL — " + name); throw error; }
}
const company = { id: "c", name: "Test firm", status: "ACTIVE", deletedAt: null, planTier: "STANDARD", planExpiresAt: null };
const owner = { planTier: "PROFESSIONAL", planExpiresAt: null };
let people = [{ id: "owner", userId: "owner", role: "OWNER", status: "ACTIVE" }];
let locked = false;
let tail = Promise.resolve();
function hydrated(p) { return { ...p, company, user: { id: p.userId, name: p.userId, email: p.userId + "@example.test" } }; }
const prisma = {
  $queryRaw: async () => { locked = true; return [{ id: "c" }]; },
  $transaction: (run) => {
    const operation = tail.then(async () => {
      const before = structuredClone(people);
      locked = false;
      try { return await run(prisma); } catch (error) { people = before; throw error; }
      finally { locked = false; }
    });
    tail = operation.catch(() => {});
    return operation;
  },
  company: { findUnique: async () => company },
  companyMember: {
    count: async ({ where }) => {
      assert.equal(locked, true, "Seat activation must acquire the company's database row lock.");
      return people.filter((p) => p.status === where.status && (!where.role || p.role === where.role)).length;
    },
    findUnique: async ({ where }) => {
      const p = people.find((p) => p.userId === where.companyId_userId.userId);
      return p ? hydrated(p) : null;
    },
    findFirst: async () => ({ user: owner }),
    findMany: async () => [],
    update: async ({ where, data }) => {
      assert.equal(locked, true);
      const person = people.find((p) => p.id === where.id);
      Object.assign(person, data);
      return hydrated(person);
    },
  },
  notification: { updateMany: async () => ({ count: 0 }) },
};
const loader = createLoader({
  "@/lib/prisma": { prisma },
  "./company-addon-entitlement": { getCompanyAddonSnapshot: async () => ({ extraSeatsActiveCount: 0, extraSeatsExpiresAt: null }) },
  "@/server/notifications/create-notification": { createNotification: async () => {} },
});
const { acceptCompanyInvite } = loader("src/server/company/respond-invite.ts");

async function main() {
  await check("Concurrent acceptance: owner + exactly 3 operators + 1 analyst", async () => {
    const invitations = Array.from({ length: 8 }, (_, i) => ({
      id: "op-" + i, userId: "op-" + i, role: "MEMBER", status: "INVITED",
    })).concat(Array.from({ length: 5 }, (_, i) => ({
      id: "analyst-" + i, userId: "analyst-" + i, role: "VIEWER", status: "INVITED",
    })));
    people.push(...invitations);
    const result = await Promise.allSettled(invitations.map((p) => acceptCompanyInvite(p.userId, "c")));
    assert.equal(result.filter((r) => r.status === "fulfilled").length, 4);
    assert.equal(people.filter((p) => p.status === "ACTIVE" && p.role === "OWNER").length, 1);
    assert.equal(people.filter((p) => p.status === "ACTIVE" && p.role === "MEMBER").length, 3);
    assert.equal(people.filter((p) => p.status === "ACTIVE" && p.role === "VIEWER").length, 1);
    assert.ok(result.filter((r) => r.status === "rejected").every((r) => r.reason.code === "SEAT_LIMIT_REACHED"));
  });
  await check("Replaying an accepted invitation is idempotent", async () => {
    const active = people.find((p) => p.role === "MEMBER" && p.status === "ACTIVE");
    const result = await acceptCompanyInvite(active.userId, "c");
    assert.equal(result.alreadyActive, true);
    assert.equal(people.filter((p) => p.status === "ACTIVE").length, 5);
  });
  await check("A removed analyst releases only the reserved analysis position", async () => {
    people.find((p) => p.role === "VIEWER" && p.status === "ACTIVE").status = "REMOVED";
    const pendingOp = people.find((p) => p.role === "MEMBER" && p.status === "INVITED");
    await assert.rejects(acceptCompanyInvite(pendingOp.userId, "c"), (e) => e.code === "SEAT_LIMIT_REACHED");
    const pendingAnalyst = people.find((p) => p.role === "VIEWER" && p.status === "INVITED");
    await acceptCompanyInvite(pendingAnalyst.userId, "c");
    assert.equal(people.filter((p) => p.status === "ACTIVE").length, 5);
  });
  await check("An unrelated user cannot accept an invitation", () => assert.rejects(acceptCompanyInvite("stranger", "c")));

  await check("Concurrent owner activations permit exactly one owner", async () => {
    people = Array.from({ length: 3 }, (_, i) => ({ id: "owner-" + i, userId: "owner-" + i, role: "OWNER", status: "INVITED" }));
    const result = await Promise.allSettled(people.map((p) => acceptCompanyInvite(p.userId, "c")));
    assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(people.filter((p) => p.role === "OWNER" && p.status === "ACTIVE").length, 1);
    assert.ok(result.filter((r) => r.status === "rejected").every((r) => r.reason.code === "SEAT_LIMIT_REACHED"));
  });
  for (const legacyRole of ["ADMIN", "MANAGER"]) {
    await check("Pending " + legacyRole + " invitations activate as MEMBER", async () => {
      people.push({ id: legacyRole, userId: legacyRole, role: legacyRole, status: "INVITED" });
      const result = await acceptCompanyInvite(legacyRole, "c");
      assert.equal(result.membership.role, "MEMBER");
      assert.equal(people.find((p) => p.id === legacyRole).role, "MEMBER");
    });
  }

  const ui = createLoader({
    "next/navigation": { useRouter: () => ({ refresh() {}, push() {} }), usePathname: () => "/panel", useSearchParams: () => new URLSearchParams() },
  });
  const scope = ui("src/components/panel/CompanyWriteScope.tsx").CompanyWriteScope;
  const render = (component, props, canWrite) => renderToStaticMarkup(
    React.createElement(scope, { canWrite }, React.createElement(component, props)),
  );
  await check("Analyst sees explanation instead of offer-send controls", () => {
    const cta = ui("src/components/panel/OfferSendCta.tsx").OfferSendCta;
    const html = render(cta, { href: "/panel/talepler/r/teklif" }, false);
    assert.ok(html.includes("Analist koltuğu"));
    assert.ok(!html.includes("<button"));
    assert.ok(render(cta, { href: "/panel/talepler/r/teklif" }, true).includes("Bu talebe teklif ver"));
  });
  await check("Analyst can read a conversation without seeing a message form", () => {
    const composer = ui("src/components/panel/MessageComposer.tsx").MessageComposer;
    const html = render(composer, { conversationId: "c", canSend: true, canSendImages: true }, false);
    assert.ok(html.includes("Analist koltuğu"));
    assert.ok(!html.includes("<form"));
  });
  await check("Analyst cannot archive or restore shared offers", () => {
    const archive = ui("src/components/panel/OfferArchiveActions.tsx").OfferArchiveActions;
    assert.equal(render(archive, { offerId: "o", role: "seller", canArchive: true, isArchived: false }, false), "");
    assert.equal(render(archive, { offerId: "o", role: "seller", canArchive: false, isArchived: true }, false), "");
  });
  await check("Team screen explains the reserved analysis seat and disables a fifth operator", () => {
    const team = ui("src/components/panel/TeamManager.tsx").TeamManager;
    const initialMembers = ["OWNER", "MEMBER", "MEMBER", "MEMBER"].map((role, i) => ({
      id: String(i), role, status: "ACTIVE", invitedAt: new Date(), joinedAt: new Date(),
      user: { id: String(i), name: role, email: null, image: null },
    }));
    const html = render(team, {
      companyName: "Test firm", initialMembers, currentUserId: "0", currentUserRole: "OWNER",
      canInvite: true, canRemove: true, canViewOffers: true,
      seatUsage: { activeSeats: 4, includedSeats: 5, memberLimit: 3, analysisLimit: 1 },
    }, true);
    assert.ok(html.includes("1 sahip (Owner) + 3 üye + 1 salt okunur analist koltuğu"));
    assert.ok(html.includes("Analist · salt okunur"));
    assert.ok(!html.includes('value="ADMIN"'));
    assert.ok(!html.includes('value="MANAGER"'));
    assert.ok(!html.includes('value="OWNER"'));
    assert.match(html, /type="submit" disabled=""/);
    assert.ok(html.includes("Sahip ve analist koltukları ek üye için kullanılamaz"));
  });
  await check("Members, analysts and legacy managers never see invite or removal controls", () => {
    const team = ui("src/components/panel/TeamManager.tsx").TeamManager;
    for (const currentUserRole of ["MEMBER", "VIEWER", "ADMIN", "MANAGER"]) {
      const html = render(team, {
        companyName: "Test", initialMembers: [{ id: "m", role: "MEMBER", status: "ACTIVE", user: { id: "someone", name: "Someone", email: null, image: null } }],
        currentUserId: "actor", currentUserRole, canInvite: true, canRemove: true, canViewOffers: false,
      }, true);
      assert.ok(!html.includes("<form"));
      assert.ok(!html.includes("Üyeyi çıkart"));
    }
  });
  console.log("\n" + passed + " passed, 0 failed; isolated records only.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
