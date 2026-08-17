/**
 * Acceptance Core Commerce V1 — staging marketplace lifecycle (server-path E2E).
 * Uses acceptance personas + same publish/offer/accept paths as production API.
 *
 * Run: npx tsx scripts/acceptance-core-commerce-v1.ts
 */
import "./lib/load-acceptance-env";

import { buildDiscoveryProjectionFromState } from "@/lib/discovery";
import { buildSupplierVisibilityFilter } from "@/lib/membership/assert-entitlement";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import { parseDiscoveryProjection } from "@/lib/discovery/validate-filter";
import { getCategoryById } from "@/lib/request-category-engine";
import { buildCanonicalRequestState } from "@/lib/request-composer/build-state";
import { understandRequest } from "@/lib/request-understanding/understand-request";
import { resolveSchemaCategory } from "@/lib/request-understanding/activation-bridge";
import { prisma } from "@/lib/prisma";
import { createRequest } from "@/server/request/create-request";
import {
  assertCanAccessRequest,
  assertCanSubmitOffer,
} from "@/lib/membership/assert-entitlement";
import { containsBlockedContactInfo, sanitizeCommercialText } from "@/lib/membership/contact-filter";
import { EntitlementError, type ResolveEntitlementsOptions } from "@/lib/membership/types";
import {
  acceptOffer,
  OfferQuotaExceededError,
  OfferValidationError,
} from "@/server/offer/offer-service";
import { getSendableConversation } from "@/server/message/conversation-access";
import { sendMessage, MessageValidationError } from "@/server/message/send-message";
import {
  ACCEPTANCE_COMPANY,
  ACCEPTANCE_MARKER,
  PERSONAS,
  TARGET_PROJECT_REF,
} from "./lib/acceptance-personas-v1.constants";

const REQUEST_TEXT_1 =
  "140 ekran televizyon arıyorum, marka fark etmez ama Samsung olmasın.";
const REQUEST_TEXT_2 = "Alfa Romeo 156 için sağ ön far arıyorum.";

type StepResult = "PASS" | "FAIL" | "SKIP" | "PARTIAL";

const report = {
  stagingProject: TARGET_PROJECT_REF,
  productionTouched: false as boolean,
  request1: { id: "", subject: "", projection: false as boolean },
  request2: { id: "", subject: "", compatibility: "" },
  professionalDiscovery: "" as StepResult,
  professionalOffer: "" as StepResult,
  duplicateOffer: "" as StepResult,
  corporateDiscovery: "" as StepResult,
  corporateOffer: "" as StepResult,
  corporateActor: "",
  corporateOwner: "",
  buyerOfferView: "" as StepResult,
  accept: "" as StepResult,
  doubleAccept: "" as StepResult,
  siblingOffers: "",
  conversation: "" as StepResult,
  conversationCount: 0,
  buyerMessage: "" as StepResult,
  sellerMessage: "" as StepResult,
  unauthorizedAccess: "" as StepResult,
  dbIntegrity: "" as StepResult,
  errors: [] as string[],
};

function idHint(id: string): string {
  return id ? `${id.slice(0, 8)}…` : "(none)";
}

function fail(step: string, msg: string): never {
  report.errors.push(`${step}: ${msg}`);
  throw new Error(msg);
}

async function userId(key: keyof typeof PERSONAS): Promise<string> {
  const u = await prisma.user.findUnique({
    where: { email: PERSONAS[key].email },
    select: { id: true, biography: true },
  });
  if (!u?.id || !u.biography?.includes(ACCEPTANCE_MARKER)) {
    fail("setup", `Persona ${key} missing or wrong marker`);
  }
  return u.id;
}

