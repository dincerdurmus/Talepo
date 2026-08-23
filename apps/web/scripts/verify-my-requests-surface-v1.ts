/**
 * Taleplerim management surface — ownership, lifecycle, CTA, filters.
 * Run: npx tsx scripts/verify-my-requests-surface-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  isPanelNavActive,
  TALEP_TEKLIF_NAV_HREFS,
} from "../src/components/panel/panel-nav";
import { SAYFAM_ACTIVE_PROCESS_STATUSES } from "../src/lib/panel/sayfam-focus";
import {
  MY_REQUEST_ACTIVE_STATUSES,
  MY_REQUEST_CONCLUDED_STATUSES,
  MY_REQUEST_EDITABLE_STATUSES,
  MY_REQUEST_FILTERS,
  MY_REQUEST_FILTER_EMPTY,
  MY_REQUEST_FILTER_LABEL,
  MY_REQUEST_LANE_PRIORITY,
  MY_REQUEST_PRIMARY_FILTERS,
  MY_REQUEST_SECONDARY_FILTERS,
  buildMyRequestsPath,
  canCloneMyRequestAsDraft,
  canDeleteMyRequestStatus,
  classifyMyRequestLane,
  classifyMyRequestLifecycle,
  countMyRequestFilters,
  exclusiveLifecycleFilters,
  filterMyRequests,
  formatMyRequestLocation,
  myRequestBannerExpiredCopy,
  myRequestBannerMixCopy,
  myRequestBannerTotalLabel,
  parseMyRequestsFilter,
  resolveMyRequestPrimaryCta,
  sortMyRequests,
  summarizeMyRequestBanner,
  toMyRequestCardModel,
  type MyRequestSignals,
} from "../src/lib/panel/my-requests-surface";
import { buildConcludedProcessHistory } from "../src/lib/panel/concluded-process-history";
import {
  collisionPaddingForViewport,
  placeCollisionPopover,
} from "../src/lib/panel/collision-popover";

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

function idleSignals(status: string, extra: Partial<MyRequestSignals> = {}): MyRequestSignals {
  return {
    status,
    totalOffers: extra.totalOffers ?? 0,
    actionRequiredCount: extra.actionRequiredCount ?? 0,
    unreadCount: extra.unreadCount ?? 0,
    newCount: extra.newCount ?? 0,
    negotiatingCount: extra.negotiatingCount ?? 0,
    waitingForCounterparty: extra.waitingForCounterparty ?? false,
    conversationId: extra.conversationId ?? null,
  };
}

function card(input: {
  id: string;
  title: string;
  status: string;
  categoryName?: string;
  categorySlug?: string;
  coverImageUrl?: string | null;
  city?: string | null;
  district?: string | null;
  budgetLabel?: string | null;
  lastActivityAt: string;
  offerCount?: number;
  isUrgent?: boolean;
  signals?: Partial<MyRequestSignals>;
}) {
  return toMyRequestCardModel({
    id: input.id,
    title: input.title,
    status: input.status,
    categoryName: input.categoryName ?? "Hizmet",
    categorySlug: input.categorySlug ?? "services",
    coverImageUrl: input.coverImageUrl ?? null,
    city: input.city,
    district: input.district,
    budgetLabel: input.budgetLabel ?? null,
    lastActivityAt: new Date(input.lastActivityAt),
    offerCount: input.offerCount ?? 0,
    isUrgent: input.isUrgent ?? false,
    signals: idleSignals(input.status, {
      totalOffers: input.offerCount ?? 0,
      ...input.signals,
    }),
  });
}

const page = read("src/app/panel/taleplerim/page.tsx");
const home = read("src/components/panel/my-requests/PanelMyRequestsHome.tsx");
const header = read(
  "src/components/panel/my-requests/MyRequestsCommandHeader.tsx",
);
const flow = read("src/components/panel/my-requests/MyRequestsBannerFlow.tsx");
const loading = read("src/app/panel/taleplerim/loading.tsx");
const cardFile = read("src/components/panel/my-requests/MyRequestCard.tsx");
const filters = read("src/components/panel/my-requests/MyRequestsFilterBar.tsx");
const overflow = read("src/components/panel/my-requests/MyRequestOverflowMenu.tsx");
const popover = read("src/components/panel/PanelCollisionPopover.tsx");
const collision = read("src/lib/panel/collision-popover.ts");
const companyWorkspace = read("src/lib/panel/company-workspace.ts");
const loader = read("src/lib/panel/my-requests-home-data.ts");
const surface = read("src/lib/panel/my-requests-surface.ts");
const shell = read("src/components/panel/PanelShell.tsx");
const nav = read("src/components/panel/panel-nav.ts");
const css = read("src/app/globals.css");
const updateRequest = read("src/server/request/update-request.ts");
const deleteRequest = read("src/server/request/delete-request.ts");
const deleteApi = read("src/app/api/requests/[id]/route.ts");
const detail = read("src/app/panel/taleplerim/[id]/page.tsx");
const edit = read("src/app/panel/taleplerim/[id]/duzenle/page.tsx");
const legacy = read("src/app/taleplerim/page.tsx");
const cloneService = read("src/server/request/clone-request-as-draft.ts");
const cloneApi = read("src/app/api/requests/[id]/clone-draft/route.ts");
const cloneControl = read(
  "src/components/panel/my-requests/CloneRequestAsDraftControl.tsx",
);
const processPanel = read(
  "src/components/panel/my-requests/ConcludedProcessPanel.tsx",
);
const processHistory = read("src/lib/panel/concluded-process-history.ts");
const authz = read("src/lib/observability/authorization-matrix.ts");
const exploreHome = read("src/components/panel/explore/PanelExploreHome.tsx");
const rail = read("src/components/panel/CommandPersonalSidebar.tsx");
const publicHeader = read("src/components/layout/Header.tsx");
const accountMenu = read("src/components/panel/PanelAccountMenu.tsx");

check(
  "ownership scope uses current user and excludes soft-deleted",
  loader.includes("createdById: userId") && loader.includes("deletedAt: null"),
);

check(
  "visible product name is Taleplerim",
  header.includes("<h1") &&
    header.includes("Taleplerim") &&
    nav.includes('label: "Taleplerim"') &&
    !header.includes("Keşfet") &&
    !page.includes("Keşfet"),
);

check(
  "Talepleri keşfet and Taleplerim stay distinct destinations",
  exploreHome.includes('href="/panel/taleplerim"') &&
    exploreHome.includes("Kendi taleplerin") &&
    !home.includes("Size yakışan talepler") &&
    !page.includes("PanelExploreHome") &&
    nav.includes('href: "/panel/taleplerim"') &&
    nav.includes('label: "Taleplerim"') &&
    nav.includes('label: "Talepleri keşfet"') &&
    !nav.includes('label: "Talepler"'),
);

check(
  "PanelBackLink shows frost Geri to /panel on Taleplerim list",
  /pathname === "\/panel\/taleplerim"[\s\S]*?href="\/panel"/.test(shell) &&
    !shell.includes('if (pathname === "/panel/taleplerim") return null') &&
    !shell.includes('if (pathname.startsWith("/panel/taleplerim")) return null'),
);

check(
  "detail route keeps Taleplerim back link",
  detail.includes('href="/panel/taleplerim"') && detail.includes("Taleplerim"),
);

check(
  "detail hands offer decisions to Gelen Teklifler workspace",
  detail.includes("IncomingOffersTransitionCard") &&
    detail.includes("buildIncomingRequestWorkspacePath") &&
    !detail.includes("OfferNegotiationPanel") &&
    !detail.includes("OfferActions"),
);

check(
  "legacy /taleplerim still redirects to panel",
  legacy.includes('redirect("/panel/taleplerim")'),
);

check(
  "edit and publish lifecycle files stay wired",
  edit.includes("canEditRequestStatus") &&
    deleteApi.includes("deleteRequest") &&
    deleteRequest.includes("deletedAt: new Date()"),
);

check(
  "editable statuses match update-request authority",
  updateRequest.includes('"DRAFT"') &&
    updateRequest.includes('"PUBLISHED"') &&
    updateRequest.includes('"RECEIVING_OFFERS"') &&
    MY_REQUEST_EDITABLE_STATUSES.has("DRAFT") &&
    MY_REQUEST_EDITABLE_STATUSES.has("PUBLISHED") &&
    MY_REQUEST_EDITABLE_STATUSES.has("RECEIVING_OFFERS") &&
    !MY_REQUEST_EDITABLE_STATUSES.has("COMPLETED"),
);

check(
  "lifecycle filters use official active statuses and split expired",
  SAYFAM_ACTIVE_PROCESS_STATUSES.every((status) =>
    MY_REQUEST_ACTIVE_STATUSES.has(status),
  ) &&
    MY_REQUEST_ACTIVE_STATUSES.has("OFFER_SELECTED") &&
    MY_REQUEST_CONCLUDED_STATUSES.has("COMPLETED") &&
    MY_REQUEST_CONCLUDED_STATUSES.has("CANCELLED") &&
    !MY_REQUEST_CONCLUDED_STATUSES.has("EXPIRED") &&
    MY_REQUEST_PRIMARY_FILTERS.join(",") === "all,active,concluded,expired" &&
    MY_REQUEST_SECONDARY_FILTERS.join(",") === "draft" &&
    !(MY_REQUEST_FILTERS as readonly string[]).includes("action_required") &&
    !(MY_REQUEST_FILTERS as readonly string[]).includes("new_offer") &&
    !(MY_REQUEST_FILTERS as readonly string[]).includes("negotiating") &&
    !surface.includes('"CLOSED"'),
);

check(
  "filter URL persistence uses durum query",
  parseMyRequestsFilter("aktif") === "active" &&
    parseMyRequestsFilter("sonuclanan") === "concluded" &&
    parseMyRequestsFilter("suresi") === "expired" &&
    parseMyRequestsFilter("taslak") === "draft" &&
    parseMyRequestsFilter("yanit") === "all" &&
    parseMyRequestsFilter("teklif") === "all" &&
    parseMyRequestsFilter("unknown") === "all" &&
    buildMyRequestsPath("all") === "/panel/taleplerim" &&
    buildMyRequestsPath("active") === "/panel/taleplerim?durum=aktif",
);

const actionCard = card({
  id: "req-action",
  title: "Ofis sandalyesi",
  status: "RECEIVING_OFFERS",
  categoryName: "Mobilya",
  categorySlug: "furniture",
  city: "İstanbul",
  district: "Kadıköy",
  budgetLabel: "8.000 TL",
  lastActivityAt: "2026-08-20T10:00:00Z",
  offerCount: 2,
  signals: {
    actionRequiredCount: 1,
    unreadCount: 1,
    newCount: 1,
  },
});

const newOfferCard = card({
  id: "req-new",
  title: "Laptop",
  status: "PUBLISHED",
  categoryName: "Teknoloji",
  categorySlug: "technology",
  coverImageUrl: "https://cdn.example/cover.jpg",
  city: "Ankara",
  lastActivityAt: "2026-08-20T09:00:00Z",
  offerCount: 1,
  isUrgent: true,
  signals: { unreadCount: 1, newCount: 1 },
});

const negotiatingCard = card({
  id: "req-neg",
  title: "Kombi",
  status: "RECEIVING_OFFERS",
  categoryName: "Beyaz eşya",
  categorySlug: "appliances",
  budgetLabel: "12.000 TL",
  lastActivityAt: "2026-08-20T08:00:00Z",
  offerCount: 1,
  signals: {
    negotiatingCount: 1,
    waitingForCounterparty: true,
    conversationId: "conv-1",
  },
});

const waitingCard = card({
  id: "req-wait",
  title: "Yazıcı",
  status: "PUBLISHED",
  categoryName: "Ofis",
  categorySlug: "printing",
  city: "İzmir",
  district: "",
  lastActivityAt: "2026-08-19T08:00:00Z",
});

const draftCard = card({
  id: "req-draft",
  title: "Taslak talep",
  status: "DRAFT",
  city: "Bursa",
  lastActivityAt: "2026-08-18T08:00:00Z",
});

const doneCard = card({
  id: "req-done",
  title: "Bitmiş talep",
  status: "COMPLETED",
  city: "Antalya",
  budgetLabel: "3.000 TL",
  lastActivityAt: "2026-08-01T08:00:00Z",
  offerCount: 3,
  signals: { conversationId: "conv-done" },
});

const progressCard = card({
  id: "req-progress",
  title: "Anlaşılan talep",
  status: "IN_PROGRESS",
  city: "Eskişehir",
  budgetLabel: "4.000 TL",
  lastActivityAt: "2026-08-17T08:00:00Z",
  offerCount: 1,
  signals: { conversationId: "conv-2" },
});

const cancelledCard = card({
  id: "req-cancel",
  title: "İptal talep",
  status: "CANCELLED",
  lastActivityAt: "2026-08-02T08:00:00Z",
});

const expiredCard = card({
  id: "req-expired",
  title: "Süresi dolmuş talep",
  status: "EXPIRED",
  lastActivityAt: "2026-08-03T08:00:00Z",
  offerCount: 1,
  signals: {
    actionRequiredCount: 2,
    unreadCount: 1,
    newCount: 1,
    negotiatingCount: 1,
  },
});

check(
  "action-required outranks new offer on the same request",
  actionCard.lane === "action_required" &&
    classifyMyRequestLane({
      status: "RECEIVING_OFFERS",
      totalOffers: 2,
      actionRequiredCount: 1,
      unreadCount: 1,
      newCount: 1,
      negotiatingCount: 1,
      waitingForCounterparty: false,
      conversationId: null,
    }) === "action_required",
);

check("new offer lane", newOfferCard.lane === "new_offer");
check(
  "negotiating includes waiting for counterparty",
  negotiatingCard.lane === "negotiating",
);
check("awaiting offers lane", waitingCard.lane === "awaiting_offers");
check("draft lane", draftCard.lane === "draft");
check("concluded lane", doneCard.lane === "concluded");
check("in-progress lane", progressCard.lane === "in_progress");
check("draft lifecycle", draftCard.lifecycle === "draft");
check("concluded lifecycle", doneCard.lifecycle === "concluded");
check(
  "cancelled stays concluded, not expired",
  cancelledCard.lifecycle === "concluded",
);
check("expired lifecycle is exclusive", expiredCard.lifecycle === "expired");
check(
  "offer signals do not move expired or concluded requests",
  expiredCard.lane === "concluded" &&
    expiredCard.actionRequiredCount === 2 &&
    expiredCard.newCount === 1 &&
    expiredCard.primaryCta.kind === "view",
);

const ranked = sortMyRequests([
  doneCard,
  draftCard,
  waitingCard,
  negotiatingCard,
  newOfferCard,
  actionCard,
  progressCard,
  expiredCard,
  cancelledCard,
]);

check(
  "active requests sort before draft, expired, and concluded",
  ranked[0]?.id === "req-action" &&
    ranked[1]?.id === "req-new" &&
    ranked[2]?.id === "req-neg" &&
    ranked[3]?.id === "req-progress" &&
    ranked[4]?.id === "req-wait" &&
    ranked[5]?.id === "req-draft" &&
    ranked[6]?.id === "req-expired" &&
    ranked[7]?.id === "req-cancel" &&
    ranked[8]?.id === "req-done" &&
    MY_REQUEST_LANE_PRIORITY.action_required < MY_REQUEST_LANE_PRIORITY.draft,
);

const allCards = [
  actionCard,
  newOfferCard,
  negotiatingCard,
  waitingCard,
  draftCard,
  doneCard,
  progressCard,
  expiredCard,
  cancelledCard,
];

const counts = countMyRequestFilters(allCards);

check(
  "filter counts are request lifecycle counts, unique per filter",
  counts.all === 9 &&
    counts.active === 5 &&
    counts.draft === 1 &&
    counts.concluded === 2 &&
    counts.expired === 1,
);

check(
  "a request belongs to exactly one lifecycle filter",
  allCards.every((item) => exclusiveLifecycleFilters(item).length === 1) &&
    classifyMyRequestLifecycle("PUBLISHED") === "active" &&
    classifyMyRequestLifecycle("OFFER_SELECTED") === "active",
);

check(
  "same request is not double-counted inside a filter",
  countMyRequestFilters([actionCard, actionCard]).active === 1,
);

check(
  "CTA matrix uses real routes",
  actionCard.primaryCta.kind === "review_offers" &&
    actionCard.primaryCta.href.includes("/panel/gelen-teklifler/req-action") &&
    newOfferCard.primaryCta.label === "Teklifleri incele" &&
    negotiatingCard.primaryCta.href.includes("durum=pazarlik") &&
    progressCard.primaryCta.href === "/panel/mesajlar/conv-2" &&
    draftCard.primaryCta.href === "/panel/taleplerim/req-draft/duzenle" &&
    draftCard.primaryCta.label === "Düzenlemeye devam et" &&
    waitingCard.primaryCta.href === "/panel/taleplerim/req-wait" &&
    doneCard.primaryCta.label === "Süreci görüntüle" &&
    doneCard.primaryCta.kind === "view_process" &&
    doneCard.primaryCta.href === "/panel/taleplerim/req-done#surec" &&
    expiredCard.primaryCta.label === "Talebi görüntüle" &&
    resolveMyRequestPrimaryCta({
      requestId: "x",
      lifecycle: "draft",
      lane: "draft",
      conversationId: null,
      unreadCount: 0,
    }).kind === "continue_edit",
);

check(
  "no invented list-level Yayınla CTA",
  !cardFile.includes("Yayınla") &&
    !home.includes("Yayınla") &&
    draftCard.primaryCta.label !== "Yayınla",
);

check(
  "delete stays on existing soft-delete API and confirmation",
  overflow.includes("/api/requests/") &&
    overflow.includes('method: "DELETE"') &&
    overflow.includes("Bu talebi silmek istediğinize emin misiniz?") &&
    overflow.includes("Talebi sil") &&
    !page.includes("DeleteRequestButton") &&
    deleteRequest.includes("createdById: userId") &&
    deleteRequest.includes("deletedAt: new Date()"),
);

check(
  "terminal requests cannot be deleted in UI or server policy",
  doneCard.canDelete === false &&
    cancelledCard.canDelete === false &&
    expiredCard.canDelete === false &&
    draftCard.canDelete === true &&
    waitingCard.canDelete === true &&
    canDeleteMyRequestStatus("COMPLETED") === false &&
    canDeleteMyRequestStatus("CANCELLED") === false &&
    canDeleteMyRequestStatus("EXPIRED") === false &&
    canDeleteMyRequestStatus("DRAFT") === true &&
    canDeleteMyRequestStatus("PUBLISHED") === true &&
    deleteRequest.includes("REQUEST_DELETE_BLOCKED_STATUSES") &&
    deleteRequest.includes('"COMPLETED"') &&
    deleteRequest.includes('"CANCELLED"') &&
    deleteRequest.includes('"EXPIRED"') &&
    deleteRequest.includes("RequestDeleteNotAllowedError") &&
    deleteApi.includes("status: 409") &&
    detail.includes("canDeleteRequestStatus") &&
    cardFile.includes("showOverflow") &&
    !cardFile.includes("Talebi sil"),
);

check(
  "empty all-state CTA goes to /talep",
  header.includes('href="/talep"') &&
    home.includes("Henüz talebiniz yok") &&
    home.includes("Bu filtrede talep yok"),
);

check(
  "request media uses CategoryVisualThumb fallback",
  cardFile.includes("CategoryVisualThumb") &&
    cardFile.includes("coverImageUrl={request.coverImageUrl}") &&
    loader.includes("coverImageUrl: true"),
);

check(
  "budget and location nulls stay off the card",
  formatMyRequestLocation(null, null) === null &&
    formatMyRequestLocation("İstanbul", "Kadıköy") === "İstanbul · Kadıköy" &&
    formatMyRequestLocation("Karabük / Safranbolu", "Safranbolu") ===
      "Karabük / Safranbolu" &&
    formatMyRequestLocation("Ankara", "  ") === "Ankara" &&
    waitingCard.locationLabel === "İzmir" &&
    waitingCard.budgetLabel === null &&
    newOfferCard.budgetLabel === null,
);

check(
  "Standard/Professional parity: no plan branching on Taleplerim",
  !page.includes("planTier") &&
    !home.includes("PlanBadge") &&
    !home.includes("Professional") &&
    !home.includes("STANDART") &&
    shell.includes("<PlanBadge"),
);

check(
  "mobile CTA and overflow stay 44px and in-viewport",
  cardFile.includes("min-h-11") &&
    overflow.includes("min-h-11") &&
    overflow.includes("calc(100vw-1rem)") &&
    filters.includes("overflow-x-auto") &&
    filters.includes("Daha fazla") &&
    filters.includes("shrink-0"),
);

check(
  "filter chips expose aria-current and Escape closes disclosure",
  filters.includes("aria-current") &&
    filters.includes('event.key === "Escape"') &&
    popover.includes('event.key === "Escape"') &&
    overflow.includes("aria-expanded"),
);

check(
  "page does not copy Sayfam dark hero or Talepler slate banner",
  !header.includes("talepo-beacon-hero") &&
    !home.includes("talepo-explore-banner") &&
    css.includes(".talepo-my-requests-banner") &&
    header.includes("talepo-my-requests-banner"),
);

check(
  "no email, phone, or internal id dump on the list surface",
  !home.includes("email") &&
    !cardFile.includes("phone") &&
    !page.includes("createdBy") &&
    filterMyRequests([actionCard, draftCard], "draft")[0]?.id === "req-draft",
);

check(
  "incoming offer signals reuse buyer loader, not a new API",
  loader.includes("loadBuyerIncomingOffers") &&
    loader.includes("aggregateIncomingRequestGroups") &&
    !loader.includes("prisma.$executeRaw") &&
    page.includes("loadMyRequestsHome"),
);

check(
  "loading and error states exist",
  loading.includes("talepo-my-requests-banner") &&
    loading.includes("min-h-[8.75rem]") &&
    read("src/app/panel/taleplerim/error.tsx").includes(
      "Taleplerim şu an açılamadı",
    ),
);

const bannerCounts = summarizeMyRequestBanner([...allCards, actionCard]);

check(
  "banner metrics use exclusive lifecycle counts",
  bannerCounts.totalCount === 9 &&
    bannerCounts.activeCount === 5 &&
    bannerCounts.concludedCount === 2 &&
    bannerCounts.expiredCount === 1 &&
    bannerCounts.activeCount +
      bannerCounts.concludedCount +
      bannerCounts.expiredCount +
      1 ===
      bannerCounts.totalCount,
);

check(
  "zero expired is omitted, empty copy stays calm",
  myRequestBannerExpiredCopy(0) === null &&
    myRequestBannerExpiredCopy(2) === "2 talebin süresi doldu" &&
    myRequestBannerMixCopy(1, 1) === "1 aktif · 1 sonuçlanan" &&
    myRequestBannerTotalLabel(0) === null &&
    myRequestBannerTotalLabel(1) === "Toplam 1 talep" &&
    !header.includes("0 talep") &&
    header.includes("İlk talebini oluşturarak başlayabilirsin."),
);

check(
  "command header copy and CTA stay request lifecycle, not offer inbox",
  header.includes("KİŞİSEL TALEP MERKEZİ") &&
    header.includes("Oluşturduğun talepleri ve süreç durumlarını") &&
    !header.includes("gelen teklifleri") &&
    header.includes('href="/talep"') &&
    header.includes("Yeni talep") &&
    !header.includes("—") &&
    flow.includes("aria-hidden") &&
    flow.includes("Taslak") &&
    flow.includes("Yayında") &&
    flow.includes("Sonuç") &&
    !flow.includes("Teklif") &&
    !flow.includes("href"),
);

check(
  "Signal Rail talep-teklif order is marketplace first",
  TALEP_TEKLIF_NAV_HREFS.join(",") ===
    "/panel/talepler,/panel/taleplerim,/panel/gelen-teklifler,/panel/teklifler" &&
    rail.includes("TALEP_TEKLIF_NAV_HREFS") &&
    nav.indexOf('href: "/panel/talepler"') <
      nav.indexOf('href: "/panel/taleplerim"') &&
    (publicHeader.includes("Talepleri keşfet") ||
      (publicHeader.includes("PanelAccountMenu") &&
        accountMenu.includes("Talepleri keşfet"))) &&
    shell.includes('return "Talepleri keşfet"'),
);

check(
  "segment-safe active matching separates talepler and taleplerim",
  isPanelNavActive("/panel/talepler", "/panel/talepler") &&
    isPanelNavActive("/panel/talepler/abc", "/panel/talepler") &&
    !isPanelNavActive("/panel/taleplerim", "/panel/talepler") &&
    !isPanelNavActive("/panel/taleplerim/abc", "/panel/talepler") &&
    isPanelNavActive("/panel/taleplerim", "/panel/taleplerim") &&
    isPanelNavActive("/panel/taleplerim/abc", "/panel/taleplerim") &&
    !isPanelNavActive("/panel/talepler/abc", "/panel/taleplerim") &&
    shell.includes("isPanelNavActive") &&
    rail.includes("isPanelNavActive"),
);

check(
  "visible expired copy is Süresi dolan, internal EXPIRED and suresi stay",
    MY_REQUEST_FILTER_LABEL.expired === "Süresi dolan" &&
    MY_REQUEST_FILTER_EMPTY.expired === "Süresi dolan talebiniz yok." &&
    !surface.includes("Süresi geçen") &&
    !header.includes("Süresi geçen") &&
    !home.includes("Süresi geçen") &&
    !cardFile.includes("Süresi geçen") &&
    !filters.includes("Süresi geçen") &&
    !loading.includes("Süresi geçen") &&
    surface.includes('suresi: "expired"') &&
    surface.includes('expired: "suresi"') &&
    parseMyRequestsFilter("suresi") === "expired" &&
    buildMyRequestsPath("expired") === "/panel/taleplerim?durum=suresi" &&
    surface.includes('EXPIRED: "Süresi doldu"'),
);

check("concluded clone CTA on card model", doneCard.canCloneAsDraft === true);
check("cancelled clone CTA on card model", cancelledCard.canCloneAsDraft === true);
check("expired cannot clone as draft", expiredCard.canCloneAsDraft === false);
check("draft cannot clone as draft", draftCard.canCloneAsDraft === false);
check("active cannot clone as draft", waitingCard.canCloneAsDraft === false);
check(
  "clone status policy COMPLETED/CANCELLED only",
  canCloneMyRequestAsDraft("COMPLETED") &&
    canCloneMyRequestAsDraft("CANCELLED") &&
    !canCloneMyRequestAsDraft("EXPIRED") &&
    !canCloneMyRequestAsDraft("PUBLISHED"),
);
check("clone service creates DRAFT without updating source", cloneService.includes('status: "DRAFT"') && !cloneService.includes("tx.request.update"));
check("clone API uses owner session", cloneApi.includes("cloneRequestAsDraft") && cloneApi.includes("requireUser"));
check("clone copy uses recommended confirmation", cloneControl.includes("Taslak olarak yeniden oluştur") && cloneControl.includes("Bu talebi yeniden kullanmak ister misiniz?") && cloneControl.includes("Talep bilgileri yeni bir taslağa kopyalanır") && cloneControl.includes("Taslak oluştur") && cloneControl.includes("Vazgeç") && cloneControl.includes('role="dialog"') && cloneControl.includes('event.key === "Escape"'));
check("clone has idempotency and loading lock", cloneControl.includes("Idempotency-Key") && cloneControl.includes("disabled={loading}"));
check(
  "overflow menu portals through collision-aware popover",
  overflow.includes("PanelCollisionPopover") &&
    overflow.includes('aria-label="Talep işlemleri"') &&
    overflow.includes('aria-haspopup="menu"') &&
    overflow.includes("aria-expanded") &&
    overflow.includes("aria-controls") &&
    overflow.includes("preventScroll: true") &&
    popover.includes("createPortal") &&
    popover.includes("document.body") &&
    popover.includes("data-collision-popover") &&
    popover.includes('position: "fixed"') &&
    popover.includes("placeCollisionPopover") &&
    popover.includes("preventScroll: true") &&
    collision.includes("MOBILE_COLLISION_PADDING") &&
    collision.includes("bottom: 88") &&
    !overflow.includes("absolute right-0") &&
    !overflow.includes("scrollIntoView"),
);

check(
  "concluded overflow keeps clone and drops duplicate process CTA",
  overflow.includes("CloneRequestAsDraftControl") &&
    overflow.includes('primaryCta.kind !== "view_process"') &&
    !overflow.includes("Süreci görüntüle") &&
    !overflow.includes("Taşı"),
);

const nearBottomMenu = placeCollisionPopover({
  trigger: { top: 700, left: 1100, width: 44, height: 44 },
  menu: { width: 216, height: 52 },
  viewport: { width: 1440, height: 780 },
  align: "end",
});
check(
  "near-bottom overflow flips above the trigger and stays in viewport",
  nearBottomMenu.side === "top" &&
    nearBottomMenu.top >= 8 &&
    nearBottomMenu.top + 52 <= 780 - 8 &&
    Math.abs(nearBottomMenu.left + 216 - (1100 + 44)) < 1,
);

const roomBelowMenu = placeCollisionPopover({
  trigger: { top: 120, left: 1100, width: 44, height: 44 },
  menu: { width: 216, height: 52 },
  viewport: { width: 1440, height: 780 },
  align: "end",
});
check(
  "overflow opens below when there is room",
  roomBelowMenu.side === "bottom" && roomBelowMenu.top > 120 + 44,
);

const mobileMenu = placeCollisionPopover({
  trigger: { top: 720, left: 330, width: 44, height: 44 },
  menu: { width: 240, height: 52 },
  viewport: { width: 390, height: 844 },
  padding: collisionPaddingForViewport(390),
  align: "end",
});
check(
  "mobile overflow stays above the bottom nav",
  mobileMenu.side === "top" &&
    mobileMenu.top >= 8 &&
    mobileMenu.top + 52 <= 844 - 88 &&
    mobileMenu.left >= 8 &&
    mobileMenu.left + 240 <= 390 - 8,
);
check("card wires canCloneAsDraft", cardFile.includes("canCloneAsDraft"));
check("detail uses cloneRequestAsDraft gate", detail.includes("canCloneRequestAsDraft"));
check("edit shows clone success", edit.includes("cloneSuccess"));
check("authz documents clone endpoint", authz.includes("cloneRequestAsDraft"));

check(
  "clone copies safe fields and skips process relations",
  cloneService.includes("title: source.title") &&
    cloneService.includes("description: source.description") &&
    cloneService.includes("professionalDescription: source.professionalDescription") &&
    cloneService.includes("city: source.city") &&
    cloneService.includes("district: source.district") &&
    cloneService.includes("budgetMin: source.budgetMin") &&
    cloneService.includes("cloneSafeCoverImageUrl(source.coverImageUrl)") &&
    cloneService.includes("fieldValues") &&
    cloneService.includes("void input?.companyId") &&
    cloneService.includes("resolveCloneCompanyId") &&
    !cloneService.includes("discoveryProjection: source.discoveryProjection") &&
    !cloneService.includes("companyId: source.companyId") &&
    !cloneService.includes("offers:") &&
    !cloneService.includes("negotiations:") &&
    !cloneService.includes("publishedAt: source.publishedAt") &&
    !cloneService.includes("completedAt: source.completedAt") &&
    !cloneService.includes("viewCount: source.viewCount") &&
    !cloneService.includes("offerCount: source.offerCount") &&
    !cloneService.includes("deadlineAt: source.deadlineAt") &&
    !cloneService.includes("expiresAt: source.expiresAt"),
);

check(
  "company clone reuses workspace write authority and stays fail-closed",
  cloneService.includes("canMutateCompanyWorkspace") &&
    cloneService.includes('status: "ACTIVE"') &&
    cloneService.includes("prisma.$transaction") &&
    cloneService.includes("tx.request.create") &&
    cloneService.includes("tx.idempotencyRecord.create") &&
    cloneService.includes("isCloneUniqueConflict") &&
    !cloneService.includes("COMPANY_REQUEST_CLONE_ROLES") &&
    !cloneService.includes("saveIdempotentResource") &&
    companyWorkspace.includes("export function canMutateCompanyWorkspace") &&
    companyWorkspace.includes('role !== "VIEWER"') &&
    cloneApi.includes("Body companyId/userId/status are ignored"),
);

const cancelledHistory = buildConcludedProcessHistory({
  status: "CANCELLED",
  createdAt: "2026-08-01T08:00:00.000Z",
  publishedAt: "2026-08-01T09:00:00.000Z",
  cancelledAt: "2026-08-03T12:00:00.000Z",
  offers: [
    {
      id: "off-1",
      status: "REJECTED",
      amount: 4000,
      currency: "TRY",
      createdAt: "2026-08-02T10:00:00.000Z",
      submittedAt: "2026-08-02T10:00:00.000Z",
      companyName: "Örnek Firma",
      submittedByName: "Ali",
      negotiations: [
        {
          id: "neg-1",
          amount: 3500,
          currency: "TRY",
          proposedBySide: "BUYER",
          status: "REJECTED",
          createdAt: "2026-08-02T11:00:00.000Z",
          respondedAt: "2026-08-02T12:00:00.000Z",
        },
      ],
    },
  ],
});

const completedHistory = buildConcludedProcessHistory({
  status: "COMPLETED",
  createdAt: "2026-08-01T08:00:00.000Z",
  publishedAt: "2026-08-01T09:00:00.000Z",
  completedAt: "2026-08-10T18:00:00.000Z",
  offers: [
    {
      id: "off-win",
      status: "ACCEPTED",
      amount: 8000,
      currency: "TRY",
      createdAt: "2026-08-02T10:00:00.000Z",
      submittedAt: "2026-08-02T10:00:00.000Z",
      acceptedAt: "2026-08-04T15:00:00.000Z",
      companyName: "Seçilen Firma",
      submittedByName: "Ayşe",
      conversationId: "conv-1",
      conversationCreatedAt: "2026-08-04T15:01:00.000Z",
      negotiations: [
        {
          id: "neg-old",
          amount: 7500,
          currency: "TRY",
          proposedBySide: "BUYER",
          status: "REJECTED",
          createdAt: "2026-08-03T10:00:00.000Z",
          respondedAt: "2026-08-03T11:00:00.000Z",
        },
        {
          id: "neg-win",
          amount: 7200,
          currency: "TRY",
          proposedBySide: "PROVIDER",
          status: "ACCEPTED",
          createdAt: "2026-08-04T14:00:00.000Z",
          respondedAt: "2026-08-04T15:00:00.000Z",
        },
      ],
    },
    {
      id: "off-other",
      status: "REJECTED",
      amount: 9000,
      currency: "TRY",
      createdAt: "2026-08-02T12:00:00.000Z",
      submittedAt: "2026-08-02T12:00:00.000Z",
      companyName: "Diğer Firma",
      negotiations: [],
    },
  ],
  dealOutcomes: [
    {
      status: "COMPLETED",
      agreedPrice: 7200,
      currency: "TRY",
      completedAt: "2026-08-10T18:00:00.000Z",
      buyerConfirmedAt: "2026-08-09T10:00:00.000Z",
      supplierConfirmedAt: "2026-08-10T18:00:00.000Z",
      conversationId: "conv-1",
      reviews: [
        {
          id: "rev-1",
          reviewerSide: "BUYER",
          createdAt: "2026-08-11T09:00:00.000Z",
        },
      ],
    },
  ],
});

const unpublishedHistory = buildConcludedProcessHistory({
  status: "CANCELLED",
  createdAt: "2026-08-01T08:00:00.000Z",
  offers: [],
});

const invertedPublishHistory = buildConcludedProcessHistory({
  status: "COMPLETED",
  createdAt: "2026-08-16T12:00:00.000Z",
  publishedAt: "2026-08-16T11:59:00.000Z",
  completedAt: "2026-08-18T12:00:00.000Z",
  offers: [],
});

const tiedPublishHistory = buildConcludedProcessHistory({
  status: "COMPLETED",
  createdAt: "2026-08-16T12:00:00.000Z",
  publishedAt: "2026-08-16T12:00:00.000Z",
  completedAt: "2026-08-18T12:00:00.000Z",
  offers: [],
});

check(
  "process history shows only evidenced events in chronological order",
  cancelledHistory.events.map((event) => event.id).join(",") ===
    "created,published,offers-arrived,negotiations,cancelled" &&
    !cancelledHistory.events.some((event) => event.id === "offer-accepted") &&
    !cancelledHistory.events.some((event) => event.id === "completed") &&
    unpublishedHistory.events.map((event) => event.id).join(",") === "created" &&
    invertedPublishHistory.events.map((event) => event.id).join(",") ===
      "created,published,completed" &&
    tiedPublishHistory.events.map((event) => event.id).join(",") ===
      "created,published,completed" &&
    completedHistory.events.map((event) => event.id).join(",") ===
      "created,published,offers-arrived,negotiations,offer-accepted,messaging,buyer-confirmed,supplier-confirmed,completed,review-rev-1" &&
    completedHistory.offers[0]?.accepted === true &&
    completedHistory.offers[0]?.sellerName === "Seçilen Firma" &&
    completedHistory.offers[1]?.accepted === false &&
    completedHistory.offers[1]?.statusLabel === "Reddedildi" &&
    completedHistory.offers[0]?.negotiations.some(
      (row) => row.status === "REJECTED",
    ) &&
    completedHistory.summary.conversationHref === "/panel/mesajlar/conv-1" &&
    completedHistory.summary.reviewHref === "/panel/mesajlar/conv-1" &&
    cancelledHistory.summary.conversationHref === null &&
    cancelledHistory.summary.reviewHref === null &&
    completedHistory.summary.agreedAmountLabel?.includes("7.200") &&
    completedHistory.summary.negotiationRoundCount === 2,
);

check(
  "process history UI stays owner-detail and private-data free",
  processPanel.includes("Süreç geçmişi") &&
    processPanel.includes("Teklif ve pazarlık geçmişi") &&
    processPanel.includes("NegotiationHistory") &&
    processPanel.includes("Mesajlara git") &&
    processPanel.includes("Değerlendirmeyi görüntüle") &&
    detail.includes("ConcludedProcessPanel") &&
    detail.includes("createdById: user.id") &&
    !processHistory.includes("email") &&
    !processHistory.includes("phone") &&
    !processHistory.includes("submittedByEmail") &&
    !processPanel.includes("email") &&
    !cloneService.includes("email"),
);

async function liveCloneChecks() {
  const { config: loadDotenv } = await import("dotenv");
  loadDotenv({ path: join(ROOT, ".env") });
  loadDotenv({ path: join(ROOT, ".env.local"), override: true });

  const hasDb = Boolean(
    process.env.DATABASE_URL?.trim() || process.env.DIRECT_URL?.trim(),
  );
  if (!hasDb) {
    check("live clone skipped (no DATABASE_URL)", false, "env missing");
    return;
  }

  /**
   * YAZMA KAPISI (KB-9, kurucu 2026-08-23). Gerçek prisma yazması var ve
   * `.env` ortak Supabase'e bakıyor; kapı geçilmezse prisma import edilmez.
   */
  const { canWriteToDatabase } = await import(
    "../src/lib/verification/db-guard"
  );
  const guard = canWriteToDatabase();
  if (!guard.allowed) {
    console.log(`NOT-MEASURED — live clone: ${guard.reason}`);
    return;
  }

  const { prisma } = await import("../src/lib/prisma");
  const { createRequest } = await import(
    "../src/server/request/create-request"
  );
  const {
    cloneRequestAsDraft,
    cloneSafeCoverImageUrl,
    canCloneCompanyScopedRequest,
    RequestCloneNotAllowedError,
  } = await import("../src/server/request/clone-request-as-draft");
  const {
    deleteRequest,
    RequestDeleteNotAllowedError,
  } = await import("../src/server/request/delete-request");
  const { parseCreateRequestInput } = await import(
    "../src/server/request/request-schema"
  );

  const BUYER_EMAIL = "e2e-alici-20260817184814@talepo.test";
  const createdIds: string[] = [];
  const companyIds: string[] = [];
  const extraUserIds: string[] = [];
  let sourceId: string | null = null;
  let offerId: string | null = null;

  async function cleanup() {
    for (const id of createdIds.reverse()) {
      await prisma.offerNegotiation
        .deleteMany({ where: { requestId: id } })
        .catch(() => undefined);
      await prisma.offer.deleteMany({ where: { requestId: id } }).catch(() => undefined);
      await prisma.notification
        .deleteMany({ where: { requestId: id } })
        .catch(() => undefined);
      await prisma.priceObservation
        .deleteMany({ where: { requestId: id } })
        .catch(() => undefined);
      await prisma.requestMatch
        .deleteMany({ where: { requestId: id } })
        .catch(() => undefined);
      await prisma.requestFieldValue
        .deleteMany({ where: { requestId: id } })
        .catch(() => undefined);
      await prisma.idempotencyRecord
        .deleteMany({ where: { resourceId: id } })
        .catch(() => undefined);
      await prisma.request.delete({ where: { id } }).catch(() => undefined);
    }
    if (companyIds.length > 0) {
      await prisma.companyMember
        .deleteMany({ where: { companyId: { in: companyIds } } })
        .catch(() => undefined);
      await prisma.company
        .deleteMany({ where: { id: { in: companyIds } } })
        .catch(() => undefined);
    }
    if (extraUserIds.length > 0) {
      await prisma.idempotencyRecord
        .deleteMany({ where: { userId: { in: extraUserIds } } })
        .catch(() => undefined);
      await prisma.request
        .deleteMany({ where: { createdById: { in: extraUserIds } } })
        .catch(() => undefined);
      await prisma.companyMember
        .deleteMany({ where: { userId: { in: extraUserIds } } })
        .catch(() => undefined);
      await prisma.company
        .deleteMany({ where: { createdById: { in: extraUserIds } } })
        .catch(() => undefined);
      await prisma.user
        .deleteMany({ where: { id: { in: extraUserIds } } })
        .catch(() => undefined);
    }
  }

  try {
    const buyer = await prisma.user.findUnique({
      where: { email: BUYER_EMAIL },
      select: { id: true },
    });
    const other = await prisma.user.findFirst({
      where: { email: { not: BUYER_EMAIL } },
      select: { id: true },
    });
    if (!buyer) {
      check("live clone buyer exists", false, "buyer not found");
      return;
    }
    check("live clone buyer exists", true);
    check(
      "cover clone helper keeps public request URLs and drops signed ones",
      cloneSafeCoverImageUrl("https://upload.wikimedia.org/cover.jpg") ===
        "https://upload.wikimedia.org/cover.jpg" &&
        cloneSafeCoverImageUrl("/media/request-cover.webp") ===
          "/media/request-cover.webp" &&
        cloneSafeCoverImageUrl("https://cdn.example/x?X-Amz-Signature=abc") ===
          null &&
        cloneSafeCoverImageUrl("/api/offers/o1/media/m1") === null &&
        cloneSafeCoverImageUrl("ftp://evil") === null,
    );
    check(
      "company clone roles exclude VIEWER",
      canCloneCompanyScopedRequest("OWNER") &&
        canCloneCompanyScopedRequest("ADMIN") &&
        canCloneCompanyScopedRequest("MANAGER") &&
        canCloneCompanyScopedRequest("MEMBER") &&
        !canCloneCompanyScopedRequest("VIEWER") &&
        !canCloneCompanyScopedRequest(""),
    );

    const created = await createRequest(
      buyer.id,
      parseCreateRequestInput({
        title: "Clone fixture ofis koltuğu",
        description:
          "Sentetik clone testi için ofis koltuğu talebi, en az on karakter.",
        category: { slug: "furniture", name: "Mobilya ve Ofis" },
        city: "İstanbul",
        district: "Kadıköy",
        quantity: "2",
        budget: "5000",
        publishVersion: "ai",
        fields: [
          {
            key: "furnitureType",
            label: "Ürün türü",
            type: "text",
            required: true,
            value: "Ofis koltuğu",
          },
        ],
      }),
    );
    sourceId = created.id;
    createdIds.push(created.id);
    const sourceMeta = await prisma.request.findUnique({
      where: { id: created.id },
      select: { categoryId: true },
    });
    const categoryId = sourceMeta?.categoryId;
    if (!categoryId) {
      check("live clone source has category", false, "categoryId missing");
      return;
    }

    if (other) {
      const offer = await prisma.offer.create({
        data: {
          requestId: created.id,
          submittedById: other.id,
          description: "Sentetik teklif",
          amount: 4500,
          status: "REJECTED",
        },
        select: { id: true },
      });
      offerId = offer.id;
      await prisma.offerNegotiation.create({
        data: {
          offerId: offer.id,
          requestId: created.id,
          proposedByUserId: buyer.id,
          proposedBySide: "BUYER",
          amount: 4000,
          currency: "TRY",
          status: "REJECTED",
        },
      });
    }

    await prisma.request.update({
      where: { id: created.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        companyId: null,
        professionalDescription: "Kullanıcı tarafından yazılmış ofis koltuğu notu.",
        discoveryProjection: { version: "fixture", kind: "derived" },
        coverImageUrl: "https://upload.wikimedia.org/wikipedia/commons/cover.jpg",
      },
    });

    const before = await prisma.request.findUnique({
      where: { id: created.id },
      select: {
        id: true,
        status: true,
        title: true,
        city: true,
        offerCount: true,
        completedAt: true,
        professionalDescription: true,
        _count: { select: { offers: true, negotiations: true } },
      },
    });

    const draft = await cloneRequestAsDraft(buyer.id, created.id, {
      idempotencyKey: "clone-draft-live-idem-01",
    });
    createdIds.push(draft.id);

    const replay = await cloneRequestAsDraft(buyer.id, created.id, {
      idempotencyKey: "clone-draft-live-idem-01",
    });
    const after = await prisma.request.findUnique({
      where: { id: created.id },
      select: {
        id: true,
        status: true,
        title: true,
        city: true,
        completedAt: true,
        _count: { select: { offers: true, negotiations: true } },
      },
    });
    const cloned = await prisma.request.findUnique({
      where: { id: draft.id },
      include: {
        fieldValues: { include: { field: { select: { key: true } } } },
        _count: { select: { offers: true, negotiations: true } },
      },
    });

    check(
      "COMPLETED owner can clone a new DRAFT",
      draft.id !== created.id &&
        draft.status === "DRAFT" &&
        cloned?.status === "DRAFT" &&
        cloned.title === before?.title &&
        cloned.city === before?.city &&
        cloned.fieldValues.some((row) => row.field.key === "furnitureType"),
    );
    check("idempotent clone replay returns same draft id", replay.id === draft.id);
    check(
      "source request is unchanged after clone",
      after?.id === before?.id &&
        after?.status === "COMPLETED" &&
        after?.title === before?.title &&
        String(after?.completedAt) === String(before?.completedAt) &&
        after?._count.offers === before?._count.offers &&
        after?._count.negotiations === before?._count.negotiations,
    );
    check(
      "clone does not copy offers or negotiations",
      cloned?._count.offers === 0 && cloned?._count.negotiations === 0,
    );
    check(
      "personal source clone stays personal",
      cloned?.companyId === null,
    );
    check(
      "clone keeps user-authored professionalDescription",
      cloned?.professionalDescription === before?.professionalDescription,
    );
    check(
      "clone does not copy derived discoveryProjection",
      cloned?.discoveryProjection == null,
    );
    check(
      "clone keeps public request cover URL",
      cloned?.coverImageUrl ===
        "https://upload.wikimedia.org/wikipedia/commons/cover.jpg",
    );

    const spoofed = await cloneRequestAsDraft(buyer.id, created.id, {
      idempotencyKey: "clone-draft-live-spoof-01",
      companyId: "spoof-company-id",
    });
    createdIds.push(spoofed.id);
    const spoofedRow = await prisma.request.findUnique({
      where: { id: spoofed.id },
      select: { companyId: true },
    });
    check(
      "client companyId spoofing cannot attach a company to personal clone",
      spoofed.id !== draft.id && spoofedRow?.companyId === null,
    );

    const secondSource = await prisma.request.create({
      data: {
        createdById: buyer.id,
        categoryId,
        title: "İkinci clone kaynak koltuk",
        description: "Aynı idempotency anahtarının kaynaklar arası karışmaması.",
        status: "COMPLETED",
        completedAt: new Date(),
        city: "Ankara",
      },
      select: { id: true, categoryId: true },
    });
    createdIds.push(secondSource.id);
    const secondDraft = await cloneRequestAsDraft(buyer.id, secondSource.id, {
      idempotencyKey: "clone-draft-live-idem-01",
    });
    createdIds.push(secondDraft.id);
    check(
      "same client key on a different source does not replay the first draft",
      secondDraft.id !== draft.id && secondDraft.id !== spoofed.id,
    );

    let otherDenied = false;
    let otherKeyIsolated = true;
    if (other) {
      try {
        await cloneRequestAsDraft(other.id, created.id, {
          idempotencyKey: "clone-draft-live-idem-01",
        });
        otherDenied = false;
        otherKeyIsolated = false;
      } catch (error) {
        otherDenied =
          error instanceof Error &&
          (error.name === "RequestValidationError" ||
            error.message.includes("bulunamadı"));
      }
    }
    check("other user cannot clone owner request", !other || otherDenied);
    check(
      "other user cannot take owner draft via the same idempotency key",
      !other || (otherDenied && otherKeyIsolated),
    );

    let activeDenied = false;
    await prisma.request.update({
      where: { id: created.id },
      data: { status: "PUBLISHED", completedAt: null },
    });
    try {
      await cloneRequestAsDraft(buyer.id, created.id);
    } catch (error) {
      activeDenied = error instanceof RequestCloneNotAllowedError;
    }
    check("active request cannot be cloned", activeDenied);

    const failKey = "clone-draft-live-fail-01";
    let expiredDenied = false;
    await prisma.request.update({
      where: { id: created.id },
      data: { status: "EXPIRED" },
    });
    try {
      await cloneRequestAsDraft(buyer.id, created.id, {
        idempotencyKey: failKey,
      });
    } catch (error) {
      expiredDenied = error instanceof RequestCloneNotAllowedError;
    }
    const failedLock = await prisma.idempotencyRecord.findUnique({
      where: {
        userId_scope_key: {
          userId: buyer.id,
          scope: "request.clone_draft",
          key: `${created.id}:${failKey}`,
        },
      },
      select: { id: true },
    });
    check("EXPIRED request cannot be cloned in this round", expiredDenied);
    check(
      "failed clone does not persist an idempotency success lock",
      expiredDenied && failedLock == null,
    );

    await prisma.request.update({
      where: { id: created.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
      },
    });
    const cancelledDraft = await cloneRequestAsDraft(buyer.id, created.id, {
      idempotencyKey: failKey,
    });
    createdIds.push(cancelledDraft.id);
    const cancelledSource = await prisma.request.findUnique({
      where: { id: created.id },
      select: { status: true },
    });
    check(
      "CANCELLED owner can clone and source stays CANCELLED",
      cancelledDraft.status === "DRAFT" &&
        cancelledDraft.id !== created.id &&
        cancelledSource?.status === "CANCELLED",
    );
    check(
      "failed clone key can succeed after the source becomes cloneable",
      cancelledDraft.id !== draft.id,
    );

    const raceTitle = `Clone race koltuk ${Date.now()}`;
    const raceSource = await prisma.request.create({
      data: {
        createdById: buyer.id,
        categoryId,
        title: raceTitle,
        description: "Aynı anahtarla eşzamanlı clone tek taslak üretmeli.",
        status: "COMPLETED",
        completedAt: new Date(),
        city: "Bursa",
      },
      select: { id: true },
    });
    createdIds.push(raceSource.id);
    const raceKey = "clone-draft-live-race-01";
    const raceResults = await Promise.all(
      Array.from({ length: 8 }, () =>
        cloneRequestAsDraft(buyer.id, raceSource.id, {
          idempotencyKey: raceKey,
        }),
      ),
    );
    const raceIds = [...new Set(raceResults.map((row) => row.id))];
    createdIds.push(...raceIds);
    const raceDrafts = await prisma.request.findMany({
      where: {
        createdById: buyer.id,
        title: raceTitle,
        status: "DRAFT",
        deletedAt: null,
      },
      select: { id: true },
    });
    const raceRecords = await prisma.idempotencyRecord.findMany({
      where: {
        userId: buyer.id,
        scope: "request.clone_draft",
        key: `${raceSource.id}:${raceKey}`,
      },
      select: { id: true, resourceId: true },
    });
    check(
      "concurrent same-key clones create one draft and one idempotency record",
      raceIds.length === 1 &&
        raceDrafts.length === 1 &&
        raceRecords.length === 1 &&
        raceDrafts[0]?.id === raceIds[0] &&
        raceRecords[0]?.resourceId === raceIds[0] &&
        raceResults.every((row) => row.id === raceIds[0]),
    );

    const stamp = `clone-authz-${Date.now()}`;
    const companyA = await prisma.company.create({
      data: {
        name: `${stamp}-a`,
        slug: `${stamp}-a`,
        createdById: buyer.id,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    const companyB = await prisma.company.create({
      data: {
        name: `${stamp}-b`,
        slug: `${stamp}-b`,
        createdById: buyer.id,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    companyIds.push(companyA.id, companyB.id);
    await prisma.companyMember.create({
      data: {
        companyId: companyA.id,
        userId: buyer.id,
        role: "OWNER",
        status: "ACTIVE",
        joinedAt: new Date(),
      },
    });

    const companySource = await prisma.request.create({
      data: {
        createdById: buyer.id,
        companyId: companyA.id,
        categoryId,
        title: "Firma clone kaynak koltuk",
        description: "Aktif yetkili üye firma talebini kopyalar.",
        professionalDescription: "Firma talep notu.",
        status: "COMPLETED",
        completedAt: new Date(),
        city: "İzmir",
      },
      select: { id: true },
    });
    createdIds.push(companySource.id);

    const companyDraft = await cloneRequestAsDraft(buyer.id, companySource.id, {
      idempotencyKey: "clone-company-ok-0001",
    });
    createdIds.push(companyDraft.id);
    const companyDraftRow = await prisma.request.findUnique({
      where: { id: companyDraft.id },
      select: { companyId: true, status: true },
    });
    check(
      "active authorized company member clones into the same company scope",
      companyDraftRow?.status === "DRAFT" &&
        companyDraftRow.companyId === companyA.id,
    );

    const companySpoof = await cloneRequestAsDraft(buyer.id, companySource.id, {
      idempotencyKey: "clone-company-spoof-01",
      companyId: companyB.id,
    });
    createdIds.push(companySpoof.id);
    const companySpoofRow = await prisma.request.findUnique({
      where: { id: companySpoof.id },
      select: { companyId: true },
    });
    check(
      "client companyId spoofing cannot retarget a company clone",
      companySpoof.id !== companyDraft.id &&
        companySpoofRow?.companyId === companyA.id,
    );

    for (const role of ["ADMIN", "MANAGER", "MEMBER"] as const) {
      await prisma.companyMember.update({
        where: {
          companyId_userId: { companyId: companyA.id, userId: buyer.id },
        },
        data: { status: "ACTIVE", role },
      });
      const roleDraft = await cloneRequestAsDraft(buyer.id, companySource.id, {
        idempotencyKey: `clone-company-role-${role.toLowerCase()}`,
      });
      createdIds.push(roleDraft.id);
      const roleRow = await prisma.request.findUnique({
        where: { id: roleDraft.id },
        select: { companyId: true, status: true },
      });
      check(
        `${role} can clone a company-scoped request into the same company`,
        roleDraft.id !== companyDraft.id &&
          roleRow?.status === "DRAFT" &&
          roleRow.companyId === companyA.id,
      );
    }

    await prisma.companyMember.update({
      where: {
        companyId_userId: { companyId: companyA.id, userId: buyer.id },
      },
      data: { status: "INVITED", role: "OWNER" },
    });
    let invitedDenied = false;
    try {
      await cloneRequestAsDraft(buyer.id, companySource.id, {
        idempotencyKey: "clone-company-invited-01",
      });
    } catch (error) {
      invitedDenied = error instanceof RequestCloneNotAllowedError;
    }
    check("inactive membership cannot clone a company request", invitedDenied);

    await prisma.companyMember.update({
      where: {
        companyId_userId: { companyId: companyA.id, userId: buyer.id },
      },
      data: { status: "REMOVED", removedAt: new Date(), role: "OWNER" },
    });
    let removedDenied = false;
    try {
      await cloneRequestAsDraft(buyer.id, companySource.id, {
        idempotencyKey: "clone-company-removed-01",
      });
    } catch (error) {
      removedDenied = error instanceof RequestCloneNotAllowedError;
    }
    check("removed company member cannot clone a company request", removedDenied);

    await prisma.companyMember.update({
      where: {
        companyId_userId: { companyId: companyA.id, userId: buyer.id },
      },
      data: {
        status: "ACTIVE",
        role: "VIEWER",
        removedAt: null,
        joinedAt: new Date(),
      },
    });
    let viewerDenied = false;
    try {
      await cloneRequestAsDraft(buyer.id, companySource.id, {
        idempotencyKey: "clone-company-viewer-01",
      });
    } catch (error) {
      viewerDenied = error instanceof RequestCloneNotAllowedError;
    }
    check("VIEWER cannot clone a company-scoped request", viewerDenied);

    await prisma.companyMember.update({
      where: {
        companyId_userId: { companyId: companyA.id, userId: buyer.id },
      },
      data: { status: "ACTIVE", role: "MEMBER" },
    });
    await prisma.request.update({
      where: { id: companySource.id },
      data: { companyId: companyB.id },
    });
    let wrongCompanyDenied = false;
    try {
      await cloneRequestAsDraft(buyer.id, companySource.id, {
        idempotencyKey: "clone-company-wrong-01",
      });
    } catch (error) {
      wrongCompanyDenied = error instanceof RequestCloneNotAllowedError;
    }
    const leakedPersonal = await prisma.request.findFirst({
      where: {
        createdById: buyer.id,
        title: "Firma clone kaynak koltuk",
        status: "DRAFT",
        companyId: null,
      },
      select: { id: true },
    });
    check(
      "wrong company workspace cannot clone the source",
      wrongCompanyDenied,
    );
    check(
      "unauthorized company clone does not silently become personal",
      leakedPersonal == null,
    );

    const adminUser = await prisma.user.create({
      data: {
        email: `clone-admin-${stamp}@talepo.test`,
        membershipNumber: `TLP-ADM-${stamp}`,
        name: "Clone Admin Fixture",
        platformRole: "ADMIN",
      },
      select: { id: true },
    });
    extraUserIds.push(adminUser.id);
    const adminCompany = await prisma.company.create({
      data: {
        name: `${stamp}-admin-co`,
        slug: `${stamp}-admin-co`,
        createdById: adminUser.id,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    companyIds.push(adminCompany.id);
    const adminSource = await prisma.request.create({
      data: {
        createdById: adminUser.id,
        companyId: adminCompany.id,
        categoryId,
        title: "Admin membershipsiz clone kaynak",
        description: "Platform ADMIN tek başına firma membership sağlamaz.",
        status: "COMPLETED",
        completedAt: new Date(),
        city: "Ankara",
      },
      select: { id: true },
    });
    createdIds.push(adminSource.id);
    let platformAdminDenied = false;
    try {
      await cloneRequestAsDraft(adminUser.id, adminSource.id, {
        idempotencyKey: "clone-platform-admin-01",
      });
    } catch (error) {
      platformAdminDenied = error instanceof RequestCloneNotAllowedError;
    }
    const adminLeak = await prisma.request.findFirst({
      where: {
        createdById: adminUser.id,
        title: "Admin membershipsiz clone kaynak",
        status: "DRAFT",
      },
      select: { id: true, companyId: true },
    });
    check(
      "platform ADMIN without company membership cannot clone a company request",
      platformAdminDenied && adminLeak == null,
    );

    let deleteDenied = false;
    try {
      await deleteRequest(buyer.id, created.id);
    } catch (error) {
      deleteDenied = error instanceof RequestDeleteNotAllowedError;
    }
    check("terminal DELETE still blocked with 409 authority", deleteDenied);

    void offerId;
  } catch (error) {
    check(
      "live cloneRequestAsDraft",
      false,
      error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    );
  } finally {
    await cleanup();
    const leftover = sourceId
      ? await prisma.request.findUnique({
          where: { id: sourceId },
          select: { id: true },
        })
      : null;
    check("clone fixture cleanup removed synthetic rows", leftover == null);
    await prisma.$disconnect();
  }
}

async function main() {
  await liveCloneChecks();
  if (fail > 0) {
    console.log(`\n${fail} failed, ${pass} passed`);
    process.exit(1);
  }
  console.log(`\nOK ${pass}/${pass} — Taleplerim surface V1`);
}

void main();
