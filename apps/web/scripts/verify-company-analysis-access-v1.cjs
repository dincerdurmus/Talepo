/* eslint-disable @typescript-eslint/no-require-imports -- Database-free CommonJS verification runner. */
const assert = require("node:assert/strict");
const { createLoader } = require("./lib/isolated-typescript-loader.cjs");
let passed = 0;
async function check(name, run) {
  try { await run(); passed++; console.log("PASS — " + name); }
  catch (error) { console.error("FAIL — " + name); throw error; }
}

let selected = "firm", actor = "analyst", role = "VIEWER", writes = 0;
const company = { id: "firm", name: "Test firm", planTier: "STANDARD", planExpiresAt: null, bonusOfferCredits: 0 };
const user = { id: actor, planTier: "PROFESSIONAL", planExpiresAt: null, bonusOfferCredits: 0 };
let offer = {
  id: "offer", requestId: "request", submittedById: "analyst", companyId: "firm",
  amount: { toString: () => "1000" }, currency: "TRY", status: "SUBMITTED",
  createdAt: new Date(), mediaFinalizedAt: null,
  request: { id: "request", createdById: "buyer", companyId: null, title: "Test request", status: "PUBLISHED", deletedAt: null },
};
const write = () => { writes++; throw new Error("Unexpected database mutation."); };
const prisma = {
  user: { findUnique: async () => ({ ...user, id: actor }) },
  company: { findUnique: async () => company },
  companyAddonEntitlement: { findUnique: async () => null },
  companyMember: {
    findFirst: async ({ where }) => {
      if (where.role === "OWNER") return { user };
      return { role, company };
    },
  },
  request: {
    findFirst: async () => ({ id: "request", createdById: actor, companyId: "firm", status: "PUBLISHED" }),
    update: write,
  },
  offer: {
    count: async () => 0,
    findFirst: async ({ where }) => where.status === "ACCEPTED" ? null : offer,
    update: write,
    updateMany: write,
    create: write,
  },
  conversationParticipant: { findFirst: async () => ({ conversation: { offer: { ...offer, status: "ACCEPTED" }, participants: [] } }) },
  $transaction: async (run) => run(prisma),
};
const load = createLoader({
  "next/headers": { cookies: async () => ({ get: () => selected ? { value: selected } : undefined }) },
  "@/lib/prisma": { prisma },
  "@/server/request/distribute-request": { distributeRequestToCompanies: write },
  "@/server/price-intelligence/record-observation": {},
});
const access = load("src/server/company/company-write-access.ts");
const entitlements = load("src/lib/membership/resolve-entitlements.ts");
const offers = load("src/server/offer/offer-service.ts");
const negotiation = load("src/server/offer/offer-negotiation-service.ts");
const media = load("src/server/offer/offer-media-service.ts");
const messages = load("src/server/message/conversation-access.ts");
const requests = load("src/server/request/create-request.ts");
const updateRequest = load("src/server/request/update-request.ts");
const deleteRequest = load("src/server/request/delete-request.ts");
const readonlyError = (e) => e.code === "COMPANY_READ_ONLY" && e.status === 403;

async function main() {
  for (const [name, run] of [
    ["request creation", () => requests.createRequest(actor, {})],
    ["request editing", () => updateRequest.updateRequest(actor, "request", {})],
    ["request deletion", () => deleteRequest.deleteRequest(actor, "request")],
    ["offer creation", () => offers.createOffer(actor, {})],
    ["offer editing", () => offers.updateOffer(actor, "offer", {})],
    ["offer acceptance", () => offers.acceptOffer(actor, "offer")],
    ["offer rejection", () => offers.rejectOffer(actor, "offer")],
    ["counter offer", () => negotiation.proposeOfferNegotiation(actor, "offer", 1100)],
    ["counter acceptance", () => negotiation.acceptPendingNegotiation(actor, "offer")],
    ["counter rejection", () => negotiation.rejectPendingNegotiation(actor, "offer")],
    ["message send", () => messages.getSendableConversation(actor, "conversation")],
    ["photo attachment", () => media.attachOfferMedia(actor, "offer", { bytes: Buffer.alloc(0) })],
    ["photo finalization", () => media.finalizeOfferMedia(actor, "offer")],
  ]) {
    await check("Analysis blocked: " + name, () => assert.rejects(run(), readonlyError));
  }
  selected = "__personal__";
  for (const [name, run] of [
    ["company request editing", () => updateRequest.updateRequest(actor, "request", {})],
    ["company request deletion", () => deleteRequest.deleteRequest(actor, "request")],
    ["original submitter's counter offer", () => negotiation.proposeOfferNegotiation(actor, "offer", 1100)],
    ["original submitter's message", () => messages.getSendableConversation(actor, "conversation")],
    ["original submitter's offer photo", () => media.attachOfferMedia(actor, "offer", { bytes: Buffer.alloc(0) })],
  ]) {
    await check("Personal switch cannot bypass: " + name, () => assert.rejects(run(), readonlyError));
  }
  await check("Former buyer cannot modify their company deal after becoming an analyst", async () => {
    actor = "buyer";
    offer.request.companyId = "firm";
    await assert.rejects(offers.acceptOffer(actor, "offer"), readonlyError);
    await assert.rejects(offers.rejectOffer(actor, "offer"), readonlyError);
  });
  await check("Blocked attempts never reach business writes", () => assert.equal(writes, 0));

  selected = "firm";
  for (const operatingRole of ["OWNER", "ADMIN", "MANAGER", "MEMBER"]) {
    await check(operatingRole + " retains operating authority and inherited Professional features", async () => {
      role = operatingRole;
      await access.assertSelectedCompanyWriteAccess(actor);
      const ctx = await entitlements.resolveEntitlements(actor, { companyId: "firm" });
      assert.equal(ctx.companyRole, operatingRole === "OWNER" ? "OWNER" : "MEMBER");
      assert.equal(ctx.effectivePlanTier, "PROFESSIONAL");
      assert.equal(ctx.quota.isUnlimited, true);
      assert.equal(ctx.features.professional_analytics, true);
    });
  }
  await check("Analysis retains company analytics and offer intelligence", async () => {
    role = "VIEWER";
    const ctx = await entitlements.resolveEntitlements(actor, { companyId: "firm" });
    assert.equal(ctx.companyRole, "VIEWER");
    assert.equal(ctx.subject.id, "firm");
    assert.equal(ctx.features.professional_analytics, true);
    assert.equal(ctx.features.basic_market_insights, true);
    assert.equal(ctx.features.talepo_radar, true);
    await assert.rejects(access.assertSelectedCompanyWriteAccess(actor), readonlyError);
  });
  await check("Personal operations do not inherit the firm's read-only restriction", async () => {
    selected = "__personal__";
    await access.assertSelectedCompanyWriteAccess(actor);
    await assert.rejects(offers.createOffer(actor, { requestId: "request", description: "", amount: 0 }), (e) => e.name === "OfferValidationError");
  });
  console.log("\n" + passed + " passed, 0 failed; " + writes + " database writes.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
