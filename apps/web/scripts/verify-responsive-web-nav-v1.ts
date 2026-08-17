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
const nav = read("src/components/panel/panel-nav.ts");
const home = read("src/app/panel/page.tsx");
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
  check("standard Keşfet kept", shell.includes('label="Keşfet"'));
  check("standard Profil kept", shell.includes('label="Profil"'));
  check("create CTA still /talep for personal", shell.includes('href={isCorporate ? "/panel/talepler" : "/talep"}'));
  check("lg:hidden only", shell.includes("lg:hidden"));
  check("no Radar bottom item", !shell.includes('label="Radar"') && !shell.includes('label="Talepo Radar"'));
  check("no OI bottom item", !shell.includes('label="Teklif Zekâsı"'));
  check("min-h-11 mobile targets", shell.includes("min-h-11"));
  check("safe-area padding", shell.includes("safe-area-inset-bottom"));
  check("aria-current on MobileLink", shell.includes('aria-current={active ? "page" : undefined}'));
  check("isNavActive strips query", shell.includes('href.split("?")[0]'));
}

console.log("\n=== DESKTOP IA UNCHANGED ===\n");
{
  check("Pro Araçlar still in sidebar", shell.includes("Pro Araçlar"));
  check("desktop Takiplerim tool", shell.includes('title: "Takiplerim"'));
  check("desktop Analiz tool", shell.includes('title: "Analiz"'));
  check("no asistan sidebar", !shell.includes("asistanItem"));
  check(
    "Radar not a sidebar product title",
    !shell.includes('title: "Talepo Radar"'),
  );
  check(
    "no /panel/asistan in PANEL_NAV_ITEMS",
    !PANEL_NAV_ITEMS.some((item) => item.href === "/panel/asistan"),
  );
}

console.log("\n=== SECONDARY ACCESS ===\n");
{
  check("Sayfam has Takiplerim shortcut", home.includes('label="Takiplerim"'));
  check("Sayfam has Analiz shortcut", home.includes('label="Analiz"'));
  check("Sayfam has Profil shortcut", home.includes('label="Profil ayarları"'));
  check("Sayfam has Gelen teklifler", home.includes('label="Gelen teklifler"'));
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
