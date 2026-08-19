/**
 * Sayfam focus dashboard — authority, routes, preview isolation.
 * Run: npx tsx scripts/verify-sayfam-home-v1.ts
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

const panelPage = read("src/app/panel/page.tsx");
const sayfamData = read("src/lib/panel/sayfam-home-data.ts");
const sayfamHome = read("src/components/panel/sayfam/PanelSayfamHome.tsx");
const carousel = read("src/components/panel/sayfam/PanelSayfamSpotlightCarousel.tsx");
const activity = read("src/components/panel/sayfam/PanelSayfamActivityFeed.tsx");
const panelData = read("src/lib/panel/get-panel-data.ts");
const incomingInbox = read("src/lib/offer/incoming-offer-inbox.ts");
const nav = read("src/components/panel/panel-nav.ts");
const shell = read("src/components/panel/PanelShell.tsx");

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
    sayfamData.includes("sortIncomingRequestGroups"),
);
check(
  "focus CTA uses request workspace path",
  sayfamData.includes("buildIncomingRequestWorkspacePath"),
);
check(
  "action-required status copy",
  sayfamData.includes("Yanıtınız bekleniyor") &&
    sayfamData.includes("Yeni teklif var"),
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
  "carousel accessibility",
  carousel.includes("aria-label") &&
    carousel.includes("prefers-reduced-motion") &&
    carousel.includes("Önceki talep") &&
    carousel.includes("Sonraki talep"),
);
check(
  "carousel empty state",
  carousel.includes("İlk talebinizi oluşturun"),
);
check(
  "activity feed distinct copy",
  activity.includes("odak kartından farklı") &&
    activity.includes("/panel/bildirimler"),
);
check(
  "production shell title Sayfam only",
  shell.includes('if (pathname === "/panel") return "Sayfam"') &&
    !shell.includes("Sayfam · önizleme") || !read("src/components/panel/PanelShell.tsx").includes("Sayfam · önizleme"),
);
check(
  "no preview strings in sayfam components",
  !sayfamHome.includes("Onay için") &&
    !sayfamHome.includes("Mevcut Sayfam") &&
    !activity.includes("Canlı akış"),
);
check(
  "incoming filter mapping for focus",
  incomingInbox.includes("buildIncomingRequestWorkspacePath"),
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