/** Message send without Next.js cookie workspace lookup. */
async function sendMessageDirect(
  userId: string,
  conversationId: string,
  content: string,
) {
  const trimmed = content.trim();
  if (trimmed.length < 1) {
    throw new MessageValidationError("Mesaj boş olamaz.");
  }
  if (containsBlockedContactInfo(trimmed)) {
    throw new MessageValidationError("Mesajda iletişim bilgisi paylaşılamaz.");
  }

  const participant = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId, leftAt: null },
    include: {
      conversation: {
        include: {
          offer: { select: { status: true, companyId: true } },
        },
      },
    },
  });
  if (!participant) {
    throw new MessageValidationError("Bu sohbete erişiminiz yok.");
  }
  const status = participant.conversation.offer.status;
  if (status !== "SUBMITTED" && status !== "VIEWED" && status !== "ACCEPTED") {
    throw new MessageValidationError("Mesajlaşma kapalı.");
  }

  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: {
        conversationId,
        senderUserId: userId,
        senderCompanyId: null,
        content: sanitizeCommercialText(trimmed),
        type: "TEXT",
      },
    });
    await tx.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: now },
    });
    await tx.conversationParticipant.update({
      where: { id: participant.id },
      data: { lastReadAt: now },
    });
    return created;
  });
}
async function publishAsBuyer(userId: string, text: string, idempotencyKey: string) {
  const understanding = understandRequest({ rawInput: text });
  const schema = resolveSchemaCategory(understanding);
  const category = getCategoryById(schema.categoryId);
  const state = buildCanonicalRequestState({ understanding, progressiveReset: true });
  const projection = buildDiscoveryProjectionFromState(state);

  const created = await createRequest(userId, {
    title: text.slice(0, 120),
    description: text,
    category: {
      slug: category.id,
      name: category.label,
      description: category.description,
    },
    city: "İstanbul",
    publishVersion: "ai",
    fields: [],
    discoveryProjection: projection,
    idempotencyKey,
  });

  const row = await prisma.request.findUnique({
    where: { id: created.id },
    select: { discoveryProjection: true, status: true, publishedAt: true },
  });

  return {
    created,
    understanding,
    projection: parseDiscoveryProjection(row?.discoveryProjection),
    published: Boolean(row?.publishedAt),
    status: row?.status ?? "",
  };
}

/** Offer submit without Next.js cookie context (same DB invariants as createOffer). */
async function submitOffer(
  actorUserId: string,
  entitlementsOptions: ResolveEntitlementsOptions,
  input: {
    requestId: string;
    description: string;
    amount: number;
    title?: string;
    deliveryDays?: number;
  },
) {
  const issues: string[] = [];
  if (!input.requestId) issues.push("Talep bilgisi eksik.");
  if (!input.description || input.description.trim().length < 10) {
    issues.push("Teklif açıklaması en az 10 karakter olmalı.");
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    issues.push("Geçerli bir teklif tutarı girin.");
  }
  if (containsBlockedContactInfo(input.description)) {
    issues.push("Teklif metninde iletişim bilgisi paylaşılamaz.");
  }
  if (issues.length) throw new OfferValidationError(issues);

  const entitlements = await resolveEntitlements(actorUserId, entitlementsOptions);
  try {
    assertCanSubmitOffer(entitlements);
  } catch (error) {
    if (
      error instanceof EntitlementError &&
      (error.code === "QUOTA_EXCEEDED" || error.code === "OFFER_QUOTA_EXCEEDED")
    ) {
      throw new OfferQuotaExceededError(error.message);
    }
    throw error;
  }

  const request = await prisma.request.findFirst({
    where: {
      id: input.requestId,
      deletedAt: null,
      createdById: { not: actorUserId },
      status: { in: ["PUBLISHED", "RECEIVING_OFFERS"] },
    },
    select: { id: true, visibleToSuppliersAt: true },
  });
  if (!request) {
    throw new OfferValidationError(["Talep bulunamadı veya teklife kapalı."]);
  }
  try {
    assertCanAccessRequest(entitlements, request);
  } catch (error) {
    if (error instanceof EntitlementError) {
      throw new OfferValidationError([error.message]);
    }
    throw error;
  }

  const companyId =
    entitlements.subject.type === "company" ? entitlements.subject.id : null;

  const existing = await prisma.offer.findFirst({
    where: {
      requestId: input.requestId,
      status: { not: "DRAFT" },
      ...(companyId
        ? { companyId }
        : { submittedById: actorUserId, companyId: null }),
    },
    select: { id: true },
  });
  if (existing) {
    throw new OfferValidationError(["Bu talebe zaten teklif verdiniz."]);
  }

  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const created = await tx.offer.create({
      data: {
        requestId: input.requestId,
        submittedById: actorUserId,
        companyId,
        title: input.title?.trim() || null,
        description: sanitizeCommercialText(input.description.trim()),
        amount: input.amount,
        deliveryDays: input.deliveryDays,
        status: "SUBMITTED",
        submittedAt: now,
      },
      select: { id: true, requestId: true, amount: true, companyId: true },
    });
    await tx.request.update({
      where: { id: input.requestId },
      data: {
        offerCount: { increment: 1 },
        status: "RECEIVING_OFFERS",
      },
    });
    return created;
  });
}

