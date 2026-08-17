/**
 * Teklif Zekâsı discoverability on Tekliflerim + sidebar IA cleanup.
 * Run: npx tsx scripts/verify-offer-intelligence-discoverability-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PANEL_NAV_ITEMS } from "../src/components/panel/panel-nav";
import { FEATURE_META } from "../src/lib/membership/feature-meta";
import { PRO_FEATURE_PRESENTATION } from "../src/lib/membership/feature-presentation";
import {
  OFFER_INTELLIGENCE_MIN_OTHERS,
  canRevealOfferStats,
} from "../src/lib/monetization/offer-intelligence";

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

const page = read("src/app/panel/teklifler/page.tsx");
const hub = read("src/components/panel/OfferIntelligenceHub.tsx");
const card = read("src/components/panel/OfferIntelligenceCard.tsx");
const shell = read("src/components/panel/PanelShell.tsx");
const nav = read("src/components/panel/panel-nav.ts");
const exposure = read("src/server/monetization/offer-intelligence-exposure.ts");

console.log("\n=== TEKLIFLERIM HUB ===\n");
{
  check("1/5 hub on teklifler page", page.includes("OfferIntelligenceHub"));
  check("hub component exists", hub.includes("Teklif Zekâsı"));
  check("2 Standard locked mode", hub.includes('mode === "locked"') && hub.includes("Professional ile aç"));
  check("4 Standard CTA /panel/plan", hub.includes('href="/panel/plan"'));
  check(
    "3 Standard no fake stats in locked",
    !hub.includes("blur") &&
      !hub.includes("sahte") &&
      hub.includes("LockedBody") &&
      !hub.includes("12.450") &&
      !hub.includes("Medyanın %"),
  );
  check(
    "Standard path skips intelligence lookup",
    page.includes("hasOfferIntelligence") &&
      page.includes('intelligenceHubMode = "locked"') &&
      page.includes("getRequestOfferIntelligence"),
  );
  check(
    "6/7 Professional empty copy",
    hub.includes("Henüz yeterli anonim teklif verisi oluşmadı.") &&
      hub.includes("OFFER_INTELLIGENCE_MIN_OTHERS") &&
      hub.includes("başka uygun teklif"),
  );
  check(
    "no AI / yakında copy",
    !hub.includes("Yakında") &&
      !hub.includes("Hazırlanıyor") &&
      !hub.includes("AI analiz"),
  );
  check(
    "8 READY reuses OfferIntelligenceCard",
    hub.includes("OfferIntelligenceCard") && hub.includes('mode === "ready"'),
  );
  check(
    "18 multiple READY presentation",
    hub.includes("items.map") && page.includes("readyIntelligence"),
  );
  check("15 privacy threshold still 3", OFFER_INTELLIGENCE_MIN_OTHERS === 3);
  check("15 canReveal at 3", canRevealOfferStats(3) && !canRevealOfferStats(2));
}

console.log("\n=== EXPOSURE AUTHORITY ===\n");
{
  check(
    "7/13/14 locked+empty shells have no exposure fetch",
    !hub.includes("/api/monetization/offer-intelligence/exposure") &&
      hub.includes("LockedBody") &&
      hub.includes("EmptyBody"),
  );
  check(
    "9/11 READY exposure only via card",
    card.includes('intelligence.state !== "READY"') &&
      card.includes("/api/monetization/offer-intelligence/exposure"),
  );
  check(
    "exposure server create-only still present",
    exposure.includes("offerIntelligenceExposure.create"),
  );
}

console.log("\n=== SIDEBAR IA ===\n");
{
  check(
    "24 no Radar nav title",
    !shell.includes('title: "Talepo Radar"') &&
      !shell.includes('href: "/panel/firsatlar?view=radar"'),
  );
  check(
    "25 no Teklif Zekâsı nav title",
    !shell.includes('title: "Teklif Zekâsı"'),
  );
  check(
    "26 no Teklif Taslağı in PANEL_NAV_ITEMS",
    !PANEL_NAV_ITEMS.some((item) => item.href === "/panel/asistan") &&
      !nav.includes('label: "Teklif taslağı"'),
  );
  check(
    "26 shell does not render asistan sidebar entry",
    !shell.includes("asistanItem") && !shell.includes("WandSparkles"),
  );
  check(
    "27 Pro tools = Fırsatlar / Takiplerim / Analiz",
    shell.includes('title: "Fırsatlar"') &&
      shell.includes('title: "Takiplerim"') &&
      shell.includes('title: "Analiz"') &&
      shell.includes("Pro Araçlar"),
  );
  check("28 Plan separate", shell.includes("PlanNavRow") && shell.includes('href === "/panel/plan"'));
  check(
    "deep-link /panel/asistan still exists as route file",
    read("src/app/panel/asistan/page.tsx").length > 0,
  );
  check(
    "capability key retained",
    FEATURE_META.ai_offer_assistant.label === "Teklif taslağı",
  );
  check(
    "feature presentation parent surfaces",
    PRO_FEATURE_PRESENTATION.professional_analytics?.resultLocation ===
      "Tekliflerim" &&
      PRO_FEATURE_PRESENTATION.ai_offer_assistant?.resultLocation ===
        "Teklif formu",
  );
}

console.log("\n=== SUMMARY ===\n");
console.log(`verify-offer-intelligence-discoverability-v1: ${pass} PASS, ${fail} FAIL`);
if (fail > 0) {
  for (const e of errors) console.error(" -", e);
  process.exit(1);
}
