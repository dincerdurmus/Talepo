/**
 * Incoming offer card + bargain copy.
 * Run: npx tsx scripts/verify-incoming-offer-card-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

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

const page = read("src/app/panel/gelen-teklifler/page.tsx");
const group = read("src/components/panel/IncomingOfferCompareGroup.tsx");
const card = read("src/components/panel/IncomingOfferCard.tsx");
const panel = read("src/components/panel/OfferNegotiationPanel.tsx");
const actions = read("src/components/panel/OfferActions.tsx");
const teklifler = read("src/app/panel/teklifler/page.tsx");
const service = read("src/server/offer/offer-negotiation-service.ts");

console.log("\n=== STRUCTURE ===\n");
{
  check("card is client component", card.includes('"use client"'));
  check(
    "page uses compare group",
    page.includes("IncomingOfferCompareGroup") && page.includes("IncomingOfferCard"),
  );
  check("request eyebrow Sizin talebiniz", group.includes("Sizin talebiniz"));
  check("compact request counters", group.includes("yanıt bekliyor"));
  check("page pill removed", !page.includes("bekleyen ·"));
  check("seller header firmName", card.includes("firmName"));
  check("status Yeni", card.includes('SUBMITTED: "Yeni"'));
  check("status Yanıt bekliyor", card.includes('VIEWED: "Yanıt bekliyor"'));
  check("status Pazarlıkta", card.includes('"Pazarlıkta"'));
  check("price caption İlk teklif", card.includes('"İlk teklif"'));
  check("thin Teklif kapsamı", card.includes("Teklif kapsamı"));
  check(
    "no huge completeness box",
    !card.includes("rounded-xl border border-teal-900/[0.06] bg-white px-3.5 py-3"),
  );
  check("action bar OfferActions", card.includes("<OfferActions"));
}

console.log("\n=== COPY ===\n");
{
  check("buyer CTA Pazarlık yap", card.includes("showBargain") && actions.includes("Pazarlık yap"));
  check("form title Pazarlık yap", panel.includes('bargainCopy ? "Pazarlık yap"'));
  check("submit Pazarlık teklifini gönder", panel.includes("Pazarlık teklifini gönder"));
  check("helper copy", panel.includes("Yeni fiyatınızı iletin; satıcı kabul edebilir veya yeni bir fiyat önerebilir."));
  check("cancel Vazgeç", panel.includes("Vazgeç"));
  check("page intro pazarlık yapın", page.includes("pazarlık yapın"));
  check("seller surface keeps Karşı teklif ver", panel.includes("Karşı teklif ver"));
  check("seller list not bargainCopy", !teklifler.includes("bargainCopy"));
  check("no domain rename", service.includes("proposeOfferNegotiation") && service.includes("COUNTER_OFFER_RECEIVED"));
}

console.log("\n=== ACTIONS ===\n");
{
  check("accept primary teal", actions.includes("bg-[#0f766e]"));
  check("bargain amber", actions.includes("border-amber") && actions.includes("text-amber-950"));
  check("reject tertiary", actions.includes("Teklifi reddet"));
  check("actions only current buyer turn", card.includes("showActions") && card.includes("!myPending"));
  check("composer opens from bargain", card.includes("onBargain={() => setComposerOpen(true)}"));
  check("hideTriggers on inbox panel", card.includes("hideTriggers"));
  check("double-submit guard", actions.includes("if (loadingAction) return") && panel.includes("if (pending) return"));
  check("pending counter preserves reject copy", actions.includes("Karşı teklifi reddet"));
  check("original accept preserved", actions.includes("Orijinal teklifi kabul et"));
}

console.log("\n=== A11Y / RESPONSIVE ===\n");
{
  check("aria-label Pazarlık yap", actions.includes('aria-label="Pazarlık yap"'));
  check("full-width mobile buttons", actions.includes("w-full"));
  check("min 44px", actions.includes("min-h-11") && panel.includes("min-h-11"));
  check("compare rail stacks on mobile", card.includes("lg:grid-cols-[7.75rem_minmax(0,1fr)]"));
}

if (fail > 0) {
  console.log(`\nFAILED ${fail}/${pass + fail}`);
  for (const error of errors) console.log(` - ${error}`);
  process.exit(1);
}

console.log(`\nOK ${pass}/${pass + fail} — incoming offer card v1`);
