/**
 * Seller Tekliflerim demand–offer comparison surface.
 * Run: npx tsx scripts/verify-outgoing-offer-compare-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  compareBuyerBudgetToOffer,
  budgetCompareCopy,
} from "../src/lib/offer/budget-offer-compare";
import {
  compareNegotiationPrices,
  negotiationCompareCopy,
} from "../src/lib/offer/negotiation-price-compare";

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
const group = read("src/components/panel/OutgoingOfferCompareGroup.tsx");
const card = read("src/components/panel/OutgoingOfferCard.tsx");
const incomingGroup = read("src/components/panel/IncomingOfferCompareGroup.tsx");
const gallery = read("src/components/panel/IncomingOfferGallery.tsx");
const cover = read("src/components/panel/IncomingRequestCover.tsx");
const panel = read("src/components/panel/OfferNegotiationPanel.tsx");
const actions = read("src/components/panel/OfferActions.tsx");
const buyerPage = read("src/app/panel/gelen-teklifler/page.tsx");
const statusLib = read("src/lib/offer/offer-card-status.ts");
const history = read("src/components/panel/NegotiationHistory.tsx");

console.log("\n=== SURFACE ===\n");
{
  check("page uses outgoing compare group", page.includes("OutgoingOfferCompareGroup"));
  check("eyebrow Müşterinin talebi", group.includes("Müşterinin talebi"));
  check("link Talebi aç", group.includes("Talebi aç"));
  check("offer message label", card.includes("Teklif mesajınız"));
  check("status Yanıtınız bekleniyor", statusLib.includes("Yanıtınız bekleniyor"));
  check("status Alıcının yanıtı bekleniyor", statusLib.includes("Alıcının yanıtı bekleniyor"));
  check("collapsible group", group.includes("CollapsibleOfferGroup"));
  check("three-column compare strip", group.includes("OfferCompareRail") && group.includes("grid-cols-[minmax(0,17.5rem)_9.5rem"));
  check("reuses IncomingRequestCover", incomingGroup.includes("IncomingRequestCover") && cover.includes("resolveRequestCardMedia"));
  check("reuses gallery", card.includes("IncomingOfferGallery") && gallery.includes("Teklif fotoğrafları"));
  check("empty gallery skipped", gallery.includes("mediaIds.length === 0) return null"));
  check("deep link highlight", group.includes("isDeepLinked") && page.includes("teklif"));
  check("no buyer identity on seller card", !card.includes("createdBy.name") && !group.includes("Alıcı:"));
  check("buyer page still Sizin talebiniz", incomingGroup.includes("Sizin talebiniz"));
  check("buyer page preserved compare group", buyerPage.includes("IncomingOfferWorkspace") || read("src/app/panel/gelen-teklifler/[requestId]/page.tsx").includes("IncomingOfferWorkspace"));
}

console.log("\n=== COMPARE ===\n");
{
  const first = compareBuyerBudgetToOffer({
    budgetMin: 45000,
    budgetMax: 45000,
    requestCurrency: "TRY",
    offerAmount: 48000,
    offerCurrency: "TRY",
  });
  const firstCopy = budgetCompareCopy(first, "TRY");
  check("first offer vs budget above", first.kind === "above" && first.percent === 7);
  check("first offer copy uses budget utility", firstCopy.tone === "amber");

  const round = compareNegotiationPrices({
    originalAmount: 48000,
    pendingAmount: 43000,
    originalCurrency: "TRY",
    pendingCurrency: "TRY",
  });
  const roundCopy = negotiationCompareCopy(round, "TRY");
  check("buyer counter 5000 fark", round.kind === "down" && round.diffCents === 500000);
  check("negotiation copy not budget copy", roundCopy.deltaLabel.includes("fark"));
  check(
    "zero budget does not divide",
    compareBuyerBudgetToOffer({
      budgetMin: 0,
      budgetMax: 0,
      requestCurrency: "TRY",
      offerAmount: 48000,
      offerCurrency: "TRY",
    }).kind === "invalid_budget",
  );
  check(
    "currency mismatch no fake percent",
    compareNegotiationPrices({
      originalAmount: 48000,
      pendingAmount: 43000,
      originalCurrency: "TRY",
      pendingCurrency: "USD",
    }).kind === "currency_mismatch",
  );
  check("price history accordion", history.includes("Fiyat ve pazarlık geçmişi"));
  check("caption helper on card", card.includes("resolveOfferPriceCaption"));
}

console.log("\n=== ACTIONS / COPY ===\n");
{
  check("accept label teklifini kabul et", card.includes("teklifini kabul et"));
  check("seller reject Pazarlık teklifini reddet", card.includes('rejectLabel: "Pazarlık teklifini reddet"'));
  check("seller hide offer lifecycle", card.includes("hideOfferLifecycle: true"));
  check("bargainCopy on seller card", card.includes("bargainCopy"));
  check("provider help mentions alıcı", panel.includes("alıcı kabul edebilir veya farklı bir fiyat önerebilir"));
  check("submit Pazarlık teklifini gönder", panel.includes("Pazarlık teklifini gönder"));
  check("cancel Vazgeç", panel.includes("Vazgeç"));
  check("seller turn only", card.includes("showActions") && card.includes("!myPending"));
  check(
    "double submit guard",
    actions.includes("runPendingAction") &&
      actions.includes('resolvedPhase !== "idle"') &&
      panel.includes("if (pending) return"),
  );
  check("min 44px", card.includes("min-h-11") || actions.includes("min-h-11"));
}

if (fail > 0) {
  console.log(`\nFAILED ${fail}/${pass + fail}`);
  for (const error of errors) console.log(` - ${error}`);
  process.exit(1);
}

console.log(`\nOK ${pass}/${pass + fail} — outgoing offer compare v1`);
