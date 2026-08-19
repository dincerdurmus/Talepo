/**
 * Demand–offer comparison surface + gallery/lightbox.
 * Run: npx tsx scripts/verify-incoming-offer-compare-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  budgetCompareCopy,
  budgetCompareListDeltaLabel,
  compareBuyerBudgetToOffer,
  formatRequestQuantity,
  resolveTargetBudgetCents,
} from "../src/lib/offer/budget-offer-compare";

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
const gallery = read("src/components/panel/IncomingOfferGallery.tsx");
const cover = read("src/components/panel/IncomingRequestCover.tsx");
const lightbox = read("src/components/panel/OfferMediaLightbox.tsx");
const mediaRoute = read("src/app/api/offers/[id]/media/[mediaId]/route.ts");
const mediaAccess = read("src/server/offer/offer-media-access.ts");
const coverAuth = read("src/lib/panel/request-cover-image.ts");

console.log("\n=== BUDGET COMPARE ===\n");
{
  const above = compareBuyerBudgetToOffer({
    budgetMin: 45000,
    budgetMax: 45000,
    requestCurrency: "TRY",
    offerAmount: 48000,
    offerCurrency: "TRY",
  });
  check("above uses cents", above.kind === "above" && above.diffCents === 300000);
  check("above percent rounds 7", above.percent === 7);
  const aboveCopy = budgetCompareCopy(above, "TRY");
  check("above copy fark", aboveCopy.deltaLabel.includes("3.000") && aboveCopy.deltaLabel.includes("fark"));
  check("above copy yüzde", aboveCopy.relativeLabel === "Bütçenin %7 üstünde");
  check("above tone amber", aboveCopy.tone === "amber");

  const below = compareBuyerBudgetToOffer({
    budgetMax: 50000,
    requestCurrency: "TRY",
    offerAmount: 47500,
    offerCurrency: "TRY",
  });
  check("below 5 percent", below.kind === "below" && below.percent === 5);
  check(
    "below copy",
    budgetCompareCopy(below, "TRY").relativeLabel === "Bütçenin %5 altında",
  );
  check(
    "list delta below copy",
    budgetCompareListDeltaLabel(below, "TRY") === "₺2.500 bütçe altında",
  );
  check(
    "list delta above copy",
    budgetCompareListDeltaLabel(above, "TRY") === "₺3.000 bütçe üstünde",
  );

  const equal = compareBuyerBudgetToOffer({
    budgetMax: "48000.00",
    requestCurrency: "try",
    offerAmount: 48000,
    offerCurrency: "TRY",
  });
  check("equal decimal string", equal.kind === "equal");
  check(
    "equal copy",
    budgetCompareCopy(equal, "TRY").relativeLabel === "Bütçenizle aynı",
  );

  const missing = compareBuyerBudgetToOffer({
    offerAmount: 48000,
    offerCurrency: "TRY",
    requestCurrency: "TRY",
  });
  check("missing budget", missing.kind === "missing_budget" && missing.percent == null);
  check(
    "missing copy",
    budgetCompareCopy(missing, "TRY").deltaLabel === "Bütçe belirtilmedi",
  );

  const zero = compareBuyerBudgetToOffer({
    budgetMax: 0,
    requestCurrency: "TRY",
    offerAmount: 48000,
    offerCurrency: "TRY",
  });
  check("zero budget invalid / no divide", zero.kind === "invalid_budget" && zero.percent == null);

  const mismatch = compareBuyerBudgetToOffer({
    budgetMax: 45000,
    requestCurrency: "TRY",
    offerAmount: 48000,
    offerCurrency: "USD",
  });
  check("currency mismatch", mismatch.kind === "currency_mismatch");

  const kurus = compareBuyerBudgetToOffer({
    budgetMax: 100.1,
    requestCurrency: "TRY",
    offerAmount: 100.2,
    offerCurrency: "TRY",
  });
  check("kuruş diff 10 cents", kurus.diffCents === 10);

  check("target prefers max", resolveTargetBudgetCents({ budgetMin: 10, budgetMax: 45 }) === 4500);
  check("quantity text kept", formatRequestQuantity({ textValue: "1 adet" }) === "1 adet");
  check("quantity number", formatRequestQuantity({ numberValue: 2 }) === "2 adet");
}

console.log("\n=== SURFACE ===\n");
{
  const workspace = read("src/app/panel/gelen-teklifler/[requestId]/page.tsx");
  const workspaceClient = read("src/components/panel/IncomingOfferWorkspace.tsx");
  const requestCard = read("src/components/panel/IncomingRequestInboxCard.tsx");
  const loader = read("src/server/offer/load-buyer-incoming-offers.ts");

  check("group SİZİN TALEBİNİZ (compare group preserved)", group.includes("Sizin talebiniz"));
  check("group Hedef bütçe", group.includes("Hedef bütçe"));
  check("group Talep detayları", group.includes("Talep detayları"));
  check("group seller message block", card.includes("Satıcının mesajı"));
  check("loader uses coverImageUrl", loader.includes("coverImageUrl"));
  check("loader uses budget fields", loader.includes("budgetMin") && loader.includes("budgetMax"));
  check("quantity from fieldValues", loader.includes('key: { in: ["quantity", "commonQuantity"] }'));
  check("request cover uses resolveRequestCardMedia", cover.includes("resolveRequestCardMedia"));
  check("no fake chair image", !cover.includes("sandalye") && !page.includes("executive-chair"));
  check("workspace compare collapsible", workspaceClient.includes("Teklifleri karşılaştır"));
  check("workspace uses OfferCompareRail", workspaceClient.includes("OfferCompareRail"));
  check("inbox request card cover", requestCard.includes("IncomingRequestCover"));
  check("inbox no inline compare", !page.includes("IncomingOfferCompareGroup"));
  check("request shown in workspace summary", workspaceClient.includes("request.title"));
  check("hardcoded 45000 absent", !page.includes("45000") && !card.includes("45000"));
}

console.log("\n=== MEDIA ===\n");
{
  check("gallery skipped when empty", gallery.includes("mediaIds.length === 0) return null"));
  check("gallery copy Teklif fotoğrafları", gallery.includes("Teklif fotoğrafları"));
  check("1 fotoğraf / N fotoğraf", gallery.includes("1 fotoğraf") && gallery.includes("fotoğraf"));
  check("enlarge label", gallery.includes("Teklif fotoğrafını büyüt"));
  check("photo alt pattern", gallery.includes("teklifine ait fotoğraf"));
  check("lightbox escape", lightbox.includes('event.key === "Escape"'));
  check("lightbox arrows", lightbox.includes("ArrowRight") && lightbox.includes("ArrowLeft"));
  check("lightbox prev/next buttons", lightbox.includes("Önceki fotoğraf") && lightbox.includes("Sonraki fotoğraf"));
  check("lightbox focus trap", lightbox.includes("Tab") && lightbox.includes("focusable"));
  check("GET media requireUser", mediaRoute.includes("requireUser"));
  check("owner can read", mediaAccess.includes("isRequestOwner") && mediaAccess.includes("canReadOfferMedia"));
  check("cover authority Request.coverImageUrl", coverAuth.includes("Request.coverImageUrl"));
  check("offer media via authenticated src", gallery.includes("offerMediaSrc"));
}

if (fail > 0) {
  console.log(`\nFAILED ${fail}/${pass + fail}`);
  for (const error of errors) console.log(` - ${error}`);
  process.exit(1);
}

console.log(`\nOK ${pass}/${pass + fail} — incoming offer compare v1`);
