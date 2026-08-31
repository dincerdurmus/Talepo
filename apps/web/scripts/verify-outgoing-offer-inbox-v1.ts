/**
 * Seller Tekliflerim inbox filters + pending-negotiation nav badge.
 * Run: npx tsx scripts/verify-outgoing-offer-inbox-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildOutgoingOffersPath,
  classifyOutgoingOfferInbox,
  countOutgoingOfferInbox,
  countSellerActionableOutgoingOffers,
  formatPanelCountBadge,
  isSellerActionableOutgoingOffer,
  offerMatchesOutgoingInboxFilter,
  parseOutgoingOfferInboxDurum,
  resolveOutgoingOfferInboxFilter,
  sellerActionableOutgoingOffersWhere,
  sellerPendingNegotiationAria,
  type OutgoingOfferInboxInput,
} from "../src/lib/offer/outgoing-offer-inbox";

const ROOT = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

let pass = 0;
let fail = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass += 1;
    console.log(`PASS — ${name}`);
  } else {
    fail += 1;
    console.log(`FAIL — ${detail ? `${name}: ${detail}` : name}`);
  }
}

function offer(
  status: string,
  negotiations: OutgoingOfferInboxInput["negotiations"] = [],
): OutgoingOfferInboxInput {
  return { status, negotiations };
}

function neg(
  status: string,
  side: "BUYER" | "PROVIDER",
  createdAt: string,
) {
  return { status, proposedBySide: side, createdAt };
}

console.log("\n=== FILTER CLASSIFICATION ===\n");
{
  check(
    "Tümü includes submitted",
    offerMatchesOutgoingInboxFilter(
      classifyOutgoingOfferInbox(offer("SUBMITTED")),
      "all",
    ),
  );
  check(
    "Gönderilen: SUBMITTED without pending",
    classifyOutgoingOfferInbox(offer("SUBMITTED")) === "sent",
  );
  check(
    "Gönderilen: VIEWED without pending",
    classifyOutgoingOfferInbox(offer("VIEWED")) === "sent",
  );
  check(
    "Pazarlıkta: sıra seller",
    classifyOutgoingOfferInbox(
      offer("SUBMITTED", [neg("PENDING", "BUYER", "2026-08-18T10:00:00Z")]),
    ) === "negotiating",
  );
  check(
    "Pazarlıkta: sıra buyer",
    classifyOutgoingOfferInbox(
      offer("VIEWED", [neg("PENDING", "PROVIDER", "2026-08-18T10:00:00Z")]),
    ) === "negotiating",
  );
  check(
    "Kabul edilen",
    classifyOutgoingOfferInbox(offer("ACCEPTED")) === "accepted",
  );
  check(
    "Reddedilen",
    classifyOutgoingOfferInbox(offer("REJECTED")) === "rejected",
  );
  check(
    "latest PENDING wins over older REJECTED",
    classifyOutgoingOfferInbox(
      offer("SUBMITTED", [
        neg("REJECTED", "BUYER", "2026-08-18T09:00:00Z"),
        neg("PENDING", "BUYER", "2026-08-18T11:00:00Z"),
      ]),
    ) === "negotiating",
  );
  check(
    "invalid query falls back to Tümü",
    parseOutgoingOfferInboxDurum("xyz").filter === "all" &&
      parseOutgoingOfferInboxDurum("xyz").explicit,
  );
  check(
    "empty query is implicit Tümü",
    parseOutgoingOfferInboxDurum(undefined).filter === "all" &&
      !parseOutgoingOfferInboxDurum(undefined).explicit,
  );
  check(
    "empty filter copy exported",
    read("src/lib/offer/outgoing-offer-inbox.ts").includes(
      "Devam eden pazarlığınız yok.",
    ) &&
      read("src/components/panel/OutgoingOfferInboxFilters.tsx").includes(
        "OUTGOING_OFFER_INBOX_EMPTY",
      ),
  );
  check(
    "refresh keeps durum in links",
    buildOutgoingOffersPath({ filter: "negotiating" }) ===
      "/panel/teklifler?durum=pazarlik",
  );
}

console.log("\n=== CLOSED STATUSES ===\n");
{
  check(
    "WITHDRAWN is closed not rejected",
    classifyOutgoingOfferInbox(offer("WITHDRAWN")) === "closed",
  );
  check(
    "EXPIRED is closed not rejected",
    classifyOutgoingOfferInbox(offer("EXPIRED")) === "closed",
  );
  check(
    "closed appears in Tümü only",
    offerMatchesOutgoingInboxFilter("closed", "all") &&
      !offerMatchesOutgoingInboxFilter("closed", "rejected") &&
      !offerMatchesOutgoingInboxFilter("closed", "sent"),
  );
}

console.log("\n=== COUNTS / EXCLUSIVITY ===\n");
{
  const rows = [
    offer("SUBMITTED"),
    offer("VIEWED", [neg("PENDING", "BUYER", "2026-08-18T10:00:00Z")]),
    offer("ACCEPTED"),
    offer("REJECTED"),
    offer("WITHDRAWN"),
  ];
  const counts = countOutgoingOfferInbox(rows);
  check("Tümü counts every loaded offer", counts.all === 5);
  check("Gönderilen 1", counts.sent === 1);
  check("Pazarlıkta 1", counts.negotiating === 1);
  check("Kabul 1", counts.accepted === 1);
  check("Red 1", counts.rejected === 1);
  check("closed tracked separately", counts.closed === 1);
  check(
    "exclusive: sent+neg+acc+rej+closed = all",
    counts.sent +
      counts.negotiating +
      counts.accepted +
      counts.rejected +
      counts.closed ===
      counts.all,
  );
}

console.log("\n=== SELLER ACTIONABLE BADGE ===\n");
{
  const pendingBuyer = offer("SUBMITTED", [
    neg("PENDING", "BUYER", "2026-08-18T12:00:00Z"),
  ]);
  const pendingProvider = offer("SUBMITTED", [
    neg("PENDING", "PROVIDER", "2026-08-18T12:00:00Z"),
  ]);
  const accepted = offer("ACCEPTED", [
    neg("ACCEPTED", "BUYER", "2026-08-18T12:00:00Z"),
  ]);
  const rejected = offer("REJECTED", [
    neg("REJECTED", "BUYER", "2026-08-18T12:00:00Z"),
  ]);
  const historyThenPending = offer("VIEWED", [
    neg("REJECTED", "BUYER", "2026-08-18T09:00:00Z"),
    neg("PENDING", "BUYER", "2026-08-18T13:00:00Z"),
  ]);
  const historyThenSellerTurn = offer("VIEWED", [
    neg("REJECTED", "BUYER", "2026-08-18T09:00:00Z"),
    neg("PENDING", "PROVIDER", "2026-08-18T13:00:00Z"),
  ]);

  check("buyer PENDING increases badge", isSellerActionableOutgoingOffer(pendingBuyer));
  check(
    "READ notification is not in badge authority",
    !read("src/lib/offer/outgoing-offer-inbox.ts").includes("UNREAD") &&
      !read("src/lib/offer/outgoing-offer-inbox.ts").includes("notification"),
  );
  check(
    "seller reply drops badge",
    !isSellerActionableOutgoingOffer(pendingProvider),
  );
  check("accept drops badge", !isSellerActionableOutgoingOffer(accepted));
  check("reject drops badge", !isSellerActionableOutgoingOffer(rejected));
  check(
    "settled offer not counted",
    countSellerActionableOutgoingOffers([accepted, rejected]) === 0,
  );
  check(
    "latest round not history",
    isSellerActionableOutgoingOffer(historyThenPending) &&
      !isSellerActionableOutgoingOffer(historyThenSellerTurn),
  );
  check(
    "same offer counted once",
    countSellerActionableOutgoingOffers([pendingBuyer]) === 1 &&
      sellerActionableOutgoingOffersWhere({
        userId: "u",
        companyId: null,
      }).negotiations.some.status === "PENDING",
  );
  const personalWhere = sellerActionableOutgoingOffersWhere({
    userId: "user-a",
    companyId: null,
  });
  check(
    "personal isolation uses submittedById + companyId null",
    personalWhere.submittedById === "user-a" &&
      personalWhere.companyId === null,
  );
  const companyWhere = sellerActionableOutgoingOffersWhere({
    userId: "user-a",
    companyId: "co-1",
  });
  check(
    "company isolation uses companyId",
    companyWhere.companyId === "co-1" &&
      !("submittedById" in companyWhere),
  );
  check("0 hides badge", formatPanelCountBadge(0) === undefined);
  check("1-99 is exact", formatPanelCountBadge(1) === "1" && formatPanelCountBadge(99) === "99");
  check("100+ is 99+", formatPanelCountBadge(100) === "99+");
  check(
    "accessible name",
    sellerPendingNegotiationAria(1) === "yanıtınızı bekleyen 1 pazarlık",
  );
}

console.log("\n=== DEEP LINK ===\n");
{
  const negotiating = classifyOutgoingOfferInbox(
    offer("SUBMITTED", [neg("PENDING", "BUYER", "2026-08-18T10:00:00Z")]),
  );
  const implicit = resolveOutgoingOfferInboxFilter({
    requested: "all",
    explicit: false,
    highlightBucket: negotiating,
  });
  check(
    "notification URL auto-selects Pazarlıkta",
    implicit.filter === "negotiating" && implicit.redirect,
  );
  const kept = resolveOutgoingOfferInboxFilter({
    requested: "all",
    explicit: true,
    highlightBucket: negotiating,
  });
  check("explicit Tümü keeps card visible", kept.filter === "all" && !kept.redirect);
  const hidden = resolveOutgoingOfferInboxFilter({
    requested: "sent",
    explicit: true,
    highlightBucket: negotiating,
  });
  check(
    "wrong filter redirects to offer bucket",
    hidden.filter === "negotiating" && hidden.redirect,
  );
  const path = buildOutgoingOffersPath({
    filter: "negotiating",
    teklif: "offer-1",
    tur: "neg-1",
  });
  check(
    "teklif+tur preserved",
    path.includes("teklif=offer-1") && path.includes("tur=neg-1") && path.includes("durum=pazarlik"),
  );
  const tumu = buildOutgoingOffersPath({
    filter: "all",
    teklif: "offer-1",
    tur: "neg-1",
  });
  check("Tümü with deep link uses durum=tumu", tumu.includes("durum=tumu"));
}

console.log("\n=== WIRING ===\n");
{
  const page = read("src/app/panel/teklifler/page.tsx");
  const filters = read("src/components/panel/OutgoingOfferInboxFilters.tsx");
  const filterRail = read("src/components/panel/offer-inbox/OfferInboxFilterRail.tsx");
  const filterStyles = read(
    "src/components/panel/offer-inbox/offerInboxFilterStyles.ts",
  );
  const layout = read("src/app/panel/layout.tsx");
  const shell = read("src/components/panel/PanelShell.tsx");
  const panelData = read("src/lib/panel/get-panel-data.ts");
  const notify = read("src/server/offer/offer-negotiation-notifications.ts");
  const group = read("src/components/panel/OutgoingOfferCompareGroup.tsx");

  check("page uses inbox authority", page.includes("classifyOutgoingOfferInbox"));
  check("visible Tümü filter", filters.includes("OUTGOING_OFFER_INBOX_FILTERS"));
  check("zero filters stay visible", filters.includes("counts[filter]"));
  check("summary cards share counts", page.includes("inboxCounts"));
  check("deep link still teklif", page.includes("highlightOfferId") && group.includes("CollapsibleOfferGroup"));
  check("tur preserved on page", page.includes("tur"));
  check(
    "layout counts seller unread badge after workspace resolve",
    layout.includes("unreadOutgoingOfferEvents={unreadOutgoingOfferEvents}") &&
      layout.includes("countUnreadOutgoingOfferEvents"),
  );
  check(
    "summary stays cookie-free for incoming badge verifier",
    panelData.includes("countUnreadOutgoingOfferEvents") &&
      !panelData.includes("pendingOutgoingNegotiations"),
  );
  check(
    "incoming badge still personal gelen-teklifler",
    shell.includes('href === "/panel/gelen-teklifler"') &&
      shell.includes("unreadIncomingOfferEvents"),
  );
  check(
    "seller badge on teklifler not notifications",
    shell.includes('href === "/panel/teklifler"') &&
      shell.includes("unreadOutgoingOfferEvents"),
  );
  /**
   * DRIFT ONARIMI (Wave H, 2026-08-31). Eski beklenti `talepo-plan-dot`
   * CSS sınıfını arıyordu; onaylı Signal PanelShell (temiz tabanda da)
   * daraltılmış moddaki rozeti inline dot ile çizer — DAVRANIŞ yerinde,
   * yalnız sınıf adı tarihe karıştı. Ölçülen kanonik sözleşme: rozet
   * varken VE menü daraltılmışken dot-biçimli gösterge (h-2 w-2
   * rounded-full) çizilir; açık modda sayısal rozet sürer.
   */
  check(
    "collapsed uses dot",
    /hasBadge && collapsed/.test(shell) &&
      /hasBadge && !collapsed/.test(shell) &&
      shell.includes("h-2 w-2 rounded-full"),
  );
  check(
    "professional bottom nav badges Tekliflerim",
    shell.includes('label="Tekliflerim"') &&
      shell.includes("unreadOutgoingOfferEvents"),
  );
  check(
    "notification producer untouched in this task",
    notify.includes("Teklifinize yeni pazarlık teklifi geldi"),
  );
  check("comparison group unchanged", group.includes("Müşterinin talebi"));
  check(
    "horizontal filter scroll",
    filters.includes("OfferInboxFilterRail") &&
      filterStyles.includes("overflow-x-auto") &&
      filterRail.includes("OFFER_INBOX_FILTER_SCROLLER_CLASS"),
  );
}