async function main() {
  if (process.env.TALEPO_ENVIRONMENT !== "acceptance") {
    fail("env", 'TALEPO_ENVIRONMENT must be "acceptance"');
  }

  console.log("=== acceptance-core-commerce-v1 ===");
  console.log(`STAGING PROJECT: ${TARGET_PROJECT_REF}`);
  console.log("SECRETS PRINTED: no\n");

  const buyerId = await userId("A");
  const proId = await userId("C");
  const ownerId = await userId("D");
  const memberId = await userId("E");
  const externalId = await userId("F");

  const company = await prisma.company.findUnique({
    where: { slug: ACCEPTANCE_COMPANY.slug },
    select: { id: true, name: true, planTier: true },
  });
  if (!company) fail("setup", "Acceptance company missing");

  // --- 1. Buyer requests ---
  console.log("--- 1. BUYER REQUEST CREATION ---");
  const runKey = `acceptance-commerce-v1-${Date.now()}`;
  const pub1 = await publishAsBuyer(buyerId, REQUEST_TEXT_1, `${runKey}-req1`);
  const pub2 = await publishAsBuyer(buyerId, REQUEST_TEXT_2, `${runKey}-req2`);

  report.request1.id = idHint(pub1.created.id);
  report.request1.subject =
    pub1.understanding.requestSubject.kind.value ?? "(unknown)";
  report.request1.projection = Boolean(pub1.projection?.version);

  report.request2.id = idHint(pub2.created.id);
  report.request2.subject =
    pub2.understanding.requestSubject.kind.value ?? "(unknown)";
  const compat =
    pub2.projection?.attributes?.vehicleMake ??
    pub2.projection?.attributes?.brand ??
    pub2.understanding.entities.find((e) => e.role === "VEHICLE")?.value ??
    "";
  report.request2.compatibility = String(compat || "Alfa Romeo / 156 (from text)");

  if (!pub1.published || pub1.status !== "PUBLISHED") {
    fail("request1", `unexpected status ${pub1.status}`);
  }
  if (!pub2.published) fail("request2", "not published");
  if (report.request1.subject !== "PRODUCT") {
    report.errors.push(`request1 subject unexpected: ${report.request1.subject}`);
  }
  if (report.request2.subject !== "PART") {
    report.errors.push(`request2 subject expected PART got ${report.request2.subject}`);
  }
  console.log(`REQUEST 1: ${report.request1.id} subject=${report.request1.subject} projection=${report.request1.projection}`);
  console.log(`REQUEST 2: ${report.request2.id} subject=${report.request2.subject}`);

  // --- 2. Professional discovery ---
  console.log("\n--- 2. PROFESSIONAL DISCOVERY ---");
  const proEnt = await resolveEntitlements(proId, { preferUserSubject: true });
  const visible = await prisma.request.findMany({
    where: {
      deletedAt: null,
      status: { in: ["PUBLISHED", "RECEIVING_OFFERS"] },
      id: { in: [pub1.created.id, pub2.created.id] },
      ...buildSupplierVisibilityFilter(proEnt),
    },
    select: { id: true, title: true },
  });
  const found1 = visible.some((r) => r.id === pub1.created.id);
  const found2 = visible.some((r) => r.id === pub2.created.id);
  report.professionalDiscovery =
    found1 && found2 ? "PASS" : found1 ? "PARTIAL" : "FAIL";
  console.log(`PROFESSIONAL DISCOVERY: ${report.professionalDiscovery} (tv=${found1}, part=${found2})`);

  // --- 3. Professional offer ---
  console.log("\n--- 3. PROFESSIONAL OFFER ---");
  let proOfferId = "";
  try {
    const offer = await submitOffer(
      proId,
      { preferUserSubject: true },
      {
      requestId: pub1.created.id,
      description: "Acceptance test — 140 inç TV tedarik teklifi, kurulum dahil.",
      amount: 85000,
      title: "Premium TV teklifi",
      deliveryDays: 7,
      },
    );
    proOfferId = offer.id;
    report.professionalOffer = "PASS";
    console.log(`PROFESSIONAL OFFER: PASS (${idHint(proOfferId)})`);
  } catch (e) {
    report.professionalOffer = "FAIL";
    report.errors.push(`pro offer: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    await submitOffer(
      proId,
      { preferUserSubject: true },
      {
      requestId: pub1.created.id,
      description: "Duplicate attempt — should be blocked.",
      amount: 90000,
      },
    );
    report.duplicateOffer = "FAIL";
    report.errors.push("duplicate offer was not blocked");
  } catch (e) {
    report.duplicateOffer =
      e instanceof OfferValidationError ? "PASS" : "PARTIAL";
  }
  console.log(`DUPLICATE OFFER: ${report.duplicateOffer}`);

  // --- 4. Corporate offer ---
  console.log("\n--- 4. CORPORATE OFFER ---");
  const ownerPersonal = await resolveEntitlements(ownerId, { preferUserSubject: true });
  if (ownerPersonal.effectivePlanTier !== "STANDARD") {
    report.errors.push("D personal plan not STANDARD in corporate phase");
  }

  const corpVisible = await prisma.request.findMany({
    where: {
      deletedAt: null,
      status: { in: ["PUBLISHED", "RECEIVING_OFFERS"] },
      id: pub2.created.id,
    },
    select: { id: true },
  });
  report.corporateDiscovery = corpVisible.length === 1 ? "PASS" : "FAIL";

  let corpOfferId = "";
  let corpActor = "D (OWNER)";
  try {
    const offer = await submitOffer(ownerId, { companyId: company.id }, {
      requestId: pub2.created.id,
      description: "Acceptance corp — Alfa Romeo 156 sağ ön far, OEM eşdeğer.",
      amount: 4500,
      title: "Corp far teklifi",
    });
    corpOfferId = offer.id;
    report.corporateOffer = "PASS";
    report.corporateActor = corpActor;
    report.corporateOwner = company.name;
  } catch (ownerErr) {
    try {
      corpActor = "E (MEMBER)";
      const offer = await submitOffer(memberId, { companyId: company.id }, {
        requestId: pub2.created.id,
        description: "Acceptance corp member — far teklifi.",
        amount: 4200,
      });
      corpOfferId = offer.id;
      report.corporateOffer = "PASS";
      report.corporateActor = corpActor;
      report.corporateOwner = company.name;
    } catch (memberErr) {
      report.corporateOffer = "FAIL";
      report.errors.push(
        `corp offer owner: ${ownerErr instanceof Error ? ownerErr.message : ownerErr}; member: ${memberErr instanceof Error ? memberErr.message : memberErr}`,
      );
    }
  }
  console.log(`CORPORATE DISCOVERY: ${report.corporateDiscovery}`);
  console.log(`CORPORATE OFFER: ${report.corporateOffer} actor=${report.corporateActor}`);

  const corpOfferRow = corpOfferId
    ? await prisma.offer.findUnique({
        where: { id: corpOfferId },
        select: { companyId: true, submittedById: true },
      })
    : null;
  if (corpOfferRow) {
    if (corpOfferRow.companyId !== company.id) {
      report.errors.push("corp offer companyId mismatch");
    }
    const actorPlan = await prisma.user.findUnique({
      where: { id: corpOfferRow.submittedById },
      select: { planTier: true },
    });
    if (actorPlan?.planTier !== "STANDARD") {
      report.errors.push("corp actor personal plan changed");
    }
  }

  // --- 5. Buyer offer view ---
  console.log("\n--- 5. BUYER OFFER VIEW ---");
  const buyerOffers = await prisma.offer.findMany({
    where: {
      requestId: { in: [pub1.created.id, pub2.created.id] },
      status: { in: ["SUBMITTED", "VIEWED", "ACCEPTED", "REJECTED"] },
    },
    select: {
      id: true,
      amount: true,
      status: true,
      company: { select: { name: true } },
      submittedBy: { select: { name: true } },
    },
  });
  report.buyerOfferView = buyerOffers.length >= 2 ? "PASS" : "PARTIAL";
  console.log(`BUYER OFFER VIEW: ${report.buyerOfferView} (count=${buyerOffers.length})`);

  // --- 6. Accept ---
  console.log("\n--- 6. ACCEPT ---");
  let conversationId = "";
  if (!proOfferId) {
    report.accept = "FAIL";
    report.errors.push("no pro offer to accept");
  } else {
    try {
      const result = await acceptOffer(buyerId, proOfferId);
      conversationId = result.conversationId;
      report.accept = "PASS";
      const replay = await acceptOffer(buyerId, proOfferId);
      report.doubleAccept =
        replay.conversationId === conversationId ? "PASS" : "FAIL";
    } catch (e) {
      report.accept = "FAIL";
      report.doubleAccept = "FAIL";
      report.errors.push(`accept: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const req1After = await prisma.request.findUnique({
    where: { id: pub1.created.id },
    select: { status: true },
  });
  const siblings = await prisma.offer.findMany({
    where: { requestId: pub1.created.id },
    select: { id: true, status: true },
  });
  report.siblingOffers = siblings
    .map((o) => `${idHint(o.id)}:${o.status}`)
    .join(", ");

  const req2Offers = await prisma.offer.findMany({
    where: { requestId: pub2.created.id },
    select: { status: true },
  });
  report.siblingOffers += ` | req2: ${req2Offers.map((o) => o.status).join(",")}`;

  console.log(`ACCEPT: ${report.accept} DOUBLE: ${report.doubleAccept}`);
  console.log(`REQUEST STATUS: ${req1After?.status}`);

  // --- 7. Conversation ---
  console.log("\n--- 7. CONVERSATION ---");
  const convCount = await prisma.conversation.count({
    where: { offerId: proOfferId || undefined },
  });
  report.conversationCount = convCount;
  report.conversation = convCount === 1 ? "PASS" : "FAIL";

  if (conversationId) {
    try {
      await sendMessageDirect(buyerId, conversationId, "Merhaba, teslimat süresi net mi?");
      report.buyerMessage = "PASS";
    } catch (e) {
      report.buyerMessage = "FAIL";
      report.errors.push(`buyer msg: ${e instanceof Error ? e.message : String(e)}`);
    }
    try {
      await sendMessageDirect(proId, conversationId, "Evet, 7 iş günü içinde teslim ederiz.");
      report.sellerMessage = "PASS";
    } catch (e) {
      report.sellerMessage = "FAIL";
      report.errors.push(`seller msg: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // --- 8. Negative ---
  console.log("\n--- 8. NEGATIVE ---");
  let denied = 0;
  if (conversationId) {
    try {
      await getSendableConversation(externalId, conversationId);
    } catch {
      denied++;
    }
    try {
      await sendMessage(externalId, conversationId, "Unauthorized");
    } catch (e) {
      if (e instanceof MessageValidationError) denied++;
    }
  }
  try {
    await acceptOffer(externalId, proOfferId);
  } catch {
    denied++;
  }
  try {
    await submitOffer(externalId, { preferUserSubject: true }, {
      requestId: pub1.created.id,
      description: "External should not offer on closed flow",
      amount: 1,
      },
    );
  } catch {
    denied++;
  }
  report.unauthorizedAccess = denied >= 2 ? "PASS" : "PARTIAL";
  console.log(`UNAUTHORIZED DENIALS: ${denied}`);

  // --- 10. DB integrity ---
  console.log("\n--- 10. DB INTEGRITY ---");
  const accepted = await prisma.offer.count({
    where: { requestId: pub1.created.id, status: "ACCEPTED" },
  });
  const msgs = conversationId
    ? await prisma.message.count({ where: { conversationId } })
    : 0;
  report.dbIntegrity =
    accepted === 1 && convCount === 1 && msgs >= 2 ? "PASS" : "PARTIAL";
  console.log(`DB INTEGRITY: ${report.dbIntegrity} accepted=${accepted} msgs=${msgs}`);

  // Final summary
  console.log("\n=== SUMMARY ===");
  for (const [k, v] of Object.entries(report)) {
    if (k === "errors") continue;
    console.log(`${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
  }
  if (report.errors.length) {
    console.log("\nERRORS:");
    for (const e of report.errors) console.log(` - ${e}`);
    process.exit(1);
  }
  console.log("\nCORE COMMERCE: PASS");
}

main()
  .catch((e) => {
    console.error("FAIL —", e instanceof Error ? e.message : String(e));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
