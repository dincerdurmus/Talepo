/**
 * Talepo Signal Rail sidebar — navigation, state, badges, a11y.
 * Run: npx tsx scripts/verify-signal-rail-sidebar-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  filterPanelNavItems,
  PANEL_NAV_ITEMS,
} from "../src/components/panel/panel-nav";
import { featuresForPlan } from "../src/lib/membership/entitlements";
import {
  resolveSignalRailProTools,
  SIGNAL_RAIL_PRO_TOOLS,
} from "../src/lib/panel/signal-rail-pro-tools";
import {
  SAYFAM_HERO_HINT,
  sayfamCopyHasForbiddenDash,
} from "../src/lib/panel/sayfam-focus";

const ROOT = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

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

const shell = read("src/components/panel/PanelShell.tsx");
const rail = read("src/components/panel/CommandPersonalSidebar.tsx");
const accountMenu = read("src/components/panel/PanelAccountMenu.tsx");

console.log("\n=== WIRING ===\n");
{
  check("personal uses CommandPersonalSidebar", shell.includes("<CommandPersonalSidebar"));
  check("corporate keeps CorporateSidebar", shell.includes("<CorporateSidebar"));
  check(
    "corporate collapsed width unchanged",
    shell.includes('collapsed ? "w-[72px] px-2"'),
  );
  check("collapse key in PanelShell", shell.includes("talepo.panel.sidebarCollapsed"));
  check("default collapsed rail on first visit", shell.includes("useState(true)"));
  check("flex width rail layout", rail.includes("RAIL_WIDTH_PX") && rail.includes("DOCK_WIDTH_PX"));
  check("dock pushes content not overlay-only", rail.includes("transition-[width]"));
  check(
    "opened dock keeps glass transparency",
    rail.includes("talepo-signal-dock") &&
      rail.includes("backdrop-blur-[40px]") &&
      !rail.includes("bg-transparent"),
  );
  check(
    "dock tab icons and labels stay opaque",
    rail.includes("text-white hover:bg-white/10") &&
      rail.includes("border-white/20 bg-white/15 text-white") &&
      rail.includes("talepo-signal-dock-solid") &&
      !rail.includes("text-white/72 hover:bg-white/6"),
  );
  const dockCss = read("src/app/globals.css");
  check(
    "dock category labels stay readable on glass",
    dockCss.includes("talepo-signal-dock-solid") &&
      dockCss.includes("text-shadow") &&
      rail.includes('uppercase tracking-[0.08em] text-white') &&
      !rail.includes('uppercase tracking-[0.08em] text-white/70'),
  );
  const railWidth = Number(
    rail.match(/export const SIGNAL_RAIL_WIDTH_PX = (\d+)/)?.[1] ?? "",
  );
  check(
    "collapsed rail width 80-88",
    railWidth >= 80 && railWidth <= 88,
    `width=${railWidth}`,
  );
}

console.log("\n=== NAV TARGETS ===\n");
{
  const targets = [
    'href="/"',
    'href="/talep"',
    'href="/panel"',
    '"/panel/taleplerim"',
    '"/panel/gelen-teklifler"',
    '"/panel/talepler"',
    '"/panel/teklifler"',
    '"/panel/firsatlar"',
    '"/panel/takiplerim"',
    '"/panel/analiz"',
    '"/panel/plan"',
    '"/panel/mesajlar"',
    '"/panel/profil"',
  ];
  for (const target of targets) {
    check(`target present ${target}`, shell.includes(target) || rail.includes(target));
  }
  const talepTeklifOrder = filterPanelNavItems(
    PANEL_NAV_ITEMS,
    featuresForPlan("PROFESSIONAL"),
    "personal",
  )
    .map((item) => item.href)
    .filter((href) =>
      [
        "/panel/talepler",
        "/panel/taleplerim",
        "/panel/gelen-teklifler",
        "/panel/teklifler",
      ].includes(href),
    );
  check(
    "talep-teklif dock order is keşfet, taleplerim, gelen, tekliflerim",
    talepTeklifOrder.join(",") ===
      "/panel/talepler,/panel/taleplerim,/panel/gelen-teklifler,/panel/teklifler",
  );
}

console.log("\n=== ROUTE ACTIVE STATE ===\n");
{
  check("path section resolver", rail.includes("getSectionFromPath"));
  check("plan route maps to plan section", rail.includes('pathname.startsWith("/panel/plan")'));
  check("araclar excludes plan path", !rail.includes('"/panel/plan"') || rail.includes('return "plan"'));
  check("isNavActive strips query", rail.includes("isPanelNavActive") && read("src/components/panel/panel-nav.ts").includes('href.split("?")[0]'));
  check("nested profil under hesap", rail.includes('pathname.startsWith("/panel/profil")'));
  check("path section highlights collapsed rail", rail.includes("pathSection === section"));
}

console.log("\n=== ENTITLEMENT MATRIX ===\n");
{
  const standardPersonal = filterPanelNavItems(PANEL_NAV_ITEMS, featuresForPlan("STANDARD"), "personal");
  const proPersonal = filterPanelNavItems(PANEL_NAV_ITEMS, featuresForPlan("PROFESSIONAL"), "personal");
  check(
    "standard hides firsatlar from primary nav",
    !standardPersonal.some((item) => item.href.split("?")[0] === "/panel/firsatlar"),
  );
  check(
    "standard teklifler follows submit_offer entitlement",
    standardPersonal.some((item) => item.href === "/panel/teklifler") ===
      (featuresForPlan("STANDARD").submit_offer === true),
  );
  check(
    "standard keeps basic analiz in primary nav",
    standardPersonal.some((item) => item.href === "/panel/analiz"),
  );
  check(
    "professional shows firsatlar",
    proPersonal.some((item) => item.href.split("?")[0] === "/panel/firsatlar"),
  );
  check(
    "professional shows tekliflerim",
    proPersonal.some((item) => item.href === "/panel/teklifler"),
  );
  check(
    "plan visible for standard",
    standardPersonal.some((item) => item.href === "/panel/plan"),
  );
  check(
    "pro category always in personal rail",
    rail.includes('araclar: "Pro araçlar"') &&
      rail.includes('"araclar"') &&
      rail.includes("RAIL_SECTIONS"),
  );
  check(
    "premium rail icon used for pro category",
    rail.includes('premium={section === "araclar"}'),
  );
}

console.log("\n=== BADGES ===\n");
{
  check("incoming badge on gelen-teklifler", rail.includes('href === "/panel/gelen-teklifler"'));
  check("outgoing badge on teklifler", rail.includes('href === "/panel/teklifler"'));
  check("messages badge", rail.includes('href === "/panel/mesajlar"'));
  check("formatPanelCountBadge used", rail.includes("formatPanelCountBadge"));
  check("zero hides badge", rail.includes("if (count <= 0) return undefined"));
  check("99+ cap", rail.includes('count > 99 ? "99+"'));
  check("section rail incoming badge", rail.includes("unreadIncomingOfferEvents"));
  check("section rail messages badge", rail.includes("unreadMessages"));
}

console.log("\n=== INTERACTION ===\n");
{
  check("hover opens dock", rail.includes("hoverSection"));
  check("pinned open state", rail.includes("pinnedOpen"));
  check("escape closes dock", rail.includes('event.key === "Escape"'));
  check("localStorage collapse sync in shell", shell.includes("localStorage.setItem(SIDEBAR_COLLAPSED_KEY"));
  check("no full-page scrim overlay", !rail.includes("fixed inset-0 left-[68px]") && !rail.includes("fixed inset-0"));
  check(
    "visible collapsed labels",
    rail.includes('menu: "Menü"') &&
      rail.includes('create: "Yeni talep"') &&
      rail.includes('genel: "Sayfam"') &&
      rail.includes('"talep-teklif": "Talep"') &&
      rail.includes('araclar: "Pro araçlar"') &&
      rail.includes('plan: "Plan"') &&
      rail.includes('hesap: "Hesap"') &&
      rail.includes("<RailCaption"),
  );
  check(
    "768 height pins plan and hesap",
    rail.includes('mt-auto') &&
      rail.includes('(["plan", "hesap"]') &&
      rail.includes("overflow-y-auto"),
  );
  check(
    "unread badge sits on icon",
    rail.includes("-right-0.5 -top-0.5") &&
      !rail.includes("-bottom-1 left-1/2"),
  );
}

console.log("\n=== ACCESSIBILITY ===\n");
{
  check("aria-label on rail buttons", rail.includes("aria-label={sectionLabel}") || rail.includes("aria-label="));
  check("aria-expanded on toggle", rail.includes("aria-expanded={dockVisible}") || rail.includes("aria-expanded={pinnedOpen"));
  check("aria-current on dock links", rail.includes('aria-current={active ? "page" : undefined}'));
  check("badge aria labels", rail.includes("badgeAriaLabel"));
  check("decorative indicators aria-hidden", rail.includes("aria-hidden"));
  check("min touch rail buttons min-h-11", rail.includes("min-h-11"));
}

console.log("\n=== PRO TOOLS LOCKED CATALOG ===\n");
{
  const standardPersonal = filterPanelNavItems(
    PANEL_NAV_ITEMS,
    featuresForPlan("STANDARD"),
    "personal",
  );
  const proCatalog = read("src/lib/panel/signal-rail-pro-tools.ts");
  const standardTools = resolveSignalRailProTools(
    featuresForPlan("STANDARD"),
    "/panel",
  );
  const professionalTools = resolveSignalRailProTools(
    featuresForPlan("PROFESSIONAL"),
    "/panel/firsatlar",
  );
  const titles = SIGNAL_RAIL_PRO_TOOLS.map((tool) => tool.title);

  check(
    "standard personal sees pro category",
    rail.includes('araclar: "Pro araçlar"') &&
      rail.includes("resolveSignalRailProTools"),
  );
  check(
    "standard can open pro dock group",
    rail.includes("handleRailClick") &&
      rail.includes('"araclar"') &&
      rail.includes("<CommandProToolsCard"),
  );
  check(
    "all pro-only tools are catalogued",
    titles.includes("Fırsatlar") &&
      titles.includes("Takiplerim") &&
      titles.includes("Talepo Radar") &&
      titles.includes("Teklif Zekâsı") &&
      standardTools.length === SIGNAL_RAIL_PRO_TOOLS.length,
  );
  check(
    "locked tools have lock indicator",
    rail.includes("aria-disabled") &&
      rail.includes("Kilitli") &&
      rail.includes("<Lock") &&
      standardTools.every((tool) => tool.locked),
  );
  check(
    "locked tools have no href",
    standardTools.every((tool) => tool.href === null) &&
      rail.includes("item.locked || !item.href"),
  );
  check(
    "locked tools are not keyboard links",
    rail.includes('role="group"') &&
      rail.includes('aria-disabled="true"') &&
      rail.includes("cursor-default") &&
      !rail.includes("onKeyDown={"),
  );
  check(
    "basic analiz is not locked in pro catalog",
    !titles.includes("Analiz") &&
      !SIGNAL_RAIL_PRO_TOOLS.some((tool) => tool.href === "/panel/analiz") &&
      standardPersonal.some((item) => item.href === "/panel/analiz"),
  );
  check(
    "professional tools are real canonical links",
    professionalTools.every((tool) => tool.locked === false && typeof tool.href === "string") &&
      professionalTools.find((tool) => tool.id === "firsatlar")?.href ===
        "/panel/firsatlar" &&
      professionalTools.find((tool) => tool.id === "takiplerim")?.href ===
        "/panel/takiplerim" &&
      professionalTools.find((tool) => tool.id === "radar")?.href ===
        "/panel/firsatlar?view=radar" &&
      professionalTools.find((tool) => tool.id === "teklif-zekasi")?.href ===
        "/panel/teklifler",
  );
  check(
    "professional tools have no lock flag",
    professionalTools.every((tool) => tool.locked === false) &&
      professionalTools.some((tool) => tool.active),
  );
  check(
    "teklif zekasi does not share tekliflerim active state",
    resolveSignalRailProTools(
      featuresForPlan("PROFESSIONAL"),
      "/panel/teklifler",
    ).find((tool) => tool.id === "teklif-zekasi")?.active === false,
  );
  check(
    "admin role is not an entitlement bypass",
    !proCatalog.includes("platformRole") &&
      resolveSignalRailProTools(featuresForPlan("STANDARD"), "/panel").every(
        (tool) => tool.locked,
      ),
  );
  check(
    "corporate sidebar unchanged by pro catalog",
    shell.includes("<CorporateSidebar") &&
      shell.includes('collapsed ? "w-[72px] px-2"') &&
      shell.includes("features={features}") &&
      !shell.includes("resolveSignalRailProTools"),
  );
  check(
    "768 height still pins plan and hesap with pro visible",
    rail.includes("RAIL_SECTIONS") &&
      rail.includes('mt-auto') &&
      rail.includes('(["plan", "hesap"]'),
  );
  check(
    "sayfam welcome copy is exact",
    SAYFAM_HERO_HINT === "Hazırsan kaldığın yerden devam edelim.",
  );
  check(
    "user-facing pro tool copy has no dashes",
    SIGNAL_RAIL_PRO_TOOLS.every(
      (tool) =>
        !sayfamCopyHasForbiddenDash(tool.title) &&
        !sayfamCopyHasForbiddenDash(tool.description),
    ) && !sayfamCopyHasForbiddenDash(SAYFAM_HERO_HINT),
  );
}

console.log("\n=== ADMIN ===\n");
{
  check("admin link in account menu not rail", accountMenu.includes('href="/admin"'));
  check("admin gated by platformRole", accountMenu.includes('platformRole !== "USER"'));
  check("no admin in signal rail", !rail.includes('href="/admin"'));
}

console.log("\n=== MOBILE DESKTOP SPLIT ===\n");
{
  check("rail lg:block only", rail.includes("lg:block"));
  check("bottom nav lg:hidden", shell.includes("lg:hidden"));
}

if (fail > 0) {
  console.log(`\nFAILED ${fail}/${pass + fail}`);
  for (const error of errors) console.log(` - ${error}`);
  process.exit(1);
}

console.log(`\nOK ${pass}/${pass + fail} — Signal Rail sidebar V1`);
