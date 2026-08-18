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
  const layout = read("src/app/panel/layout.tsx");
  const shell = read("src/components/panel/PanelShell.tsx");
  const panelData = read("src/lib/panel/get-panel-data.ts");
  const notify = read("src/server/offer/offer-negotiation-notifications.ts");
  const group = read("src/components/panel/OutgoingOfferCompareGroup.tsx");

  check("page uses inbox authority", page.includes("classifyOutgoingOfferInbox"));
  check("visible Tümü filter", filters.includes("OUTGOING_OFFER_INBOX_FILTERS"));
  check("zero filters stay visible", filters.includes("counts[filter]"));
  check("summary cards share counts", page.includes("inboxCounts"));
  check("deep link still teklif", page.includes("highlightOfferId") && group.includes("OfferDeepLinkTarget"));
  check("tur preserved on page", page.includes("tur"));
  check(
    "layout counts seller badge after workspace resolve",
    layout.includes("pendingOutgoingNegotiations={pendingOutgoingNegotiations}") &&
      layout.includes("countSellerActionableOutgoingOffersForScope"),
  );
  check(
    "summary stays cookie-free for incoming badge verifier",
    panelData.includes("countSellerActionableOutgoingOffersForScope") &&
      !panelData.includes("pendingOutgoingNegotiations"),
  );
  check(
    "incoming badge still personal gelen-teklifler",
    shell.includes('href === "/panel/gelen-teklifler"') &&
      shell.includes("newIncomingOffers"),
  );
  check(
    "seller badge on teklifler not notifications",
    shell.includes('href === "/panel/teklifler"') &&
      shell.includes("pendingOutgoingNegotiations"),
  );
  check("collapsed uses dot", shell.includes("badge && collapsed") && shell.includes("talepo-plan-dot"));
  check(
    "professional bottom nav badges Tekliflerim",
    shell.includes('label="Tekliflerim"') &&
      shell.includes("pendingOutgoingNegotiations"),
  );
  check(
    "notification producer untouched in this task",
    notify.includes("Teklifinize yeni pazarlık teklifi geldi"),
  );
  check("comparison group unchanged", group.includes("Müşterinin talebi"));
  check("horizontal filter scroll", filters.includes("overflow-x-auto"));
}

async function liveFixture() {
  const { config } = await import("dotenv");
  config({ path: join(ROOT, ".env.local") });
  config({ path: join(ROOT, ".env") });
  const { prisma } = await import("../src/lib/prisma");

  try {
    const live = await prisma.offer.findUnique({
      where: { id: "cmsyipshk000tkguy176jagd4" },
      select: {
        id: true,
        status: true,
        submittedById: true,
        companyId: true,
        negotiations: {
          select: {
            id: true,
            status: true,
            proposedBySide: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!live) {
      check("live offer fixture", false, "missing");
      return;
    }
    const bucket = classifyOutgoingOfferInbox(live);
    const latest = live.negotiations[live.negotiations.length - 1];
    if (latest?.status === "PENDING") {
      check("live pending round is Pazarlıkta", bucket === "negotiating");
      check(
        "live pending buyer round is seller-actionable",
        latest.proposedBySide === "BUYER"
          ? isSellerActionableOutgoingOffer(live)
          : !isSellerActionableOutgoingOffer(live),
      );
    } else {
      check(
        "live offer without PENDING is not Pazarlıkta",
        bucket !== "negotiating",
      );
      check(
        "live offer without PENDING is not seller-actionable",
        !isSellerActionableOutgoingOffer(live),
      );
    }
    const { countSellerActionableOutgoingOffersForScope } = await import(
      "../src/lib/panel/get-panel-data"
    );
    const badge = await countSellerActionableOutgoingOffersForScope({
      userId: live.submittedById,
      companyId: live.companyId,
    });
    check(
      "live seller badge is non-negative integer",
      Number.isInteger(badge) && badge >= 0,
    );
    console.log(
      `INFO — live bucket=${bucket} latest=${latest?.id}:${latest?.status} badge=${badge}`,
    );
  } finally {
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
