/**
 * Notifications V1.1 — click contract + mark-all-read.
 * Run: npx tsx scripts/verify-notifications-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  NOTIFICATION_MISSING_TARGET_HREF,
  deriveNotificationPath,
  resolveNotificationDestination,
  sanitizePanelActionUrl,
} from "../src/lib/notifications/destination";
import {
  NOTIFICATION_UNREAD_STATUS,
  notificationIsUnread,
  unreadNotificationWhere,
} from "../src/lib/notifications/unread";

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

console.log("\n=== DESTINATION CONTRACT ===\n");
{
  check(
    "request published uses taleplerim",
    deriveNotificationPath({
      type: "REQUEST_PUBLISHED",
      actionUrl: null,
      requestId: "req1",
      offerId: null,
      companyId: null,
    }) === "/panel/taleplerim/req1",
  );
  check(
    "match uses supplier talepler",
    deriveNotificationPath({
      type: "NEW_REQUEST_MATCH",
      actionUrl: null,
      requestId: "req1",
      offerId: null,
      companyId: null,
    }) === "/panel/talepler/req1",
  );
  check(
    "new offer uses gelen teklifler",
    deriveNotificationPath({
      type: "NEW_OFFER",
      actionUrl: null,
      requestId: "req1",
      offerId: "off1",
      companyId: null,
    }) === "/panel/gelen-teklifler",
  );
  check(
    "counter received fallback stays in panel",
    deriveNotificationPath({
      type: "COUNTER_OFFER_RECEIVED",
      actionUrl: null,
      requestId: "req1",
      offerId: "off1",
      companyId: null,
    }) === "/panel/teklifler",
  );
  check(
    "counter actionUrl wins over fallback",
    resolveNotificationDestination({
      type: "COUNTER_OFFER_RECEIVED",
      actionUrl: "/panel/gelen-teklifler",
      requestId: "req1",
      offerId: "off1",
      companyId: null,
    }) === "/panel/gelen-teklifler",
  );
  check(
    "counter accepted conversation url allowed",
    resolveNotificationDestination({
      type: "COUNTER_OFFER_ACCEPTED",
      actionUrl: "/panel/mesajlar/conv1",
      requestId: "req1",
      offerId: "off1",
      companyId: null,
    }) === "/panel/mesajlar/conv1",
  );
  check(
    "deal completed conversation url allowed",
    resolveNotificationDestination({
      type: "DEAL_COMPLETED",
      actionUrl: "/panel/mesajlar/conv1",
      requestId: "req1",
      offerId: "off1",
      companyId: null,
    }) === "/panel/mesajlar/conv1",
  );
  check(
    "valid actionUrl wins",
    resolveNotificationDestination({
      type: "REQUEST_PUBLISHED",
      actionUrl: "/panel/taleplerim/abc",
      requestId: "other",
      offerId: null,
      companyId: null,
    }) === "/panel/taleplerim/abc",
  );
  check(
    "open redirect rejected",
    sanitizePanelActionUrl("https://evil.example/phish") === null,
  );
  check(
    "protocol-relative rejected",
    sanitizePanelActionUrl("//evil.example/x") === null,
  );
  check(
    "undefined id rejected",
    sanitizePanelActionUrl("/panel/taleplerim/undefined") === null,
  );
  check(
    "legacy taleplerim path normalized",
    sanitizePanelActionUrl("taleplerim/abc") === "/panel/taleplerim/abc",
  );
  check(
    "same-origin absolute extracted",
    sanitizePanelActionUrl("https://talepo.local/panel/teklifler") ===
      "/panel/teklifler",
  );
  check(
    "malformed falls back to derived",
    resolveNotificationDestination({
      type: "REQUEST_PUBLISHED",
      actionUrl: "/panel/taleplerim/undefined",
      requestId: "req9",
      offerId: null,
      companyId: null,
    }) === "/panel/taleplerim/req9",
  );
  check(
    "missing target href",
    NOTIFICATION_MISSING_TARGET_HREF.includes("hedef=bulunamadi"),
  );
}

console.log("\n=== UNREAD AUTHORITY ===\n");
{
  check("canonical status UNREAD", NOTIFICATION_UNREAD_STATUS === "UNREAD");
  check("unread helper true", notificationIsUnread("UNREAD"));
  check("read helper false", !notificationIsUnread("READ"));
  check("where uses status", unreadNotificationWhere.status === "UNREAD");
}

console.log("\n=== SOURCE ===\n");
{
  const redirect = read("src/app/panel/bildirimler/r/[id]/page.tsx");
  const list = read("src/app/panel/bildirimler/page.tsx");
  const mark = read("src/server/notifications/mark-notifications-read.ts");
  const api = read("src/app/api/notifications/read-all/route.ts");
  const button = read("src/components/panel/MarkAllNotificationsReadButton.tsx");
  const createReq = read("src/server/request/create-request.ts");
  const distribute = read("src/server/request/distribute-request.ts");
  const offer = read("src/server/offer/offer-service.ts");
  const alerts = read("src/lib/monetization/preference-criteria.ts");
  const panelData = read("src/lib/panel/get-panel-data.ts");
  const home = read("src/app/panel/page.tsx");
  const requestDetail = read("src/app/panel/taleplerim/[id]/page.tsx");
  const panelShell = read("src/components/panel/PanelShell.tsx");

  check(
    "click uses notification id then actionUrl",
    redirect.includes("where: { id, userId: user.id }") &&
      redirect.includes("resolveNotificationDestination"),
  );
  check(
    "redirect never uses notification.id as request id",
    !redirect.includes("taleplerim/${id}") &&
      !redirect.includes("taleplerim/${notification.id}"),
  );
  check(
    "owned request existence checked before taleplerim",
    redirect.includes("parseOwnedRequestDetailPath") &&
      redirect.includes("createdById: userId"),
  );
  check(
    "missing target safe bounce",
    redirect.includes("NOTIFICATION_MISSING_TARGET_HREF"),
  );
  check(
    "single mark read before redirect",
    redirect.includes("markNotificationAsRead(user.id, notification.id)"),
  );
  check(
    "published producer uses taleplerim + request.id",
    createReq.includes("actionUrl: `/panel/taleplerim/${request.id}`") &&
      createReq.includes('type: "REQUEST_PUBLISHED"'),
  );
  check(
    "match producer uses talepler",
    distribute.includes("actionUrl: `/panel/talepler/${request.id}`"),
  );
  check(
    "offer producer uses gelen-teklifler",
    offer.includes("actionUrl: `/panel/gelen-teklifler`"),
  );
  check(
    "alert producer uses talepler",
    alerts.includes("/panel/talepler/${requestId}"),
  );
  check("list uses unread helper", list.includes("notificationIsUnread"));
  check("mark all button on list", list.includes("MarkAllNotificationsReadButton"));
  check("empty state has no mark-all", list.includes("Henüz bildirim yok"));
  check("mark all API uses session user", api.includes("requireUser") && api.includes("markAllNotificationsAsRead(user.id)"));
  check("mark all no client userId", !api.includes("body.userId"));
  check("button posts read-all", button.includes("/api/notifications/read-all"));
  check("disabled when unread 0", button.includes("unreadCount <= 0"));
  check("mark all updateMany unread where", mark.includes("unreadNotificationWhere"));
  check("bell count same unread where", panelData.includes("unreadNotificationWhere"));
  check("home click uses notification id route", home.includes("`/panel/bildirimler/r/${notification.id}`"));
  check(
    "request detail still includes offer media",
    requestDetail.includes("media:") && requestDetail.includes("prisma.request.findFirst"),
  );
  check(
    "PanelShell not rewritten in this file set",
    panelShell.includes("unreadNotifications") && panelShell.includes("Bell"),
  );
}

console.log("\n=== REGRESSION TOUCH GUARD ===\n");
{
  const radar = read("src/lib/monetization/talepo-radar.ts");
  const analiz = read("src/server/monetization/professional-analytics.ts");
  const media = read("src/server/offer/offer-media-service.ts");
  check("radar unchanged by notification dest", !radar.includes("bildirimler/r"));
  check("analiz unchanged", !analiz.includes("bildirimler/r"));
  check("offer media authority intact", media.includes("validateImageBuffer"));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
