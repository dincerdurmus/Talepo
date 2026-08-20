/**
 * Responsive web bottom nav (narrow screen, not native app).
 * Run: npx tsx scripts/verify-responsive-web-nav-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  getResponsiveBottomNavVariant,
  PANEL_NAV_ITEMS,
} from "../src/components/panel/panel-nav";
import { featuresForPlan } from "../src/lib/membership/entitlements";

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

const shell = read("src/components/panel/PanelShell.tsx");
const commandSidebar = read("src/components/panel/CommandPersonalSidebar.tsx");
const proCatalog = read("src/lib/panel/signal-rail-pro-tools.ts");
const nav = read("src/components/panel/panel-nav.ts");
const sayfamHome = read("src/components/panel/sayfam/PanelSayfamHome.tsx");
const navItems = read("src/components/panel/panel-nav.ts");
const layout = read("src/app/layout.tsx");
const corporateHome = read("src/components/panel/CorporateHome.tsx");

const standard = featuresForPlan("STANDARD");
const professional = featuresForPlan("PROFESSIONAL");

console.log("\n=== VARIANT AUTHORITY ===\n");
{
  check(
    "standard personal stays standard nav",
    getResponsiveBottomNavVariant(standard, "personal") === "standard",
  );
  check(
    "professional personal uses professional nav",
    getResponsiveBottomNavVariant(professional, "personal") === "professional",
  );
  check(
    "professional company uses professional nav",
    getResponsiveBottomNavVariant(professional, "corporate") === "professional",
  );
  check(
    "standard has no Fırsatlar entitlement",
    standard.hot_opportunities !== true,
  );
}

console.log("\n=== PANEL SHELL BOTTOM BAR ===\n");
{
  check("uses getResponsiveBottomNavVariant", shell.includes("getResponsiveBottomNavVariant"));
  check("professional Fırsatlar item", shell.includes('label="Fırsatlar"') && shell.includes('href="/panel/firsatlar"'));
  check("professional Tekliflerim item", shell.includes('label="Tekliflerim"') && shell.includes('href="/panel/teklifler"'));
  check("standard Talepler marketplace kept", shell.includes('href="/panel/talepler"') && shell.includes('label="Keşfet"') && shell.includes("Talepleri keşfet"));
  check("standard Profil kept", shell.includes('label="Profil"'));
  check("create CTA still /talep for personal", shell.includes('href={isCorporate ? "/panel/talepler" : "/talep"}'));
  check("lg:hidden only", shell.includes("lg:hidden"));
  check("no Radar bottom item", !shell.includes('label="Radar"') && !shell.includes('label="Talepo Radar"'));
  check("no OI bottom item", !shell.includes('label="Teklif Zekâsı"'));
  check("min-h-11 mobile targets", shell.includes("min-h-11"));
  check("safe-area padding", shell.includes("safe-area-inset-bottom"));
  check("aria-current on MobileLink", shell.includes('aria-current={active ? "page" : undefined}'));
  check("isNavActive strips query", shell.includes("isPanelNavActive") && nav.includes('href.split("?")[0]'));
}

console.log("\n=== DESKTOP SIGNAL RAIL ===\n");
{
  check("CommandPersonalSidebar wired in shell", shell.includes("CommandPersonalSidebar"));
  check("Pro Araçlar in signal rail", commandSidebar.includes("Pro Araçlar"));
  check(
    "desktop Takip tool",
    proCatalog.includes('title: "Takip"') ||
      commandSidebar.includes('title: "Takip"'),
  );
  check(
    "desktop Analiz tool",
    commandSidebar.includes('"/panel/analiz"') ||
      commandSidebar.includes('title: "Analiz"'),
  );
  check(
    "desktop Fırsatlar tool",
    proCatalog.includes('title: "Fırsatlar"') ||
      commandSidebar.includes('title: "Fırsatlar"'),
  );
  check("plan section in rail", commandSidebar.includes('id: "plan"') || commandSidebar.includes('"plan"'));
  check("sidebar collapse localStorage key", commandSidebar.includes("sidebarCollapsed") || shell.includes("SIDEBAR_COLLAPSED_KEY"));
  check("rail hover + pinned dock", commandSidebar.includes("hoverSection") && commandSidebar.includes("pinnedOpen"));
  check("no asistan sidebar", !commandSidebar.includes("/panel/asistan"));
  check(
    "Takip is a catalogued pro tool; Radar is not top-level",
    proCatalog.includes('title: "Takip"') &&
      proCatalog.includes("/panel/firsatlar?view=tracking") &&
      !proCatalog.includes('title: "Talepo Radar"'),
  );
  check(
    "no /panel/asistan in PANEL_NAV_ITEMS",
    !PANEL_NAV_ITEMS.some((item) => item.href === "/panel/asistan"),
  );
}

console.log("\n=== SECONDARY ACCESS ===\n");
{
  const railHas = (label: string) =>
    navItems.includes(`label: "${label}"`) || commandSidebar.includes(`"${label}"`);
  check(
    "Sayfam metrics link gelen teklifler",
    sayfamHome.includes('href: "/panel/gelen-teklifler"') ||
      sayfamHome.includes('href="/panel/gelen-teklifler"'),
  );
  check("Signal rail has Takiplerim", railHas("Takiplerim"));
  check("Signal rail has Analiz", railHas("Analiz"));
  check("Signal rail has Profil", railHas("Profil") || navItems.includes("/panel/profil"));
  check("Signal rail has Gelen teklifler", railHas("Gelen teklifler"));
  check("company home Analiz link", corporateHome.includes('href="/panel/analiz"'));
  check("company home Takiplerim link", corporateHome.includes('href="/panel/takiplerim"'));
}

console.log("\n=== VIEWPORT / WEB ONLY ===\n");
{
  check("viewportFit cover", layout.includes("viewportFit") && layout.includes('"cover"'));
  check("no react-native", !nav.includes("react-native") && !shell.includes("react-native"));
}

if (fail > 0) {
  console.log(`\nFAILED ${fail}/${pass + fail}`);
  for (const error of errors) console.log(` - ${error}`);
  process.exit(1);
}

console.log(`\nOK ${pass}/${pass + fail} — responsive web nav V1`);
