/**
 * Public homepage (Talepo Signal landing) — route, authority, a11y contracts.
 * Run: npx tsx scripts/verify-public-home-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getAvailablePlans } from "../src/lib/membership/plans";
import { PUBLIC_PLAN_CARD_FEATURES } from "../src/lib/membership/product-packaging";

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

const page = read("src/app/page.tsx");
const publicPage = read("src/components/home/v1/HomePublicPage.tsx");
const hero = read("src/components/home/v1/HomeOneHero.tsx");
const explore = read("src/components/home/v1/HomeOneExplore.tsx");
const flow = read("src/components/home/v1/HomeOneFlow.tsx");
const plans = read("src/components/home/v1/HomeOnePlans.tsx");
const illustration = read("src/components/home/v1/HomeOneHeroIllustration.tsx");
const composer = read("src/components/home/HomeComposer.tsx");
const header = read("src/components/layout/Header.tsx");
const globals = read("src/app/globals.css");

console.log("\n=== PUBLIC ROUTE ===\n");
{
  check("page uses HomePublicPage", page.includes("HomePublicPage"));
  check("page metadata title", page.includes("İhtiyacınızı yazın, teklifleri karşılaştırın"));
  check("no preview banner on /", !page.includes("HomeOnePreviewBanner"));
  check("public page ink hero shell", publicPage.includes('bg-[#0e1614]'));
  check("public page home1 header", publicPage.includes('variant="home1"'));
}

console.log("\n=== HEADER NAV ===\n");
{
  check("home1 kategoriler anchor", header.includes('href="#kategoriler"'));
  check("home1 nasil anchor", header.includes('href="#nasil"'));
  check("home1 planlar anchor", header.includes('href="#planlar"'));
  check("home1 saticilar anchor", header.includes('href="#saticilar"'));
  check("profile hover open", header.includes("onMouseEnter={() => setProfileMenuOpen(true)}"));
  check("login route", header.includes('href="/giris"'));
  check("register route", header.includes('href="/kayit"'));
  check("talep CTA", header.includes('href="/talep"'));
}

console.log("\n=== HERO & COMPOSER ===\n");
{
  check("single H1 in hero", (hero.match(/<h1/g) ?? []).length === 1);
  check("hero headline copy", hero.includes("İhtiyacınızı yazın."));
  check("composer on ink", hero.includes('variant="home1"'));
  check("composer query handoff", composer.includes("/talep?query="));
  check("composer encodeURIComponent", composer.includes("encodeURIComponent"));
  check("composer suggestions clickable", composer.includes("applySuggestion"));
  check("composer enter submits", composer.includes('event.key === "Enter"'));
  check("illustration aria-hidden", illustration.includes("aria-hidden"));
}

console.log("\n=== SECTIONS ===\n");
{
  check("kategoriler id", explore.includes('id="kategoriler"'));
  check("nasil id", flow.includes('id="nasil"'));
  check("saticilar id", flow.includes('id="saticilar"'));
  check("planlar id", plans.includes('id="planlar"'));
  check("buyer CTA /talep", flow.includes('href="/talep"'));
  check("seller CTA /talepler", flow.includes('href="/talepler"'));
  check("no step numbers 01", !flow.includes("Adım 01") && !flow.includes('"01"'));
  check("satıcı label", flow.includes("Satıcı"));
}

console.log("\n=== PLANS AUTHORITY ===\n");
{
  const available = getAvailablePlans();
  check("two public plans", available.length === 2);
  check("standard free", available.find((p) => p.id === "STANDARD")?.priceTry === null);
  check("professional 2490", available.find((p) => p.id === "PROFESSIONAL")?.priceTry === 2490);
  check("plans from getAvailablePlans", plans.includes("getAvailablePlans()"));
  check("no hardcoded fake price", !plans.includes("₺9.990") && !plans.includes("9990"));
  for (const plan of available) {
    const features = PUBLIC_PLAN_CARD_FEATURES[plan.id === "STANDARD" ? "STANDARD" : "PROFESSIONAL"];
    check(`plan features authority ${plan.id}`, Array.isArray(features) && features.length > 0);
  }
}

console.log("\n=== FOOTER & PRODUCTION COPY ===\n");
{
  check("footer no önizleme", !plans.toLowerCase().includes("önizleme"));
  check("footer no ana sayfa 1", !plans.includes("Ana Sayfa 1"));
  check("legal kullanim", plans.includes('href="/kullanim-kosullari"'));
  check("legal gizlilik", plans.includes('href="/gizlilik-politikasi"'));
  check("copyright 2026", plans.includes("© 2026 Talepo"));
}

console.log("\n=== STYLES & MOTION ===\n");
{
  check("home1 hero canvas", globals.includes(".talepo-home1-hero-canvas"));
  check("home1 reveal", globals.includes(".talepo-home1-reveal"));
  check("reduced motion reveal", globals.includes("prefers-reduced-motion: reduce") && globals.includes(".talepo-home1-reveal"));
  check("reduced motion parallax", globals.includes(".talepo-home1-hero-parallax"));
}

console.log("\n=== SUMMARY ===\n");
console.log(`PASS: ${pass}`);
console.log(`FAIL: ${fail}`);
if (errors.length) {
  console.log("\nFailures:");
  for (const e of errors) console.log(`  - ${e}`);
  process.exit(1);
}
console.log("\nPUBLIC HOME VERIFY: PASS\n");
