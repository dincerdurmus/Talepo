/**
 * Buyer/seller offer surfaces, negotiation history, compact photos.
 * Run: npx tsx scripts/verify-offer-role-surfaces-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildIncomingOffersPath,
  classifyIncomingOfferInbox,
  isBuyerActionableIncomingOffer,
  offerMatchesIncomingInboxFilter,
  parseIncomingOfferInboxDurum,
} from "../src/lib/offer/incoming-offer-inbox";
import {
  buildNegotiationHistory,
  historyShouldAutoOpen,
  negotiationActorLabel,
  rejectionTitle,
} from "../src/lib/offer/negotiation-history";
import { negotiationInboxPath } from "../src/lib/offer/negotiation-inbox-path";
import {
  classifyOutgoingOfferInbox,
  isSellerActionableOutgoingOffer,
  offerMatchesOutgoingInboxFilter,
} from "../src/lib/offer/outgoing-offer-inbox";
import type { OfferNegotiationDto } from "../src/lib/offer/offer-negotiation";

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
  negotiations: Array<{
    status: string;
    proposedBySide?: "BUYER" | "PROVIDER";
    createdAt?: string;
  }> = [],
) {
  return { status, negotiations };
}

function dto(
  partial: Partial<OfferNegotiationDto> &
    Pick<OfferNegotiationDto, "id" | "amount" | "proposedBySide" | "status">,
): OfferNegotiationDto {
  return {
    currency: "TRY",
    createdAt: "2026-08-18T10:00:00.000Z",
    respondedAt: null,
    ...partial,
  };
}

console.log("\n=== ROLE ROUTING ===\n");
{
  const incoming = read("src/app/panel/gelen-teklifler/page.tsx");
  const incomingLoader = read("src/server/offer/load-buyer-incoming-offers.ts");
  const outgoing = read("src/app/panel/teklifler/page.tsx");
  const path = read("src/lib/offer/negotiation-inbox-path.ts");
  check(
    "buyer page request owner authority",
    incomingLoader.includes("createdById: userId") &&
      incomingLoader.includes("deletedAt: null") &&
      incomingLoader.includes("NOT: { submittedById: userId, companyId: null }"),
  );
  check(
    "seller page submitter/company authority",
    outgoing.includes("submittedById: user.id") &&
      outgoing.includes("companyId: null") &&
      outgoing.includes("companyId: workspace.companyId"),
  );
  check("buyer title", incoming.includes("Gelen teklifler"));
  check("buyer tag ALICI", incoming.includes("ALICI"));
  check("seller title", outgoing.includes("Tekliflerim"));
  check("seller tag SATICI", outgoing.includes("SATICI"));
  check(
    "buyer deep-link route",
    negotiationInboxPath("buyer", "off1", "neg1") ===
      "/panel/gelen-teklifler?teklif=off1&tur=neg1" &&
      path.includes("/panel/gelen-teklifler"),
  );
  check(
    "seller deep-link route",
    negotiationInboxPath("seller", "off1", "neg1") ===
      "/panel/teklifler?teklif=off1&tur=neg1",
  );
}

console.log("\n=== SAME OFFER NOT IN BOTH ROLE FILTERS ===\n");
{
  const incomingLoader = read("src/server/offer/load-buyer-incoming-offers.ts");
  const first = offer("SUBMITTED");
  check(
    "first offer is buyer Yeni, seller Gönderilen",
    classifyIncomingOfferInbox(first) === "new" &&
      classifyOutgoingOfferInbox(first) === "sent",
  );
  const pendingBuyer = offer("SUBMITTED", [
    { status: "PENDING", proposedBySide: "BUYER", createdAt: "2026-08-18T12:00:00Z" },
  ]);
  check(
    "buyer-proposed round stays negotiating on both sides",
    classifyIncomingOfferInbox(pendingBuyer) === "negotiating" &&
      classifyOutgoingOfferInbox(pendingBuyer) === "negotiating",
  );
  check(
    "buyer page excludes self-submitted personal offers",
    incomingLoader.includes("NOT: { submittedById: userId, companyId: null }"),
  );
}

console.log("\n=== FILTERS ===\n");
{
  check(
    "buyer Yeni: first open offer",
    classifyIncomingOfferInbox(offer("SUBMITTED")) === "new" &&
      offerMatchesIncomingInboxFilter("new", "new"),
  );
  const rejectedThenPending = offer("VIEWED", [
    { status: "REJECTED", proposedBySide: "BUYER", createdAt: "2026-08-18T09:00:00Z" },
    { status: "PENDING", proposedBySide: "BUYER", createdAt: "2026-08-18T11:00:00Z" },
  ]);
  check(
    "old rejected + new pending is Pazarlıkta",
    classifyIncomingOfferInbox(rejectedThenPending) === "negotiating" &&
      classifyOutgoingOfferInbox(rejectedThenPending) === "negotiating",
  );
  check(
    "past rejected round does not classify as Reddedilen",
    classifyIncomingOfferInbox(rejectedThenPending) !== "rejected",
  );
  check(
    "offer REJECTED is Reddedilen",
    classifyIncomingOfferInbox(offer("REJECTED")) === "rejected" &&
      classifyOutgoingOfferInbox(offer("REJECTED")) === "rejected",
  );
  check(
    "ACCEPTED is Kabul edilen",
    classifyIncomingOfferInbox(offer("ACCEPTED")) === "accepted",
  );
  check(
    "WITHDRAWN is not Reddedilen",
    classifyOutgoingOfferInbox(offer("WITHDRAWN")) === "closed" &&
      !offerMatchesOutgoingInboxFilter("closed", "rejected"),
  );
  check(
    "invalid buyer durum -> Tümü",
    parseIncomingOfferInboxDurum("xyz").filter === "all",
  );
  check(
    "buyer durum yeni",
    parseIncomingOfferInboxDurum("yeni").filter === "new",
  );
  check(
    "buyer deep-link keeps teklif+tur",
    buildIncomingOffersPath({
      filter: "negotiating",
      teklif: "off1",
      tur: "neg1",
    }).includes("teklif=off1") &&
      buildIncomingOffersPath({
        filter: "negotiating",
        teklif: "off1",
        tur: "neg1",
      }).includes("tur=neg1"),
  );
}

console.log("\n=== CURRENT TURN VS HISTORY ===\n");
{
  const rows = [
    dto({
      id: "n1",
      amount: 8200,
      proposedBySide: "BUYER",
      status: "REJECTED",
      createdAt: "2026-08-18T09:00:00.000Z",
    }),
    dto({
      id: "n2",
      amount: 8500,
      proposedBySide: "BUYER",
      status: "PENDING",
      createdAt: "2026-08-18T11:00:00.000Z",
    }),
  ];
  const events = buildNegotiationHistory({
    viewer: "seller",
    originalAmount: 9500,
    currency: "TRY",
    offerStatus: "SUBMITTED",
    offerCreatedAt: "2026-08-18T08:00:00.000Z",
    negotiations: rows,
  });
  check(
    "history keeps rejected and pending rounds",
    events.some((event) => event.negotiationId === "n1" && event.tone === "rose") &&
      events.some((event) => event.negotiationId === "n2" && event.tone === "amber"),
  );
  check(
    "history includes first offer",
    events[0]?.title === "İlk teklifiniz",
  );
  check(
    "latest pending drives seller action",
    isSellerActionableOutgoingOffer(offer("SUBMITTED", rows)) &&
      !isBuyerActionableIncomingOffer(offer("SUBMITTED", rows)),
  );
  check(
    "seller rejection stays in history",
    buildNegotiationHistory({
      viewer: "buyer",
      originalAmount: 9500,
      currency: "TRY",
      offerStatus: "SUBMITTED",
      negotiations: [
        dto({
          id: "n3",
          amount: 8800,
          proposedBySide: "BUYER",
          status: "REJECTED",
        }),
      ],
    }).some((event) => event.title.includes("reddedildi") || event.title.includes("redd")),
  );
    check(
      "buyer rejection copy",
      rejectionTitle("buyer", "PROVIDER") === "Bu öneriyi reddettiniz" &&
        rejectionTitle("buyer", "BUYER") ===
          "Bu öneri satıcı tarafından reddedildi" &&
        rejectionTitle("seller", "BUYER") === "Bu öneriyi reddettiniz",
    );
  check(
    "actor labels hide identity",
    negotiationActorLabel("buyer", "PROVIDER") === "Satıcı" &&
      negotiationActorLabel("seller", "BUYER") === "Alıcı" &&
      negotiationActorLabel("buyer", "BUYER") === "Siz",
  );
  check(
    "deep-link opens target round",
    historyShouldAutoOpen(rows, "n1") && !historyShouldAutoOpen(rows, "missing"),
  );
}

console.log("\n=== ACTION-NEEDED BADGES ===\n");
{
  check(
    "buyer counts first offer",
    isBuyerActionableIncomingOffer(offer("SUBMITTED")),
  );
  check(
    "buyer counts seller pending proposal",
    isBuyerActionableIncomingOffer(
      offer("VIEWED", [
        {
          status: "PENDING",
          proposedBySide: "PROVIDER",
          createdAt: "2026-08-18T12:00:00Z",
        },
      ]),
    ),
  );
  check(
    "buyer does not count own pending proposal",
    !isBuyerActionableIncomingOffer(
      offer("VIEWED", [
        {
          status: "PENDING",
          proposedBySide: "BUYER",
          createdAt: "2026-08-18T12:00:00Z",
        },
      ]),
    ),
  );
  check(
    "seller counts buyer pending proposal",
    isSellerActionableOutgoingOffer(
      offer("SUBMITTED", [
        {
          status: "PENDING",
          proposedBySide: "BUYER",
          createdAt: "2026-08-18T12:00:00Z",
        },
      ]),
    ),
  );
  check(
    "seller does not count own pending proposal",
    !isSellerActionableOutgoingOffer(
      offer("SUBMITTED", [
        {
          status: "PENDING",
          proposedBySide: "PROVIDER",
          createdAt: "2026-08-18T12:00:00Z",
        },
      ]),
    ),
  );
  const inbox = read("src/lib/offer/outgoing-offer-inbox.ts");
  const incomingInbox = read("src/lib/offer/incoming-offer-inbox.ts");
  const shell = read("src/components/panel/PanelShell.tsx");
  check(
    "seller badge independent of notification READ",
    !inbox.includes("isRead") && !inbox.includes("READ"),
  );
  check(
    "buyer badge independent of notification READ",
    !incomingInbox.includes("isRead") && !incomingInbox.includes("READ"),
  );
  check(
    "badge authorities stay distinct",
    shell.includes("unreadIncomingOfferEvents") &&
      shell.includes("unreadOutgoingOfferEvents") &&
      shell.includes("unreadNotifications"),
  );
}

console.log("\n=== PHOTOS ===\n");
{
  const gallery = read("src/components/panel/IncomingOfferGallery.tsx");
  const lightbox = read("src/components/panel/OfferMediaLightbox.tsx");
  const mediaRoute = read("src/app/api/offers/[id]/media/[mediaId]/route.ts");
  check("empty gallery skipped", gallery.includes("mediaIds.length === 0) return null"));
  check("compact trigger copy", gallery.includes("Fotoğrafları görüntüle"));
  check("single photo label", gallery.includes("1 fotoğraf"));
  check("lightbox escape", lightbox.includes('event.key === "Escape"'));
  check("lightbox prev/next only when many", lightbox.includes("mediaIds.length > 1"));
  check("lightbox focus trap", lightbox.includes("focusable") && lightbox.includes("Tab"));
  check("lightbox restore focus", lightbox.includes("previous?.focus"));
  check("lightbox above bottom nav", lightbox.includes("z-[70]") && lightbox.includes("pb-[calc(6.5rem"));
  check("media private no-store", mediaRoute.includes("private, no-store"));
}

console.log("\n=== CARD COPY ===\n");
{
  const incomingCard = read("src/components/panel/IncomingOfferCard.tsx");
  const outgoingCard = read("src/components/panel/OutgoingOfferCard.tsx");
  const history = read("src/components/panel/NegotiationHistory.tsx");
  const statusLib = read("src/lib/offer/offer-card-status.ts");
  check("buyer Satıcının son önerisi", statusLib.includes("Satıcının son önerisi"));
  check("buyer Son öneriniz via caption helper", incomingCard.includes("resolveOfferPriceCaption"));
  check("seller Alıcının son önerisi", statusLib.includes("Alıcının son önerisi"));
  check("history accordion title", history.includes("Fiyat ve pazarlık geçmişi"));
  check("turn waiting headers", statusLib.includes("Satıcının yanıtı bekleniyor") && statusLib.includes("Alıcının yanıtı bekleniyor"));
  check("no technical enum in buyer card", !incomingCard.includes("COUNTER_OFFER_RECEIVED"));
}

console.log("\n=== WIRING ===\n");
{
  const incoming = read("src/app/panel/gelen-teklifler/page.tsx");
  const outgoing = read("src/app/panel/teklifler/page.tsx");
  check("buyer filters wired", incoming.includes("IncomingOfferInboxFilters") && incoming.includes("durum"));
  check("buyer tur deep-link", incoming.includes("highlightNegotiationId"));
  check("seller tur deep-link", outgoing.includes("highlightNegotiationId"));
  check(
    "history on both cards",
    read("src/components/panel/IncomingOfferCard.tsx").includes("NegotiationHistory") &&
      read("src/components/panel/OutgoingOfferCard.tsx").includes("NegotiationHistory"),
  );
}

async function liveFixture() {
  const { config } = await import("dotenv");
  config({ path: join(ROOT, ".env.local") });
  config({ path: join(ROOT, ".env") });
  const { prisma } = await import("../src/lib/prisma");
  try {
    const live = await prisma.offer.findUnique({
      where: { id: "cmsyipshk000tkguy176jagd4" },
      include: {
        request: { select: { createdById: true, deletedAt: true } },
        negotiations: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            status: true,
            proposedBySide: true,
            createdAt: true,
            amount: true,
          },
        },
      },
    });
    if (!live) {
      check("live offer fixture", false, "missing");
      return;
    }
    check(
      "live offer buyer and seller ids differ",
      live.request.createdById !== live.submittedById,
    );
    const incomingBucket = classifyIncomingOfferInbox(live);
    const outgoingBucket = classifyOutgoingOfferInbox(live);
    check(
      "live buckets match",
      incomingBucket === outgoingBucket ||
        (incomingBucket === "new" && outgoingBucket === "sent"),
    );
    const history = buildNegotiationHistory({
      viewer: "seller",
      originalAmount: Number(live.amount),
      currency: live.currency,
      offerStatus: live.status,
      negotiations: live.negotiations.map((row) => ({
        id: row.id,
        amount: Number(row.amount),
        currency: live.currency,
        proposedBySide: row.proposedBySide as OfferNegotiationDto["proposedBySide"],
        status: row.status as OfferNegotiationDto["status"],
        createdAt: row.createdAt.toISOString(),
      })),
    });
    check(
      "live history keeps every round",
      live.negotiations.every((row) =>
        history.some((event) => event.negotiationId === row.id),
      ),
    );
    const latest = live.negotiations.at(-1);
    if (latest?.status === "PENDING") {
      check(
        "live latest pending is current filter Pazarlıkta",
        incomingBucket === "negotiating",
      );
    }
    console.log(
      `INFO — live incoming=${incomingBucket} outgoing=${outgoingBucket} rounds=${live.negotiations.length} latest=${latest?.id}:${latest?.status}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  await liveFixture();
  console.log(`\nverify-offer-role-surfaces-v1: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