async function liveFixture() {
  /**
   * PINNED-ID KALDIRILDI (Wave H, 2026-08-31). Eski hâli eski bir
   * veritabanındaki sabit offer id'sine (`cmsyipshk…`) bağlıydı; o kayıt
   * olmayan her ortamda kapı kırmızıydı ve ölçüm tekrarlanamıyordu.
   * Şimdi fixture bu turda KANONİK SERVİSLERLE üretilir (createRequest →
   * createOffer → proposeOfferNegotiation → rejectPendingNegotiation),
   * her iki dal da DETERMİNİSTİK ölçülür ve turda oluşturulan kesin
   * kimlikler temizlenir. Yazma kapısı KB-9/FD-5 mekanizmasıdır; kapı
   * açılmazsa prisma import edilmez ve sonuç NOT-MEASURED olur
   * (ölçülmeyen, sıfır ya da yeşil değildir).
   */
  const { canWriteToDatabase } = await import("../src/lib/verification/db-guard");
  const { createNotMeasuredTally } = await import(
    "../src/lib/verification/not-measured"
  );
  const tally = createNotMeasuredTally();
  const hasDb = Boolean(
    process.env.DATABASE_URL?.trim() || process.env.DIRECT_URL?.trim(),
  );
  const guard = hasDb ? canWriteToDatabase() : null;
  if (!hasDb || !guard?.allowed) {
    tally.record(
      "live outgoing inbox",
      `${!hasDb ? "DATABASE_URL/DIRECT_URL tanımlı değil" : (guard as { reason: string }).reason} — canlı sözleşme ÖLÇÜLMEDİ`,
    );
    console.log("Ölçülemeyenler (yeşil DEĞİL, kırmızı da değil):");
    for (const msg of tally.reasons) console.log(` ? ${msg}`);
    process.exitCode = tally.exitCode();
    return;
  }

  const { prisma } = await import("../src/lib/prisma");
  const { hashPassword } = await import("../src/lib/auth/password");
  const { createRequest } = await import("../src/server/request/create-request");
  const { proposeOfferNegotiation, rejectPendingNegotiation } = await import(
    "../src/server/offer/offer-negotiation-service"
  );

  /**
   * Cookie'siz teklif gönderimi — `createOffer` Next.js request bağlamı
   * (cookies) ister ve script'ten çağrılamaz; kabul harness'ının yerleşik
   * kalıbı izlenir (acceptance-core-commerce-v1 `submitOffer`: "same DB
   * invariants as createOffer"). Entitlement kapıları bu kapının konusu
   * DEĞİL (kendi kapıları ölçer); burada korunan DB değişmezleri: tekil
   * aktif teklif, SUBMITTED durumu, offerCount artışı.
   */
  const submitOfferCookieFree = async (
    actorUserId: string,
    input: { requestId: string; description: string; amount: number; deliveryDays?: number; title?: string },
  ) => {
    const dup = await prisma.offer.findFirst({
      where: {
        requestId: input.requestId,
        status: { not: "DRAFT" },
        submittedById: actorUserId,
        companyId: null,
      },
      select: { id: true },
    });
    if (dup) throw new Error("fixture: duplicate offer");
    const now = new Date();
    return prisma.$transaction(async (tx) => {
      const created = await tx.offer.create({
        data: {
          requestId: input.requestId,
          submittedById: actorUserId,
          companyId: null,
          title: input.title ?? null,
          description: input.description,
          amount: input.amount,
          deliveryDays: input.deliveryDays,
          status: "SUBMITTED",
          submittedAt: now,
        },
        select: { id: true },
      });
      await tx.request.update({
        where: { id: input.requestId },
        data: { offerCount: { increment: 1 }, status: "RECEIVING_OFFERS" },
      });
      return created;
    });
  };

  const createdRequestIds: string[] = [];
  let offerId: string | null = null;
  let buyerId: string | null = null;
  let sellerId: string | null = null;

  const upsertQaUser = async (email: string, name: string, member: string) => {
    const { id } = await prisma.user.upsert({
      where: { email },
      update: { status: "ACTIVE" },
      create: {
        email,
        name,
        biography: "acceptance:v1 QA_OUTGOING_INBOX fixture",
        planTier: "STANDARD",
        membershipNumber: member,
        status: "ACTIVE",
        passwordHash: hashPassword("AcceptanceV1!test"),
      },
      select: { id: true },
    });
    return id;
  };

  const liveSelect = {
    id: true,
    status: true,
    submittedById: true,
    companyId: true,
    negotiations: {
      select: { id: true, status: true, proposedBySide: true, createdAt: true },
      orderBy: { createdAt: "asc" as const },
    },
  };

  try {
    buyerId = await upsertQaUser(
      "qa-outgoing-inbox-buyer-v1@talepo.test",
      "[acceptance:v1] QA Inbox Alıcı",
      "TLP-990096",
    );
    sellerId = await upsertQaUser(
      "qa-outgoing-inbox-seller-v1@talepo.test",
      "[acceptance:v1] QA Inbox Satıcı",
      "TLP-990095",
    );

    const request = await createRequest(buyerId, {
      title: "QA giden teklif kutusu talebi",
      description:
        "QA_OUTGOING_INBOX — pazarlık kovası ve satıcı rozetinin canlı ölçümü için sentetik talep.",
      category: { slug: "furniture", name: "Mobilya ve Ofis" },
      city: "İstanbul",
      budget: 5000,
      fields: [],
      fieldValues: {},
    } as never);
    createdRequestIds.push(request.id);

    const offer = await submitOfferCookieFree(sellerId, {
      requestId: request.id,
      description: "QA_OUTGOING_INBOX sentetik teklif — harness kalıbı yolu.",
      amount: 4500,
      deliveryDays: 5,
      title: "QA sentetik teklif",
    });
    offerId = offer.id;

    // Dal 1 — alıcı karşı teklifi: PENDING/BUYER → Pazarlıkta + satıcı-aksiyonlu.
    await proposeOfferNegotiation(buyerId, offer.id, 4200);
    const pendingState = await prisma.offer.findUniqueOrThrow({
      where: { id: offer.id },
      select: liveSelect,
    });
    check(
      "live pending buyer round is Pazarlıkta",
      classifyOutgoingOfferInbox(pendingState) === "negotiating",
    );
    check(
      "live pending buyer round is seller-actionable",
      isSellerActionableOutgoingOffer(pendingState),
    );

    const { countSellerActionableOutgoingOffersForScope } = await import(
      "../src/lib/panel/get-panel-data"
    );
    const badge = await countSellerActionableOutgoingOffersForScope({
      userId: sellerId,
      companyId: null,
    });
    check("live seller badge counts exactly this round", badge === 1, `→ ${badge}`);

    // Dal 2 — satıcı turu reddeder: PENDING kalmaz → Pazarlıkta değil,
    // satıcı-aksiyonlu değil, rozet 0.
    await rejectPendingNegotiation(sellerId, offer.id);
    const resolvedState = await prisma.offer.findUniqueOrThrow({
      where: { id: offer.id },
      select: liveSelect,
    });
    check(
      "live resolved round is not Pazarlıkta",
      classifyOutgoingOfferInbox(resolvedState) !== "negotiating",
    );
    check(
      "live resolved round is not seller-actionable",
      !isSellerActionableOutgoingOffer(resolvedState),
    );
    const badgeAfter = await countSellerActionableOutgoingOffersForScope({
      userId: sellerId,
      companyId: null,
    });
    check("live seller badge drops to zero", badgeAfter === 0, `→ ${badgeAfter}`);
  } finally {
    if (offerId) {
      await prisma.offerNegotiation.deleteMany({ where: { offerId } }).catch(() => undefined);
      // offerEvent modeli yok; rozet olayları OfferNegotiation üzerinden.
      await prisma.offerAttribution.deleteMany({ where: { offerId } }).catch(() => undefined);
      await prisma.notification.deleteMany({ where: { offerId } }).catch(() => undefined);
      await prisma.offer.delete({ where: { id: offerId } }).catch(() => undefined);
    }
    for (const id of createdRequestIds) {
      await prisma.notification.deleteMany({ where: { requestId: id } }).catch(() => undefined);
      await prisma.priceObservation.deleteMany({ where: { requestId: id } }).catch(() => undefined);
      await prisma.requestMatch.deleteMany({ where: { requestId: id } }).catch(() => undefined);
      await prisma.request.delete({ where: { id } }).catch(() => undefined);
    }
    for (const uid of [buyerId, sellerId]) {
      if (!uid) continue;
      await prisma.notification.deleteMany({ where: { userId: uid } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  }
}

async function main() {
  await liveFixture();
  console.log(`\nverify-outgoing-offer-inbox-v1: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
