/**
 * Sayfam focus dashboard — authority, carousel, activity disclosure.
 * Run: npx tsx scripts/verify-sayfam-home-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  SAYFAM_ACTIVITY_DEFAULT_OPEN,
  SAYFAM_ACTIVITY_MAX_ITEMS,
  SAYFAM_CAROUSEL_INTERVAL_MS,
  SAYFAM_HERO_HINT,
  SAYFAM_PROCESS_LABEL,
  SAYFAM_UNAVAILABLE_HINT,
  classifySayfamProcess,
  countUnreadSayfamActivity,
  dedupeSayfamFocusByRequest,
  getLatestSayfamActivity,
  nextUnreadCountAfterMarkingRead,
  resolveSayfamHeroHint,
  resolveSayfamProcessHref,
  sayfamActivityOpensMutateNotifications,
  sayfamCopyHasForbiddenDash,
  sayfamGreetingFirstName,
  sayfamGreetingTitle,
  shouldShowSayfamActivityDisclosure,
  shouldShowSayfamCarouselControls,
  shouldShowSayfamUnreadBadge,
  sortSayfamFocusItems,
  type RankedSayfamFocusItem,
} from "../src/lib/panel/sayfam-focus";
import type { SayfamActivityItem } from "../src/lib/panel/sayfam-home-types";

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

const panelPage = read("src/app/panel/page.tsx");
const sayfamData = read("src/lib/panel/sayfam-home-data.ts");
const sayfamHome = read("src/components/panel/sayfam/PanelSayfamHome.tsx");
const carousel = read("src/components/panel/sayfam/PanelSayfamSpotlightCarousel.tsx");
const activity = read("src/components/panel/sayfam/PanelSayfamActivityFeed.tsx");
const sayfamFocus = read("src/lib/panel/sayfam-focus.ts");
const panelData = read("src/lib/panel/get-panel-data.ts");
const incomingInbox = read("src/lib/offer/incoming-offer-inbox.ts");
const notificationRedirect = read("src/app/panel/bildirimler/r/[id]/page.tsx");
const nav = read("src/components/panel/panel-nav.ts");
const shell = read("src/components/panel/PanelShell.tsx");
const css = read("src/app/globals.css");
const accountMenu = read("src/components/panel/PanelAccountMenu.tsx");
const hoverHook = read("src/hooks/useHoverDisclosure.ts");
const publicHeader = read("src/components/layout/Header.tsx");

check(
  "canonical route is /panel",
  nav.includes('href: "/panel"') && nav.includes('label: "Sayfam"'),
);
check(
  "panel page uses PanelSayfamHome",
  panelPage.includes("PanelSayfamHome") && panelPage.includes("buildSayfamHomeData"),
);
check(
  "no preview banner in canonical page",
  !panelPage.includes("PreviewBanner") &&
    !panelPage.includes("önizleme") &&
    !panelPage.includes("Beacon"),
);
check(
  "sayfam home has no fixture imports",
  !sayfamHome.includes("BEACON_PENDING") && !sayfamHome.includes("beacon-preview-data"),
);
check(
  "focus built from incoming inbox pipeline",
  sayfamData.includes("loadBuyerIncomingOffers") &&
    sayfamData.includes("aggregateIncomingRequestGroups") &&
    sayfamData.includes("classifySayfamProcess"),
);
check(
  "focus CTA uses request workspace path",
  sayfamData.includes("buildIncomingRequestWorkspacePath"),
);
check(
  "action-required status copy",
  sayfamData.includes("sayfamProcessStatusLabel") &&
    sayfamFocus.includes("Yanıtınız bekleniyor") &&
    sayfamFocus.includes("Yeni teklif var") &&
    sayfamFocus.includes("Karşı tarafın yanıtı bekleniyor") &&
    sayfamFocus.includes("Teklif bekleniyor"),
);
check(
  "activity from recent notifications",
  sayfamData.includes("recentNotifications") &&
    sayfamData.includes("/panel/bildirimler/r/"),
);
check(
  "metrics authority",
  sayfamData.includes("activeRequests") &&
    sayfamData.includes("actionRequiredOffers") &&
    sayfamData.includes("getUnreadMessageCount") &&
    panelData.includes("newOffers: buyerActionRequiredOffers"),
);
check(
  "metric labels match authority",
  sayfamHome.includes("Aktif talep") &&
    sayfamHome.includes("Yanıt bekleyen") &&
    sayfamHome.includes("Mesaj"),
);
check(
  "supplier discovery route",
  panelPage.includes('supplierHref="/panel/talepler"'),
);
check(
  "buyer CTA /talep",
  sayfamHome.includes('href="/talep"'),
);
check(
  "visual order: carousel then actions then activity",
  sayfamHome.indexOf("PanelSayfamSpotlightCarousel") <
    sayfamHome.indexOf("Hızlı eylemler") &&
    sayfamHome.indexOf("Hızlı eylemler") <
      sayfamHome.indexOf("lg:hidden"),
);
check(
  "carousel accessibility",
  carousel.includes("aria-label") &&
    carousel.includes("prefers-reduced-motion") &&
    carousel.includes("Önceki talep") &&
    carousel.includes("Sonraki talep") &&
    carousel.includes("visibilitychange"),
);
check(
  "carousel empty state",
  carousel.includes("İlk talebinizi oluşturun"),
);
check(
  "carousel count and swipe",
  carousel.includes("{activeIndex + 1} / {count}") &&
    carousel.includes("onPointerDown") &&
    carousel.includes("translateX"),
);
check(
  "carousel autoplay restarts after interaction",
  carousel.includes("resumeKey") && carousel.includes("bumpResume"),
);
check(
  "unread badge uses server unread authority",
  activity.includes("unreadCount") &&
    activity.includes("shouldShowSayfamUnreadBadge") &&
    sayfamData.includes("unreadNotifications: summary.unreadNotifications") &&
    sayfamHome.includes("unreadCount={home.unreadNotifications}"),
);
check(
  "activity click skips prefetch of mutating read route",
  activity.includes("prefetch={false}"),
);
check(
  "activity disclosure a11y",
  activity.includes("aria-expanded") &&
    activity.includes("aria-controls") &&
    activity.includes("Aç") &&
    activity.includes("Kapat") &&
    activity.includes("SAYFAM_ACTIVITY_DEFAULT_OPEN"),
);
check(
  "activity inner scroll max-height",
  css.includes("talepo-beacon-activity-scroll") &&
    css.includes("max-height: 21.25rem") &&
    css.includes("max-height: 16.5rem") &&
    css.includes("overscroll-behavior: contain"),
);
check(
  "activity deep-link preserved",
  activity.includes("item.href") && sayfamData.includes("/panel/bildirimler/r/"),
);
check(
  "activity open does not mutate notifications",
  !activity.includes("markRead") &&
    !activity.includes("status: \"READ\"") &&
    sayfamActivityOpensMutateNotifications() === false,
);
check(
  "production shell title Sayfam only",
  (shell.includes('if (pathname === "/panel") return "Sayfam"') &&
    !shell.includes("Sayfam · önizleme")) ||
    !read("src/components/panel/PanelShell.tsx").includes("Sayfam · önizleme"),
);
check(
  "no preview strings in sayfam components",
  !sayfamHome.includes("Onay için") &&
    !sayfamHome.includes("Mevcut Sayfam") &&
    !activity.includes("Canlı akış") &&
    !activity.includes("Beacon"),
);
check(
  "unread/read visual split",
  activity.includes("talepo-beacon-rail-row--unread") &&
    activity.includes("talepo-beacon-unread-dot") &&
    activity.includes("Okunmadı") &&
    css.includes("talepo-beacon-rail-row--unread"),
);
check(
  "escape closes activity panel",
  activity.includes('event.key === "Escape"'),
);
check(
  "click-through marks only one notification",
  notificationRedirect.includes("markNotificationAsRead(user.id, notification.id)") &&
    !notificationRedirect.includes("markAllNotificationsAsRead"),
);
check(
  "incoming filter mapping for focus",
  incomingInbox.includes("buildIncomingRequestWorkspacePath"),
);

const workspace = (requestId: string, filter: string) =>
  `/panel/gelen-teklifler/${requestId}?durum=${filter}`;

function signals(partial: Partial<Parameters<typeof classifySayfamProcess>[0]>) {
  return classifySayfamProcess({
    requestStatus: "PUBLISHED",
    totalOffers: 1,
    actionRequiredCount: 0,
    unreadCount: 0,
    newCount: 0,
    negotiatingCount: 0,
    waitingForCounterparty: false,
    ...partial,
  });
}

check("0 processes stay empty", sortSayfamFocusItems([]).length === 0);
check(
  "1 awaiting-offers process included",
  signals({ totalOffers: 0 }) === "awaiting_offers",
);
check(
  "action required beats waiting offers",
  signals({ actionRequiredCount: 1, totalOffers: 2 }) === "action_required",
);
check(
  "new/unread classified",
  signals({ unreadCount: 1 }) === "new_offer" && signals({ newCount: 1 }) === "new_offer",
);
check(
  "waiting counterparty classified",
  signals({ waitingForCounterparty: true, negotiatingCount: 1 }) ===
    "waiting_counterparty",
);
check(
  "generic negotiating classified",
  signals({ negotiatingCount: 1 }) === "negotiating",
);
check(
  "selected request is in progress",
  signals({ requestStatus: "OFFER_SELECTED", totalOffers: 1 }) === "in_progress",
);
check(
  "draft excluded",
  signals({ requestStatus: "DRAFT" }) === null,
);
check(
  "completed excluded",
  signals({ requestStatus: "COMPLETED", totalOffers: 1 }) === null,
);
check(
  "closed excluded",
  signals({ requestStatus: "CLOSED" }) === null,
);
check(
  "deleted excluded",
  signals({ deleted: true, actionRequiredCount: 1 }) === null,
);

const ranked: RankedSayfamFocusItem[] = [
  {
    id: "a",
    requestId: "a",
    title: "A",
    categorySlug: null,
    categoryName: null,
    coverImageUrl: null,
    statusLabel: "Yanıtınız bekleniyor",
    detailLabel: "",
    href: "/panel/gelen-teklifler/a",
    priority: 0,
    kind: "action_required",
    lastActivityAt: 2,
  },
  {
    id: "b",
    requestId: "b",
    title: "B",
    categorySlug: null,
    categoryName: null,
    coverImageUrl: null,
    statusLabel: "Teklif bekleniyor",
    detailLabel: "",
    href: "/panel/taleplerim/b",
    priority: 5,
    kind: "awaiting_offers",
    lastActivityAt: 5,
  },
  {
    id: "a-dup",
    requestId: "a",
    title: "A dup",
    categorySlug: null,
    categoryName: null,
    coverImageUrl: null,
    statusLabel: "Teklif bekleniyor",
    detailLabel: "",
    href: "/panel/taleplerim/a",
    priority: 5,
    kind: "awaiting_offers",
    lastActivityAt: 9,
  },
];
const unique = sortSayfamFocusItems(dedupeSayfamFocusByRequest(ranked));
check("each request appears once", unique.length === 2 && unique[0]?.requestId === "a");
check("priority order action then waiting", unique[1]?.kind === "awaiting_offers");
check("2 items show carousel controls", shouldShowSayfamCarouselControls(2) === true);
check("5 items show carousel controls", shouldShowSayfamCarouselControls(5) === true);
check("1 item hides carousel controls", shouldShowSayfamCarouselControls(1) === false);
check("0 item hides carousel controls", shouldShowSayfamCarouselControls(0) === false);

check(
  "CTA action-required uses incoming workspace",
  resolveSayfamProcessHref({
    kind: "action_required",
    requestId: "r1",
    unreadCount: 0,
    conversationId: null,
    incomingWorkspacePath: workspace,
  }) === "/panel/gelen-teklifler/r1?durum=action_required",
);
check(
  "CTA awaiting offers uses taleplerim",
  resolveSayfamProcessHref({
    kind: "awaiting_offers",
    requestId: "r2",
    unreadCount: 0,
    conversationId: "c1",
    incomingWorkspacePath: workspace,
  }) === "/panel/taleplerim/r2",
);
check(
  "CTA in-progress uses conversation when present",
  resolveSayfamProcessHref({
    kind: "in_progress",
    requestId: "r3",
    unreadCount: 0,
    conversationId: "conv-1",
    incomingWorkspacePath: workspace,
  }) === "/panel/mesajlar/conv-1",
);
check(
  "CTA in-progress falls back to taleplerim",
  resolveSayfamProcessHref({
    kind: "in_progress",
    requestId: "r3",
    unreadCount: 0,
    conversationId: null,
    incomingWorkspacePath: workspace,
  }) === "/panel/taleplerim/r3",
);
check(
  "autoplay interval 8-10s",
  SAYFAM_CAROUSEL_INTERVAL_MS >= 8_000 && SAYFAM_CAROUSEL_INTERVAL_MS <= 10_000,
);
check(
  "reduced motion disables autoplay",
  carousel.includes("reduceMotion") && carousel.includes("!showControls"),
);

const none: SayfamActivityItem[] = [];
const one: SayfamActivityItem[] = [
  {
    id: "n1",
    title: "Yeni teklif",
    message: "Ofis koltuğu",
    href: "/panel/bildirimler/r/n1",
    timeLabel: "Az önce",
    unread: true,
  },
];
const many: SayfamActivityItem[] = Array.from({ length: 5 }, (_, i) => ({
  id: `n${i}`,
  title: `Olay ${i + 1}`,
  message: `Talep ${i + 1}`,
  href: `/panel/bildirimler/r/n${i}`,
  timeLabel: `${i} sa önce`,
  unread: i === 0,
}));

check("activity 0 hides disclosure", shouldShowSayfamActivityDisclosure(0) === false);
check("activity 1 shows disclosure", shouldShowSayfamActivityDisclosure(1) === true);
check("activity 5+ shows disclosure", shouldShowSayfamActivityDisclosure(many.length) === true);
check("activity default collapsed", SAYFAM_ACTIVITY_DEFAULT_OPEN === false);
check("latest of empty is null", getLatestSayfamActivity(none) === null);
check("latest of one is that item", getLatestSayfamActivity(one)?.id === "n1");
check("latest of many is first", getLatestSayfamActivity(many)?.id === "n0");
check("activity cap is 6", SAYFAM_ACTIVITY_MAX_ITEMS === 6);
check("unread of empty is 0", countUnreadSayfamActivity(none) === 0);
check("unread of one unread is 1", countUnreadSayfamActivity(one) === 1);
check("unread of mixed five is 1", countUnreadSayfamActivity(many) === 1);
check("unread badge hidden at 0", shouldShowSayfamUnreadBadge(0) === false);
check("unread badge shown when unread", shouldShowSayfamUnreadBadge(2) === true);
check(
  "marking one read decrements unread by one",
  nextUnreadCountAfterMarkingRead(
    [
      ...many,
      {
        id: "n9",
        title: "İkinci",
        message: "x",
        href: "/panel/bildirimler/r/n9",
        timeLabel: "1 sa önce",
        unread: true,
      },
    ],
    "n0",
  ) === 1,
);
check(
  "duplicate ids counted once",
  countUnreadSayfamActivity([...one, ...one]) === 1,
);
check(
  "hero hint is the exact welcome sentence",
  SAYFAM_HERO_HINT === "Hazırsan kaldığın yerden devam edelim." &&
    resolveSayfamHeroHint() === SAYFAM_HERO_HINT,
);
check(
  "hero hint has no counts or dashes",
  !/\d/.test(SAYFAM_HERO_HINT) && !sayfamCopyHasForbiddenDash(SAYFAM_HERO_HINT),
);
check(
  "greeting uses first name",
  sayfamGreetingTitle("Dinçer") === "Merhaba, Dinçer" &&
    sayfamGreetingFirstName("Dinçer Yılmaz") === "Dinçer",
);
check(
  "greeting falls back without a name",
  sayfamGreetingTitle(null) === "Merhaba" &&
    sayfamGreetingFirstName("") === null &&
    sayfamGreetingFirstName("dincer_@hotmail.com.tr") === null,
);
check(
  "panel page uses greeting helper not email",
  panelPage.includes("sayfamGreetingFirstName(user.name)") &&
    !panelPage.includes('user.email?.split("@")[0]'),
);
check(
  "user-facing sayfam copy has no typographic dashes",
  [SAYFAM_HERO_HINT, SAYFAM_UNAVAILABLE_HINT, ...Object.values(SAYFAM_PROCESS_LABEL)].every(
    (text) => !sayfamCopyHasForbiddenDash(text),
  ) &&
    !/[—–]/.test(sayfamHome) &&
    !/[—–]/.test(activity) &&
    !/[—–]/.test(carousel),
);

check(
  "greeting lives only in the hero",
  sayfamHome.includes("Merhaba") &&
    !shell.includes("Merhaba,") &&
    shell.includes("Kişisel çalışma alanı") &&
    shell.includes("showStandard"),
);
check(
  "company create banner removed from sayfam page",
  !panelPage.includes("Firma hesabı oluşturun") &&
    !panelPage.includes('href="/panel/firma/yeni"'),
);
check(
  "pending invite authority stays on sayfam page",
  panelPage.includes("pendingInvite") &&
    panelPage.includes("InviteActions") &&
    panelPage.includes("Firma daveti"),
);
check(
  "account menu hosts company create",
  accountMenu.includes("Çalışma alanları") &&
    accountMenu.includes("Firma hesabı oluştur") &&
    accountMenu.includes("Ekibinizle çalışmak için bir firma alanı açın.") &&
    accountMenu.includes('href="/panel/firma/yeni"') &&
    accountMenu.includes("hasCompanies"),
);
check(
  "company create is above fold in account menu",
  accountMenu.indexOf("Çalışma alanları") < accountMenu.indexOf("Profili düzenle") &&
    accountMenu.indexOf("Firma hesabı oluştur") < accountMenu.indexOf("Profili düzenle") &&
    accountMenu.includes("Plan · {planLabel}"),
);
check(
  "hero plan label uses catalog authority",
  sayfamHome.includes("Talepo · {planLabel}") &&
    !sayfamHome.includes('"Standart"') &&
    !sayfamHome.includes('"STANDART"') &&
    !sayfamHome.includes('? "Profesyonel" : "Standart"'),
);
check(
  "panel fallbacks use catalog Bireysel label",
  panelPage.includes('getPlanDefinition("STANDARD").label') &&
    shell.includes('getPlanDefinition("STANDARD").label') &&
    !shell.includes('?? "Standart"') &&
    !panelPage.includes('let planLabel = "Standart"'),
);
check(
  "account menu shares hover disclosure with public header",
  hoverHook.includes("CLOSE_DELAY_MS") &&
    hoverHook.includes("(hover: hover) and (pointer: fine)") &&
    accountMenu.includes("useHoverDisclosure") &&
    publicHeader.includes("useHoverDisclosure"),
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
