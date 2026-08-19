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
  check("collapse key in PanelShell", shell.includes("talepo.panel.sidebarCollapsed"));
  check("default collapsed rail on first visit", shell.includes("useState(true)"));
  check("flex width rail layout", rail.includes("RAIL_WIDTH_PX") && rail.includes("DOCK_WIDTH_PX"));
  check("dock pushes content not overlay-only", rail.includes("transition-[width]"));
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
}

console.log("\n=== ROUTE ACTIVE STATE ===\n");
{
  check("path section resolver", rail.includes("getSectionFromPath"));
  check("plan route maps to plan section", rail.includes('pathname.startsWith("/panel/plan")'));
  check("araclar excludes plan path", !rail.includes('"/panel/plan"') || rail.includes('return "plan"'));
  check("isNavActive strips query", rail.includes('href.split("?")[0]'));
  check("nested profil under hesap", rail.includes('pathname.startsWith("/panel/profil")'));
  check("path section highlights collapsed rail", rail.includes("pathSection === section"));
}

console.log("\n=== ENTITLEMENT MATRIX ===\n");
{
  const standardPersonal = filterPanelNavItems(PANEL_NAV_ITEMS, featuresForPlan("STANDARD"), "personal");
  const proPersonal = filterPanelNavItems(PANEL_NAV_ITEMS, featuresForPlan("PROFESSIONAL"), "personal");
  check(
    "standard hides firsatlar nav item",
    !standardPersonal.some((item) => item.href.split("?")[0] === "/panel/firsatlar"),
  );
  check(
    "standard teklifler follows submit_offer entitlement",
    standardPersonal.some((item) => item.href === "/panel/teklifler") ===
      (featuresForPlan("STANDARD").submit_offer === true),
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
    "pro tools gated by nav filter",
    rail.includes("showProCard") && rail.includes("hasToolsSection"),
  );
  check(
    "premium rail only when pro card",
    rail.includes("section === \"araclar\" && showProCard"),
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
  check("no full-page scrim overlay", !rail.includes("fixed inset-0 left-[68px]"));
}

console.log("\n=== ACCESSIBILITY ===\n");
{
  check("aria-label on rail buttons", rail.includes("aria-label={sectionLabel}") || rail.includes("aria-label="));
  check("aria-expanded on toggle", rail.includes("aria-expanded={dockVisible}") || rail.includes("aria-expanded={pinnedOpen"));
  check("aria-current on dock links", rail.includes('aria-current={active ? "page" : undefined}'));
  check("badge aria labels", rail.includes("badgeAriaLabel"));
  check("decorative indicators aria-hidden", rail.includes("aria-hidden"));
  check("min touch rail buttons h-11", rail.includes("h-11 w-11"));
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
