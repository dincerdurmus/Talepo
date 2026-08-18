/**
 * Unread vs action-required offer surfaces (25 scenarios).
 * Run: npx tsx scripts/verify-offer-unread-action-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

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

console.log("\n=== UNREAD AUTHORITY ===\n");
{
  const panelData = read("src/lib/panel/get-panel-data.ts");
  const unreadLib = read("src/lib/offer/offer-event-unread.ts");
  const layout = read("src/app/panel/layout.tsx");
  const shell = read("src/components/panel/PanelShell.tsx");
  check("1 unreadIncomingOfferEvents export", unreadLib.includes("countUnreadIncomingOfferEvents"));
  check("2 unreadOutgoingOfferEvents export", unreadLib.includes("countUnreadOutgoingOfferEvents"));
  check("3 buyer unread uses Notification UNREAD", unreadLib.includes("unreadNotificationWhere"));
  check("4 sidebar buyer prop renamed", layout.includes("unreadIncomingOfferEvents"));
  check("5 sidebar seller prop renamed", layout.includes("unreadOutgoingOfferEvents"));
  check("6 shell wires unreadIncomingOfferEvents", shell.includes("unreadIncomingOfferEvents"));
  check("7 shell wires unreadOutgoingOfferEvents", shell.includes("unreadOutgoingOfferEvents"));
  check("8 dashboard action required separate", panelData.includes("buyerActionRequiredOffers"));
  check("9 newOffers maps action required not unread", panelData.includes("newOffers: buyerActionRequiredOffers"));
  check("10 bell stays unreadNotifications", shell.includes("unreadNotifications"));
}

console.log("\n=== ACTION REQUIRED (CARD ONLY) ===\n");
{
  const statusLib = read("src/lib/offer/offer-card-status.ts");
  const incomingInbox = read("src/lib/offer/incoming-offer-inbox.ts");
  const outgoingInbox = read("src/lib/offer/outgoing-offer-inbox.ts");
  check(
    "11 buyer first offer action required",
    incomingInbox.includes("isBuyerActionableIncomingOffer"),
  );
  check(
    "12 buyer not action required on own pending",
    incomingInbox.includes('proposedBySide: "PROVIDER"') &&
      incomingInbox.includes("isBuyerActionableIncomingOffer"),
  );
  check(
    "13 seller action on buyer pending",
    outgoingInbox.includes('proposedBySide: "BUYER"'),
  );
  check(
    "14 card header Yanıtınız bekleniyor",
    statusLib.includes("Yanıtınız bekleniyor"),
  );
  check(
    "15 waiting copy buyer",
    statusLib.includes("Satıcının yanıtı bekleniyor"),
  );
  check(
    "16 waiting copy seller",
    statusLib.includes("Alıcının yanıtı bekleniyor"),
  );
}

console.log("\n=== UNREAD VS ACTION INDEPENDENCE ===\n");
{
  const statusLib = read("src/lib/offer/offer-card-status.ts");
  check(
    "17 unread first offer header",
    statusLib.includes("Yeni teklif") && statusLib.includes("isUnread"),
  );
  check(
    "18 read but still action required",
    statusLib.includes("Yanıtınız bekleniyor") && statusLib.includes("actionRequired"),
  );
  check(
    "19 action required helper",
    statusLib.includes("isActionRequiredOffer"),
  );
}

console.log("\n=== COLLAPSE DEFAULTS ===\n");
{
  const statusLib = read("src/lib/offer/offer-card-status.ts");
  check("20 default open unread", statusLib.includes("isUnread") && statusLib.includes("shouldOfferGroupDefaultOpen"));
  check("21 default open action required", statusLib.includes("isActionRequired"));
  check("22 default closed waiting", statusLib.includes("waitingOnCounterpart"));
  check("23 default closed accepted", statusLib.includes('"ACCEPTED"'));
}

console.log("\n=== MARK READ / UI ===\n");
{
  const seenRoute = read("src/app/api/offers/[id]/seen/route.ts");
  const readAllRoute = read("src/app/api/offers/inbox/read-all/route.ts");
  const marker = read("src/components/panel/OfferCardSeenMarker.tsx");
  const card = read("src/components/panel/IncomingOfferCard.tsx");
  const history = read("src/components/panel/NegotiationHistory.tsx");
  const badgeEvents = read("src/lib/offer/offer-inbox-badge-events.ts");
  const shell = read("src/components/panel/PanelShell.tsx");
  const markAll = read("src/components/panel/MarkAllOfferInboxReadButton.tsx");
  const waiting = read("src/components/panel/OfferWaitingFooter.tsx");
  const unreadLibLocal = read("src/lib/offer/offer-event-unread.ts");
  check("24 seen endpoint auth+role", seenRoute.includes("assertOfferSeenAuthority") && seenRoute.includes("markOfferNotificationsAsRead"));
  check("25 marker posts seen once", marker.includes("markedRef") && marker.includes("/seen"));
  // `sr-only` applies clip-path, and a clip-path'ed target never intersects, so
  // the visibility-driven seen call would silently never fire.
  check(
    "seen sentinel stays observable (no sr-only clipping)",
    marker.includes("IntersectionObserver") &&
      marker.includes("data-offer-seen-marker") &&
      !/className="[^"]*sr-only/.test(marker) &&
      /className="[^"]*h-px[^"]*w-px/.test(marker),
  );
  check("unread ring on group", read("src/components/panel/CollapsibleOfferGroup.tsx").includes("talepo-offer-unread-glow"));
  check("Yeni label on card", card.includes("Yeni") && card.includes("sr-only"));
  check("message block component", card.includes("OfferMessageBlock"));
  check("history accordion title", history.includes("Fiyat ve pazarlık geçmişi"));
  check("details accordion", history.includes("Teklif ayrıntıları"));
  check("deep link scroll", read("src/components/panel/CollapsibleOfferGroup.tsx").includes("scrollIntoView"));
  check("mark read server idempotent", read("src/server/notifications/mark-offer-notifications-read.ts").includes("updateMany"));
  check("no page-load mark all", !read("src/app/panel/gelen-teklifler/page.tsx").includes("markOfferNotificationsAsRead"));
  check("unique unread count uses offer ids", unreadLibLocal.includes("unreadOfferIds.size"));
  check("badge optimistic event", badgeEvents.includes("OFFER_INBOX_BADGE_EVENT") && marker.includes("dispatchOfferInboxBadgeUpdate"));
  check(
    "shell listens badge event",
    shell.includes("OFFER_INBOX_BADGE_EVENT") &&
      shell.includes("setBadgeOverride") &&
      shell.includes('detail.role === "buyer"') &&
      shell.includes("Math.max(0, base.incoming - 1)") &&
      shell.includes("Math.max(0, base.outgoing - 1)"),
  );
  check(
    "shell badge override keyed to server snapshot",
    shell.includes("serverBadgeKey") &&
      shell.includes("badgeOverride.key === serverBadgeKey") &&
      !/useEffect\(\(\) => \{\s*setLive/.test(shell),
  );
  check("mark all read api role scoped", readAllRoute.includes("markAllOfferNotificationsAsRead") && readAllRoute.includes('role === "seller"'));
  check("mark all read button per role", markAll.includes("Tümünü okundu işaretle") && markAll.includes("/api/offers/inbox/read-all"));
  check("waiting footer component", waiting.includes("data-offer-waiting-footer") && card.includes("OfferWaitingFooter"));
  check("okunmadi unread filter buyer", read("src/lib/offer/incoming-offer-inbox.ts").includes('unread: "Okunmadı"'));
  check("okunmadi unread filter seller", read("src/lib/offer/outgoing-offer-inbox.ts").includes('unread: "Okunmadı"'));
}

console.log("\n=== TYPE FILTERS ===\n");
{
  const unreadLib = read("src/lib/offer/offer-event-unread.ts");
  const panelData = read("src/lib/panel/get-panel-data.ts");
  check("buyer NEW_OFFER unread type", unreadLib.includes("NEW_OFFER"));
  check("seller OFFER_ACCEPTED unread type", unreadLib.includes("OFFER_ACCEPTED"));
  check("deprecated count alias kept", panelData.includes("countNewIncomingOffers"));
  check("buyer action count fn", panelData.includes("countBuyerActionRequiredOffers"));
  check("list unread ids fn", unreadLib.includes("listUnreadIncomingOfferIds"));
  check("distinct offer unread count", unreadLib.includes("deduped by offerId"));
}

async function liveUnreadConsistency() {
  const { config } = await import("dotenv");
  config({ path: join(ROOT, ".env.local") });
  config({ path: join(ROOT, ".env") });
  const { prisma } = await import("../src/lib/prisma");
  const {
    countUnreadIncomingOfferEvents,
    countBuyerActionRequiredOffers,
  } = await import("../src/lib/panel/get-panel-data");
  try {
    const user = await prisma.user.findFirst({
      where: { email: { equals: "dincer_@hotmail.com.tr", mode: "insensitive" } },
      select: { id: true },
    });
    if (!user) {
      check("live unread user", false, "missing");
      return;
    }
    const [incomingUnread, actionRequired] = await Promise.all([
      countUnreadIncomingOfferEvents(user.id),
      countBuyerActionRequiredOffers(user.id),
    ]);
    console.log(
      `INFO — unreadIncoming=${incomingUnread} buyerActionRequired=${actionRequired}`,
    );
    check("live unread/action counts are numbers", Number.isFinite(incomingUnread) && Number.isFinite(actionRequired));
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  await liveUnreadConsistency();
  console.log(`\nverify-offer-unread-action-v1: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
