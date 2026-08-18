/**
 * Structured negotiation notification matrix.
 * Run: npx tsx scripts/verify-negotiation-notify-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { negotiationInboxPath } from "../src/lib/offer/negotiation-inbox-path";
import { resolveNotificationDestination } from "../src/lib/notifications/destination";
import { unreadNotificationWhere } from "../src/lib/notifications/unread";

let pass = 0;
let fail = 0;
const errors: string[] = [];

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass += 1;
    console.log(`PASS — ${name}`);
  } else {
    fail += 1;
    const msg = detail ? `${name}: ${detail}` : name;
    errors.push(msg);
    console.log(`FAIL — ${msg}`);
  }
}

const root = join(__dirname, "..");
function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

const notify = read("src/server/offer/offer-negotiation-notifications.ts");
const service = read("src/server/offer/offer-negotiation-service.ts");
const create = read("src/server/notifications/create-notification.ts");
const panelData = read("src/lib/panel/get-panel-data.ts");
const unread = read("src/lib/notifications/unread.ts");

console.log("\n=== PRODUCER ===\n");
{
  check("propose calls notifyNegotiationProposed", service.includes("notifyNegotiationProposed"));
  check("reject calls notifyNegotiationRejected", service.includes("notifyNegotiationRejected"));
  check("accept calls notifyNegotiationAccepted", service.includes("notifyNegotiationAccepted"));
  check("no second notification engine", !notify.includes("prisma.notification.create") && notify.includes("createNotificationIfAbsent"));
}

console.log("\n=== COPY / DEEP LINK ===\n");
{
  check(
    "buyer propose title",
    notify.includes("Teklifinize yeni pazarlık teklifi geldi"),
  );
  check("message uses request title and money", notify.includes("talebi için") && notify.includes("tutarında yeni bir fiyat önerildi"));
  check(
    "seller propose notifies buyer",
    notify.includes("Yeni pazarlık teklifi geldi") && notify.includes("talebiniz için"),
  );
  check("accept type COUNTER_OFFER_ACCEPTED", notify.includes('type: "COUNTER_OFFER_ACCEPTED"'));
  check("reject type COUNTER_OFFER_REJECTED", notify.includes('type: "COUNTER_OFFER_REJECTED"'));
  const sellerLink = negotiationInboxPath("seller", "off1", "neg1");
  const buyerLink = negotiationInboxPath("buyer", "off1", "neg1");
  check("seller deep link", sellerLink === "/panel/teklifler?teklif=off1&tur=neg1");
  check("buyer deep link", buyerLink === "/panel/gelen-teklifler?teklif=off1&tur=neg1");
  check(
    "destination keeps seller deep link",
    resolveNotificationDestination({
      type: "COUNTER_OFFER_RECEIVED",
      actionUrl: sellerLink,
      requestId: "r",
      offerId: "off1",
      companyId: null,
    }) === sellerLink,
  );
}

console.log("\n=== RECIPIENT / ISOLATION ===\n");
{
  check("personal uses submittedById", notify.includes("offer.submittedById"));
  check("company ACTIVE members", notify.includes("companyMember.findMany") && notify.includes('status: "ACTIVE"'));
  check("actor skipped", notify.includes("actorUserId"));
  check("buyer recipient is request.createdById", notify.includes("request.createdById"));
}

console.log("\n=== IDEMPOTENCY / UNREAD ===\n");
{
  check("createNotificationIfAbsent exists", create.includes("createNotificationIfAbsent"));
  check("dedupe by userId type offerId actionUrl", create.includes("offerId: input.offerId") && create.includes("actionUrl: input.actionUrl"));
  check("bell unread is UNREAD only", unreadNotificationWhere.status === "UNREAD");
  check("panel summary counts userId unread", panelData.includes("where: { userId, ...unreadNotificationWhere }"));
  check("no type filter on unread", unread.includes("status === NOTIFICATION_UNREAD_STATUS") && !unread.includes("COUNTER_OFFER"));
}

if (fail > 0) {
  console.log(`\nFAILED ${fail}/${pass + fail}`);
  for (const error of errors) console.log(` - ${error}`);
  process.exit(1);
}

console.log(`\nOK ${pass}/${pass + fail} — negotiation notify v1`);
