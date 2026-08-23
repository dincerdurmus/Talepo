/**
 * Offer inbox role-surface scope regressions.
 *
 * Runs the production scope/unread/read authority against real fixture rows
 * inside an interactive transaction that always rolls back, so no row survives.
 *
 * Run: npx tsx scripts/verify-offer-inbox-scope-v1.ts
 */
import { join } from "node:path";

const ROOT = join(__dirname, "..");

let pass = 0;
let fail = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass += 1;
    console.log(`PASS — ${name}`);
  } else {
    fail += 1;
    console.log(`FAIL — ${name}${detail ? ` (${detail})` : ""}`);
  }
}

function eq(name: string, actual: unknown, expected: unknown) {
  check(name, actual === expected, `expected ${String(expected)}, got ${String(actual)}`);
}

class Rollback extends Error {}

async function main() {
  const { config } = await import("dotenv");
  config({ path: join(ROOT, ".env.local") });
  config({ path: join(ROOT, ".env") });

  /**
   * YAZMA KAPISI (KB-9, kurucu 2026-08-23). Bu script gerçek prisma
   * istemcisiyle yazıyor; `.env` ortak Supabase'e bakıyor. Kapı geçilmezse
   * prisma hiç import edilmez — bağlanmayı bile denemeyiz.
   */
  const { canWriteToDatabase } = await import(
    "../src/lib/verification/db-guard"
  );
  const guard = canWriteToDatabase();
  if (!guard.allowed) {
    console.log(`NOT-MEASURED — offer inbox scope: ${guard.reason}`);
    console.log("verify-offer-inbox-scope-v1: 0 passed, 0 failed, ÖLÇÜLMEDİ");
    process.exit(3);
  }

  const { prisma } = await import("../src/lib/prisma");
  const {
    countUnreadIncomingOfferEvents,
    countUnreadOutgoingOfferEvents,
    listUnreadIncomingOfferIds,
    listUnreadOutgoingOfferIds,
  } = await import("../src/lib/offer/offer-event-unread");
  const { resolveSellerOfferScope } = await import(
    "../src/lib/offer/offer-inbox-scope"
  );
  const {
    assertOfferSeenAuthority,
    markAllOfferNotificationsAsRead,
    markOfferNotificationsAsRead,
  } = await import("../src/server/notifications/mark-offer-notifications-read");

  const stamp = `scope-v1-${Date.now()}`;
  let committedRows = 0;

  try {
    const category = await prisma.category.findFirst({ select: { id: true } });
    if (!category) {
      check("fixture category available", false, "no category row");
      return;
    }

    await prisma
      .$transaction(
        async (tx) => {
          const mkUser = (key: string) =>
            tx.user.create({
              data: {
                name: `${stamp}-${key}`,
                email: `${stamp}-${key}@example.invalid`,
                membershipNumber: `TLP-${stamp}-${key}`,
              },
              select: { id: true },
            });

          const buyer = await mkUser("buyer");
          const sellerPersonal = await mkUser("sellerp");
          const sellerCompany = await mkUser("sellerc");
          const outsider = await mkUser("outsider");

          const mkCompany = (key: string, createdById: string) =>
            tx.company.create({
              data: {
                name: `${stamp}-${key}`,
                slug: `${stamp}-${key}`,
                createdById,
                status: "ACTIVE",
              },
              select: { id: true },
            });

          const companyOne = await mkCompany("co1", sellerCompany.id);
          const companyTwo = await mkCompany("co2", outsider.id);

          await tx.companyMember.create({
            data: {
              companyId: companyOne.id,
              userId: sellerCompany.id,
              role: "OWNER",
              status: "ACTIVE",
              joinedAt: new Date(),
            },
          });
          await tx.companyMember.create({
            data: {
              companyId: companyTwo.id,
              userId: outsider.id,
              role: "OWNER",
              status: "ACTIVE",
              joinedAt: new Date(),
            },
          });
          // Non-ACTIVE membership must never unlock another company's scope.
          await tx.companyMember.create({
            data: {
              companyId: companyTwo.id,
              userId: sellerCompany.id,
              role: "MEMBER",
              status: "INVITED",
            },
          });

          const mkRequest = (key: string, createdById: string) =>
            tx.request.create({
              data: {
                createdById,
                categoryId: category.id,
                title: `${stamp}-${key}`,
                description: "scope fixture",
                status: "PUBLISHED",
                publishedAt: new Date(),
              },
              select: { id: true },
            });

          const buyerRequest = await mkRequest("req-buyer", buyer.id);
          const sellerRequest = await mkRequest(
            "req-seller",
            sellerPersonal.id,
          );

          const mkOffer = (input: {
            requestId: string;
            submittedById: string;
            companyId?: string | null;
            status?: "SUBMITTED" | "DRAFT";
          }) =>
            tx.offer.create({
              data: {
                requestId: input.requestId,
                submittedById: input.submittedById,
                companyId: input.companyId ?? null,
                description: "scope fixture offer",
                amount: 1000,
                status: input.status ?? "SUBMITTED",
                submittedAt: new Date(),
              },
              select: { id: true },
            });

          // O1: personal seller offer on the buyer's request.
          const offerPersonal = await mkOffer({
            requestId: buyerRequest.id,
            submittedById: sellerPersonal.id,
          });
          // O2: company offer on the buyer's request.
          const offerCompany = await mkOffer({
            requestId: buyerRequest.id,
            submittedById: sellerCompany.id,
            companyId: companyOne.id,
          });
          // O3: unrelated company offer on the personal seller's own request.
          const offerOther = await mkOffer({
            requestId: sellerRequest.id,
            submittedById: outsider.id,
            companyId: companyTwo.id,
          });
          // O4: buyer's own personal offer on their own request (self-offer).
          const offerSelf = await mkOffer({
            requestId: buyerRequest.id,
            submittedById: buyer.id,
          });
          // O5: draft offer must stay out of every inbox surface.
          const offerDraft = await mkOffer({
            requestId: buyerRequest.id,
            submittedById: outsider.id,
            status: "DRAFT",
          });

          const mkNotification = (input: {
            userId: string;
            offerId: string | null;
            type:
              | "NEW_OFFER"
              | "COUNTER_OFFER_RECEIVED"
              | "COUNTER_OFFER_REJECTED"
              | "COUNTER_OFFER_ACCEPTED"
              | "OFFER_ACCEPTED"
              | "NEW_MESSAGE";
          }) =>
            tx.notification.create({
              data: {
                userId: input.userId,
                offerId: input.offerId,
                type: input.type,
                title: stamp,
                message: stamp,
                status: "UNREAD",
              },
              select: { id: true },
            });

          // Buyer surface: two notifications on the same offer (dedupe case).
          const buyerNewOffer = await mkNotification({
            userId: buyer.id,
            offerId: offerPersonal.id,
            type: "NEW_OFFER",
          });
          // The exact production regression: a shared type on an offer where the
          // buyer is the request owner but not the seller.
          const buyerCounter = await mkNotification({
            userId: buyer.id,
            offerId: offerPersonal.id,
            type: "COUNTER_OFFER_RECEIVED",
          });
          const buyerCompanyCounter = await mkNotification({
            userId: buyer.id,
            offerId: offerCompany.id,
            type: "COUNTER_OFFER_REJECTED",
          });
          const buyerSelfOffer = await mkNotification({
            userId: buyer.id,
            offerId: offerSelf.id,
            type: "NEW_OFFER",
          });
          const buyerDraftOffer = await mkNotification({
            userId: buyer.id,
            offerId: offerDraft.id,
            type: "NEW_OFFER",
          });
          const buyerMessage = await mkNotification({
            userId: buyer.id,
            offerId: null,
            type: "NEW_MESSAGE",
          });

          // Personal seller surface, plus the same user acting as a buyer.
          const sellerPersonalCounter = await mkNotification({
            userId: sellerPersonal.id,
            offerId: offerPersonal.id,
            type: "COUNTER_OFFER_RECEIVED",
          });
          const sellerPersonalAsBuyer = await mkNotification({
            userId: sellerPersonal.id,
            offerId: offerOther.id,
            type: "NEW_OFFER",
          });

          // Company seller surface.
          const sellerCompanyAccepted = await mkNotification({
            userId: sellerCompany.id,
            offerId: offerCompany.id,
            type: "OFFER_ACCEPTED",
          });

          const statusOf = async (id: string) =>
            (
              await tx.notification.findUniqueOrThrow({
                where: { id },
                select: { status: true },
              })
            ).status;

          console.log("\n=== BUYER INCOMING SCOPE ===\n");
          const buyerIncoming = await listUnreadIncomingOfferIds(buyer.id, tx);
          eq("1 buyer incoming unique offer count", buyerIncoming.size, 2);
          check(
            "2 buyer incoming contains personal seller offer",
            buyerIncoming.has(offerPersonal.id),
          );
          check(
            "3 buyer incoming contains company offer",
            buyerIncoming.has(offerCompany.id),
          );
          check(
            "4 buyer incoming excludes self offer",
            !buyerIncoming.has(offerSelf.id),
          );
          check(
            "5 buyer incoming excludes draft offer",
            !buyerIncoming.has(offerDraft.id),
          );
          eq(
            "6 buyer incoming dedupes two notifications on one offer",
            await countUnreadIncomingOfferEvents(buyer.id, tx),
            2,
          );

          console.log("\n=== BUYER IS NOT AN OUTGOING SELLER ===\n");
          const buyerOutgoing = await listUnreadOutgoingOfferIds(
            buyer.id,
            null,
            tx,
          );
          eq("7 buyer outgoing count is zero", buyerOutgoing.size, 0);
          eq(
            "8 buyer outgoing badge count is zero",
            await countUnreadOutgoingOfferEvents(buyer.id, null, tx),
            0,
          );

          console.log("\n=== PERSONAL SELLER SCOPE ===\n");
          const personalOutgoing = await listUnreadOutgoingOfferIds(
            sellerPersonal.id,
            null,
            tx,
          );
          eq("9 personal seller outgoing count", personalOutgoing.size, 1);
          check(
            "10 personal seller outgoing offer is own submission",
            personalOutgoing.has(offerPersonal.id),
          );
          const personalIncoming = await listUnreadIncomingOfferIds(
            sellerPersonal.id,
            tx,
          );
          eq("11 same user buyer surface on own request", personalIncoming.size, 1);
          check(
            "12 same user buyer surface holds the other company offer",
            personalIncoming.has(offerOther.id),
          );

          console.log("\n=== COMPANY SELLER SCOPE ===\n");
          eq(
            "13 company seller outgoing in own workspace",
            (
              await listUnreadOutgoingOfferIds(
                sellerCompany.id,
                companyOne.id,
                tx,
              )
            ).size,
            1,
          );
          eq(
            "14 company offer not counted in personal workspace",
            (await listUnreadOutgoingOfferIds(sellerCompany.id, null, tx)).size,
            0,
          );
          eq(
            "15 foreign company id without ACTIVE membership is rejected",
            (
              await listUnreadOutgoingOfferIds(
                sellerCompany.id,
                companyTwo.id,
                tx,
              )
            ).size,
            0,
          );
          eq(
            "16 non-ACTIVE membership downgrades scope to personal",
            (await resolveSellerOfferScope(sellerCompany.id, companyTwo.id, tx))
              .kind,
            "personal",
          );
          eq(
            "17 ACTIVE membership resolves company scope",
            (await resolveSellerOfferScope(sellerCompany.id, companyOne.id, tx))
              .kind,
            "company",
          );

          console.log("\n=== SEEN AUTHORITY ===\n");
          eq(
            "18 buyer may seen own incoming offer",
            await assertOfferSeenAuthority(
              { userId: buyer.id, offerId: offerPersonal.id, role: "buyer" },
              tx,
            ),
            true,
          );
          eq(
            "19 buyer may not seen as seller on same offer",
            await assertOfferSeenAuthority(
              { userId: buyer.id, offerId: offerPersonal.id, role: "seller" },
              tx,
            ),
            false,
          );
          eq(
            "20 buyer may not seen unrelated offer",
            await assertOfferSeenAuthority(
              { userId: buyer.id, offerId: offerOther.id, role: "buyer" },
              tx,
            ),
            false,
          );
          eq(
            "21 personal seller may seen own offer",
            await assertOfferSeenAuthority(
              {
                userId: sellerPersonal.id,
                offerId: offerPersonal.id,
                role: "seller",
              },
              tx,
            ),
            true,
          );
          eq(
            "22 personal seller may not seen another seller offer",
            await assertOfferSeenAuthority(
              {
                userId: sellerPersonal.id,
                offerId: offerCompany.id,
                role: "seller",
              },
              tx,
            ),
            false,
          );
          eq(
            "23 company member may seen company offer",
            await assertOfferSeenAuthority(
              {
                userId: sellerCompany.id,
                offerId: offerCompany.id,
                role: "seller",
              },
              tx,
            ),
            true,
          );
          eq(
            "24 outsider may not seen company offer",
            await assertOfferSeenAuthority(
              {
                userId: outsider.id,
                offerId: offerCompany.id,
                role: "seller",
              },
              tx,
            ),
            false,
          );

          console.log("\n=== OFFER-SCOPED SEEN ===\n");
          const seen = await markOfferNotificationsAsRead(
            buyer.id,
            offerPersonal.id,
            "buyer",
            tx,
          );
          eq("25 seen marks both notifications of the offer", seen.count, 2);
          eq("26 buyer NEW_OFFER read", await statusOf(buyerNewOffer.id), "READ");
          eq("27 buyer counter read", await statusOf(buyerCounter.id), "READ");
          eq(
            "28 buyer other offer untouched",
            await statusOf(buyerCompanyCounter.id),
            "UNREAD",
          );
          eq(
            "29 seller notification on same offer untouched",
            await statusOf(sellerPersonalCounter.id),
            "UNREAD",
          );
          eq(
            "30 non-offer notification untouched",
            await statusOf(buyerMessage.id),
            "UNREAD",
          );
          eq(
            "31 badge drops after seen",
            await countUnreadIncomingOfferEvents(buyer.id, tx),
            1,
          );
          eq(
            "32 seen is idempotent",
            (
              await markOfferNotificationsAsRead(
                buyer.id,
                offerPersonal.id,
                "buyer",
                tx,
              )
            ).count,
            0,
          );

          console.log("\n=== BULK READ ===\n");
          const bulkBuyer = await markAllOfferNotificationsAsRead(
            buyer.id,
            "buyer",
            null,
            tx,
          );
          eq("33 buyer bulk read touches remaining scoped offer", bulkBuyer.count, 1);
          eq(
            "34 buyer bulk read clears buyer badge",
            await countUnreadIncomingOfferEvents(buyer.id, tx),
            0,
          );
          eq(
            "35 buyer bulk read leaves self-offer notification",
            await statusOf(buyerSelfOffer.id),
            "UNREAD",
          );
          eq(
            "36 buyer bulk read leaves draft-offer notification",
            await statusOf(buyerDraftOffer.id),
            "UNREAD",
          );
          eq(
            "37 buyer bulk read leaves message notification",
            await statusOf(buyerMessage.id),
            "UNREAD",
          );
          eq(
            "38 buyer bulk read does not touch seller surface",
            await statusOf(sellerPersonalCounter.id),
            "UNREAD",
          );
          eq(
            "39 buyer bulk read is idempotent",
            (await markAllOfferNotificationsAsRead(buyer.id, "buyer", null, tx))
              .count,
            0,
          );

          const bulkSeller = await markAllOfferNotificationsAsRead(
            sellerPersonal.id,
            "seller",
            null,
            tx,
          );
          eq("40 personal seller bulk read count", bulkSeller.count, 1);
          eq(
            "41 seller bulk read does not touch own buyer surface",
            await statusOf(sellerPersonalAsBuyer.id),
            "UNREAD",
          );
          eq(
            "42 seller bulk read leaves buyer inbox intact",
            (await listUnreadIncomingOfferIds(sellerPersonal.id, tx)).size,
            1,
          );

          const bulkCompany = await markAllOfferNotificationsAsRead(
            sellerCompany.id,
            "seller",
            companyOne.id,
            tx,
          );
          eq("43 company seller bulk read count", bulkCompany.count, 1);
          eq(
            "44 company seller notification read",
            await statusOf(sellerCompanyAccepted.id),
            "READ",
          );

          console.log("\n=== ARCHIVE EXCLUSION ===\n");
          await tx.notification.update({
            where: { id: buyerCompanyCounter.id },
            data: { status: "UNREAD", readAt: null },
          });
          eq(
            "45 unarchived offer counts again",
            await countUnreadIncomingOfferEvents(buyer.id, tx),
            1,
          );
          await tx.offerArchive.create({
            data: {
              userId: buyer.id,
              offerId: offerCompany.id,
              companyId: null,
            },
          });
          eq(
            "46 archived offer leaves the buyer badge",
            await countUnreadIncomingOfferEvents(buyer.id, tx),
            0,
          );

          throw new Rollback();
        },
        { timeout: 120_000, maxWait: 20_000 },
      )
      .catch((error) => {
        if (!(error instanceof Rollback)) throw error;
      });

    committedRows = await prisma.notification.count({
      where: { title: stamp },
    });
    eq("47 fixture rolled back, no notification persisted", committedRows, 0);
    eq(
      "48 fixture rolled back, no user persisted",
      await prisma.user.count({ where: { membershipNumber: { contains: stamp } } }),
      0,
    );
  } finally {
    const { prisma } = await import("../src/lib/prisma");
    await prisma.$disconnect();
  }

  console.log(
    `\nverify-offer-inbox-scope-v1: ${pass} passed, ${fail} failed`,
  );
  if (fail > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
