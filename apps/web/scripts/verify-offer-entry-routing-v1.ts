/**
 * Offer entry routing contract: canonical href, page guards, visible CTA alignment.
 * Run: npx tsx scripts/verify-offer-entry-routing-v1.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { offerFormHref } from "../src/lib/panel/offer-form-href";
import { attributedOfferFormHref } from "../src/server/offer/attributed-request-href";

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

const REQUEST_ID = "11111111-2222-3333-4444-555555555555";
const canonical = offerFormHref(REQUEST_ID);
const attributed = attributedOfferFormHref({
  userId: "user-1",
  requestId: REQUEST_ID,
  source: "EXPLORE",
});

const detailPage = read("src/app/panel/talepler/[id]/page.tsx");
const offerPage = read("src/app/panel/talepler/[id]/teklif/page.tsx");
const offerSendCta = read("src/components/panel/OfferSendCta.tsx");
const discoveryCard = read("src/components/panel/discovery/DiscoveryResultCard.tsx");
const attributedHref = read("src/server/offer/attributed-request-href.ts");
const helper = read("src/lib/panel/offer-form-href.ts");
const ensureDev = read("scripts/ensure-dev-next-cache.mts");

check(
  "canonical offer form route file exists",
  existsSync(join(root, "src/app/panel/talepler/[id]/teklif/page.tsx")),
);

check(
  "offerFormHref builds canonical path",
  canonical === `/panel/talepler/${REQUEST_ID}/teklif`,
);

check(
  "offerFormHref preserves attribution touch",
  offerFormHref(REQUEST_ID, "touch-abc").endsWith("?acq=touch-abc"),
);

check(
  "attributedOfferFormHref uses offerFormHref base",
  attributed.startsWith(`/panel/talepler/${REQUEST_ID}/teklif?acq=`),
);

check(
  "detail page imports shared offerFormHref",
  detailPage.includes('from "@/lib/panel/offer-form-href"') &&
    detailPage.includes("offerFormHref(request.id"),
);

check(
  "OfferSendCta navigates via router.push(href)",
  offerSendCta.includes("router.push(href)") &&
    offerSendCta.includes("Bu talebe teklif ver"),
);

check(
  "detail hides offer CTA for request owner",
  detailPage.includes("isRequestOwner") &&
    detailPage.includes("Bu sizin talebiniz") &&
    detailPage.includes("<OfferSendCta href={teklifHref} />") &&
    /isRequestOwner \?\s*\(/.test(detailPage),
);

check(
  "detail uses canAccessRequest before full fetch (locked preview)",
  detailPage.includes("canAccessRequest") && detailPage.includes("LockedRequestPreview"),
);

check(
  "offer page rejects owner via query filter",
  offerPage.includes("createdById: { not: user.id }"),
);

check(
  "entitlement delay redirects to detail, not 404",
  offerPage.includes("redirect(`/panel/talepler/${id}`)") &&
    !offerPage.match(/canAccessRequest[\s\S]{0,120}notFound\(\)/),
);

check(
  "discovery card fallback matches canonical offer path",
  discoveryCard.includes("/panel/talepler/${item.requestId}/teklif"),
);

check(
  "attributed helper delegates to offerFormHref",
  attributedHref.includes("offerFormHref(input.requestId)"),
);

check(
  "dev cache guard watches offer route registration",
  ensureDev.includes('"/panel/talepler/[id]/teklif"') &&
    ensureDev.includes("isCorruptedRoutesFile"),
);

check(
  "detail and offer share open status filter",
  detailPage.includes('"PUBLISHED"') &&
    detailPage.includes('"RECEIVING_OFFERS"') &&
    offerPage.includes('"PUBLISHED"') &&
    offerPage.includes('"RECEIVING_OFFERS"'),
);

console.log(`\nOffer entry routing: ${pass}/${pass + fail} PASS`);
if (fail > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
