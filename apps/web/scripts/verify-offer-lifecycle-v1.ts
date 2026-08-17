/**
 * Submitted-offer commercial lock (amount/deliveryDays immutable after SUBMITTED).
 * Run: npx tsx scripts/verify-offer-lifecycle-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  collectSubmittedCommercialLockIssues,
  deliveryDaysDiffer,
  isAwaitingOfferRevisionStatus,
  OFFER_AMOUNT_IMMUTABLE_MESSAGE,
  OFFER_DELIVERY_IMMUTABLE_MESSAGE,
  OFFER_NO_LONGER_EDITABLE_MESSAGE,
} from "../src/lib/offer/submitted-commercial-lock";
import {
  OFFER_INTELLIGENCE_FEATURE,
  OFFER_INTELLIGENCE_MIN_OTHERS,
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

function issuesFor(patch: {
  nextAmount?: number;
  nextDeliveryDays?: number | null;
  amountProvided?: boolean;
  deliveryDaysProvided?: boolean;
}) {
  return collectSubmittedCommercialLockIssues({
    currentAmount: 10000,
    currentDeliveryDays: 7,
    nextAmount: patch.nextAmount,
    nextDeliveryDays: patch.nextDeliveryDays,
    amountProvided: Boolean(patch.amountProvided),
    deliveryDaysProvided: Boolean(patch.deliveryDaysProvided),
  });
}

console.log("\n=== COMMERCIAL LOCK ===\n");
{
  const submittedAmount = issuesFor({
    amountProvided: true,
    nextAmount: 9000,
  });
  check(
    "1 SUBMITTED amount change rejected",
    submittedAmount.includes(OFFER_AMOUNT_IMMUTABLE_MESSAGE),
  );

  check(
    "2 VIEWED amount change rejected",
    issuesFor({ amountProvided: true, nextAmount: 1 }).includes(
      OFFER_AMOUNT_IMMUTABLE_MESSAGE,
    ),
  );

  check(
    "3 SUBMITTED deliveryDays change rejected",
    issuesFor({
      deliveryDaysProvided: true,
      nextDeliveryDays: 14,
    }).includes(OFFER_DELIVERY_IMMUTABLE_MESSAGE),
  );

  check(
    "4 VIEWED deliveryDays change rejected",
    issuesFor({
      deliveryDaysProvided: true,
      nextDeliveryDays: null,
    }).includes(OFFER_DELIVERY_IMMUTABLE_MESSAGE),
  );

  const textOnly = issuesFor({});
  check("5 SUBMITTED description-only has no commercial issues", textOnly.length === 0);

  check(
    "same amount is not a change",
    issuesFor({ amountProvided: true, nextAmount: 10000 }).length === 0,
  );
  check(
    "same deliveryDays is not a change",
    issuesFor({ deliveryDaysProvided: true, nextDeliveryDays: 7 }).length === 0,
  );
  check("NaN amount treated as change", amountsDifferSafe());
}

function amountsDifferSafe() {
  return collectSubmittedCommercialLockIssues({
    currentAmount: "100.00",
    currentDeliveryDays: 7,
    nextAmount: Number("nope"),
    amountProvided: true,
    deliveryDaysProvided: false,
  }).includes(OFFER_AMOUNT_IMMUTABLE_MESSAGE);
}

check("deliveryDaysDiffer 7 vs 7", deliveryDaysDiffer(7, 7) === false);
check("deliveryDaysDiffer 7 vs null", deliveryDaysDiffer(7, null) === true);

console.log("\n=== STATUS GATES ===\n");
{
  check("awaiting SUBMITTED", isAwaitingOfferRevisionStatus("SUBMITTED"));
  check("awaiting VIEWED", isAwaitingOfferRevisionStatus("VIEWED"));
  check("7 ACCEPTED not awaiting", !isAwaitingOfferRevisionStatus("ACCEPTED"));
  check("8 REJECTED not awaiting", !isAwaitingOfferRevisionStatus("REJECTED"));
  check("WITHDRAWN not awaiting", !isAwaitingOfferRevisionStatus("WITHDRAWN"));
  check("EXPIRED not awaiting", !isAwaitingOfferRevisionStatus("EXPIRED"));
  check("DRAFT not awaiting", !isAwaitingOfferRevisionStatus("DRAFT"));
}

const service = read("src/server/offer/offer-service.ts");
const patchRoute = read("src/app/api/offers/[id]/route.ts");
const createRoute = read("src/app/api/offers/route.ts");
const form = read("src/components/panel/OfferForm.tsx");
const existingStatus = read("src/components/panel/OfferExistingStatus.tsx");
const teklifPage = read("src/app/panel/talepler/[id]/teklif/page.tsx");
const tekliflerPage = read("src/app/panel/teklifler/page.tsx");
const requestDetail = read("src/app/panel/talepler/[id]/page.tsx");
const intelligenceUi = read("src/components/panel/OfferIntelligenceCard.tsx");
const intelligenceService = read("src/server/monetization/offer-intelligence.ts");

console.log("\n=== UPDATE AUTHORITY / ATOMIC GUARD ===\n");
{
  const updateFnStart = service.indexOf("export async function updateOffer");
  const nextExport = service.indexOf("export async function", updateFnStart + 10);
  const updateFn = service.slice(updateFnStart, nextExport === -1 ? undefined : nextExport);

  check("canonical updateOffer exists", updateFnStart >= 0);
  check(
    "updateOffer uses collectSubmittedCommercialLockIssues",
    updateFn.includes("collectSubmittedCommercialLockIssues"),
  );
  check(
    "updateOffer uses updateMany",
    updateFn.includes("prisma.offer.updateMany"),
  );
  check(
    "10 status-guarded write SUBMITTED|VIEWED",
    /status:\s*\{\s*in:\s*\[\.\.\.AWAITING_RESPONSE_STATUSES\]/.test(updateFn),
  );
  const writeDataStart = updateFn.indexOf("const revised = await prisma.offer.updateMany");
  const writeDataEnd = updateFn.indexOf("if (revised.count !== 1)");
  const writeBlock = updateFn.slice(writeDataStart, writeDataEnd);
  check(
    "updateMany data does not write amount",
    writeBlock.includes("data:") && !/\bamount\s*:/.test(writeBlock),
  );
  check(
    "updateMany data does not write deliveryDays",
    writeBlock.includes("data:") && !/\bdeliveryDays\s*:/.test(writeBlock),
  );
  check(
    "no id-only prisma.offer.update in updateOffer",
    !/prisma\.offer\.update\(\s*\{\s*where:\s*\{\s*id:/.test(updateFn),
  );
  check(
    "11 affected 0 uses safe domain error",
    updateFn.includes("revised.count !== 1") &&
      updateFn.includes("OFFER_NO_LONGER_EDITABLE_MESSAGE"),
  );
  check(
    "user-facing amount lock copy",
    OFFER_AMOUNT_IMMUTABLE_MESSAGE ===
      "Teklif gönderildikten sonra fiyat değiştirilemez.",
  );
  check(
    "user-facing delivery lock copy",
    OFFER_DELIVERY_IMMUTABLE_MESSAGE ===
      "Teklif gönderildikten sonra teslim süresi değiştirilemez.",
  );
  check(
    "11 safe editable error copy",
    OFFER_NO_LONGER_EDITABLE_MESSAGE ===
      "Teklif bulunamadı veya artık güncellenemez.",
  );
  check(
    "6 VIEWED text revision resets to SUBMITTED",
    updateFn.includes('status: "SUBMITTED"') && updateFn.includes("viewedAt: null"),
  );
  check(
    "12 buyer notification on text revision",
    updateFn.includes("createNotification") &&
      updateFn.includes("Teklif güncellendi"),
  );
  check(
    "PATCH detects amount key presence",
    patchRoute.includes("hasOwnProperty.call(body, \"amount\")"),
  );
  check(
    "PATCH detects deliveryDays key presence",
    patchRoute.includes("hasOwnProperty.call") &&
      patchRoute.includes("deliveryDays"),
  );
  check(
    "14 updateOffer has no professional_analytics gate",
    !updateFn.includes("professional_analytics"),
  );
  check(
    "15 personal owner isolation",
    updateFn.includes("submittedById: userId") &&
      updateFn.includes("companyId: null"),
  );
  check("16 company owner isolation", updateFn.includes("companyId"));
}

console.log("\n=== REJECTED FRESH OFFER / WITHDRAW ===\n");
{
  const blocking = service.slice(
    service.indexOf("const BLOCKING_OFFER_STATUSES"),
    service.indexOf("function validateOfferFields"),
  );
  check("9 REJECTED not in blocking statuses", !blocking.includes("REJECTED"));
  check("WITHDRAWN not in blocking statuses", !blocking.includes("WITHDRAWN"));
  check(
    "9 UI allows fresh offer after REJECTED",
    requestDetail.includes('["REJECTED", "WITHDRAWN", "EXPIRED"]') &&
      requestDetail.includes("canCreateFreshOffer"),
  );
  check("createOffer still the create authority", createRoute.includes("createOffer"));
  check("9 no withdrawOffer added", !service.includes("export async function withdrawOffer"));
}

console.log("\n=== OFFER FORM UX ===\n");
{
  check(
    "revise PATCH omits amount",
    form.includes("isRevise") &&
      form.includes("? { description }") &&
      !/isRevise \? payload/.test(form),
  );
  check(
    "amount lock copy on form",
    form.includes("Teklif tutarı gönderimden sonra değiştirilemez."),
  );
  check("revise CTA is note update", form.includes("Notu güncelle"));
  check(
    "existing status CTA is note update",
    existingStatus.includes("Teklif notunu güncelle"),
  );
  check(
    "teklif page heading is note update",
    teklifPage.includes("Teklif notunu güncelle"),
  );
  check("teklifler list CTA is note update", tekliflerPage.includes("Notu güncelle"));
  const reviseFieldsStart = form.indexOf("{isRevise ? (");
  const createFieldsStart = form.indexOf(") : (", reviseFieldsStart);
  const reviseFields = form.slice(reviseFieldsStart, createFieldsStart);
  check(
    "revise path does not keep TrMoneyInput editable",
    reviseFieldsStart >= 0 && !reviseFields.includes("TrMoneyInput"),
  );
}

console.log("\n=== OFFER INTELLIGENCE UNCHANGED ===\n");
{
  check("13 min others still 3", OFFER_INTELLIGENCE_MIN_OTHERS === 3);
  check(
    "13 feature still professional_analytics",
    OFFER_INTELLIGENCE_FEATURE === "professional_analytics",
  );
  check(
    "intelligence still on request detail",
    requestDetail.includes("getRequestOfferIntelligence") &&
      requestDetail.includes("OfferIntelligenceCard"),
  );
  check(
    "intelligence not on offer form page",
    !teklifPage.includes("getRequestOfferIntelligence") &&
      !teklifPage.includes("OfferIntelligenceCard"),
  );
  check(
    "no impression persistence added",
    !intelligenceService.includes("impression") &&
      !intelligenceService.includes("viewedIntelligence") &&
      !service.includes("OfferRevision"),
  );
  check(
    "card still anonymous aggregates",
    intelligenceUi.includes("Medyan") && intelligenceUi.includes("Kendi teklifiniz"),
  );
}

if (fail > 0) {
  console.log(`\nFAILED ${fail} / ${pass + fail}`);
  for (const error of errors) console.log(` - ${error}`);
  process.exit(1);
}

console.log(`\nALL ${pass} PASSED`);
