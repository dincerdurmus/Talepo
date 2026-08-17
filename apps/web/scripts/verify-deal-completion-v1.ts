/**
 * Bilateral deal completion + trust signal V1.
 * Run: npx tsx scripts/verify-deal-completion-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  BILATERAL_COMPLETED_WHERE,
  DEAL_COMPLETION_NOT_ELIGIBLE_MESSAGE,
  formatCompletedTransactionCount,
  isBilateralDealCompleted,
} from "../src/lib/offer/deal-completion";
import { featuresForPlan } from "../src/lib/membership/entitlements";
import {
  deriveNotificationPath,
  resolveNotificationDestination,
} from "../src/lib/notifications/destination";
import { resolveOfferCommercialAmount } from "../src/lib/offer/commercial-amount";

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

const schema = read("prisma/schema.prisma");
const migration = read(
  "prisma/migrations/20260817183000_deal_completion_v1/migration.sql",
);
const dealService = read("src/server/price-intelligence/deal-outcome.ts");
const panel = read("src/components/panel/DealOutcomePanel.tsx");
const api = read("src/app/api/deal-outcomes/route.ts");
const offerService = read("src/server/offer/offer-service.ts");
const intelligence = read("src/server/monetization/offer-intelligence.ts");
const radar = read("src/server/monetization/talepo-radar.ts");
const destination = read("src/lib/notifications/destination.ts");
const analiz = read("src/server/monetization/professional-analytics.ts");
const dashboard = read("src/components/panel/AnalyticsDashboard.tsx");

console.log("\n=== ACCEPTED ≠ COMPLETED ===\n");
{
  check(
    "1 SUBMITTED not eligible copy",
    DEAL_COMPLETION_NOT_ELIGIBLE_MESSAGE.includes("kabul edilmiş"),
  );
  check(
    "one-sided not completed",
    !isBilateralDealCompleted({
      status: "COMPLETED",
      confirmationLevel: "BUYER_CONFIRMED",
      completedAt: new Date(),
      buyerConfirmedAt: new Date(),
      supplierConfirmedAt: null,
    }),
  );
  check(
    "both confirmed is completed",
    isBilateralDealCompleted({
      status: "COMPLETED",
      confirmationLevel: "BOTH_CONFIRMED",
      completedAt: new Date(),
      buyerConfirmedAt: new Date(),
      supplierConfirmedAt: new Date(),
    }),
  );
  check(
    "pending not completed",
    !isBilateralDealCompleted({
      status: "PENDING",
      confirmationLevel: "NONE",
      completedAt: null,
      buyerConfirmedAt: null,
      supplierConfirmedAt: null,
    }),
  );
  check(
    "trust where requires both timestamps",
    BILATERAL_COMPLETED_WHERE.confirmationLevel === "BOTH_CONFIRMED" &&
      BILATERAL_COMPLETED_WHERE.status === "COMPLETED",
  );
  check(
    "honest count copy",
    formatCompletedTransactionCount(12) === "12 tamamlanan işlem",
  );
}

console.log("\n=== AUTHORITY / AGREED PRICE ===\n");
{
  check("reuses DealOutcome model", schema.includes("model DealOutcome"));
  check("no second Transaction model", !schema.includes("model Transaction"));
  check(
    "accept still snapshots commercial amount",
    offerService.includes("createPendingDealOutcome") &&
      offerService.includes("offerAmount: commercialAmount"),
  );
  check(
    "direct accept commercial = offer amount",
    resolveOfferCommercialAmount({
      offerAmount: 75000,
      acceptedNegotiationAmount: null,
    }) === 75000,
  );
  check(
    "negotiated accept commercial = negotiation",
    resolveOfferCommercialAmount({
      offerAmount: 75000,
      acceptedNegotiationAmount: 73500,
    }) === 73500,
  );
  check(
    "completion does not write agreedPrice",
    !dealService
      .slice(dealService.indexOf("export async function confirmDealCompletion"))
      .includes("agreedPrice: input") && !api.includes("body.agreedPrice"),
  );
}

console.log("\n=== BILATERAL / ATOMIC ===\n");
{
  check("confirm uses FOR UPDATE", dealService.includes("FOR UPDATE"));
  check("buyerConfirmedAt null guard", dealService.includes("buyerConfirmedAt: null"));
  check("supplierConfirmedAt null guard", dealService.includes("supplierConfirmedAt: null"));
  check("completedAt once", dealService.includes("confirmationLevel: \"BOTH_CONFIRMED\""));
  check("request completed only after both", dealService.includes('status: "COMPLETED"') && dealService.includes("OFFER_SELECTED"));
  check("offer ACCEPTED required", dealService.includes("offer?.status !== \"ACCEPTED\"") || dealService.includes('status !== "ACCEPTED"'));
  check("role derived server-side", dealService.includes("resolveNegotiationActorSide") && !api.includes("body.role"));
  check("company membership reused", dealService.includes("resolveNegotiationActorSide"));
}

console.log("\n=== COPY / UI ===\n");
{
  check("confirm copy", panel.includes("Bu işlemin tamamlandığını onaylıyorum"));
  check("completed copy", panel.includes("İşlem taraflarca tamamlandı olarak onaylandı"));
  check("no payment claim", !panel.includes("ödeme doğrulandı") && !panel.includes("Talepo güvencesi"));
  check("waiting copy", panel.includes("Karşı tarafın onayı bekleniyor"));
  check("no star ratings", !panel.includes("yıldız") && !schema.includes("model Review"));
  check("no agreed price input", !panel.includes("Gerçek anlaşma tutarı"));
  check("min 44px", panel.includes("min-h-11"));
}

console.log("\n=== NOTIFICATIONS / ENTITLEMENT ===\n");
{
  check("notification types additive", schema.includes("DEAL_COMPLETION_REQUESTED") && schema.includes("DEAL_COMPLETED"));
  check("migration additive", migration.includes("DEAL_COMPLETION_REQUESTED"));
  check("destination sanitizer", destination.includes("DEAL_COMPLETED"));
  check(
    "actionUrl conversation allowed",
    resolveNotificationDestination({
      type: "DEAL_COMPLETED",
      actionUrl: "/panel/mesajlar/c1",
      requestId: "r",
      offerId: "o",
      companyId: null,
    }) === "/panel/mesajlar/c1",
  );
  check(
    "fallback panel mesajlar",
    deriveNotificationPath({
      type: "DEAL_COMPLETION_REQUESTED",
      actionUrl: null,
      requestId: "r",
      offerId: "o",
      companyId: null,
    }) === "/panel/mesajlar",
  );
  check("no self notify", dealService.includes("otherUserId === input.actorUserId"));
  check("standard can complete", featuresForPlan("STANDARD").submit_offer === true);
  check("no plan gate on confirm", !dealService.includes("hasFeature") && !dealService.includes("PROFESSIONAL"));
}

console.log("\n=== TRUST / ANALYTICS / REGRESSION GUARDS ===\n");
{
  check("intelligence still Offer.amount", intelligence.includes("select: { amount: true }") && !intelligence.includes("dealOutcome"));
  check("radar still Offer groupBy", radar.includes("prisma.offer.groupBy"));
  check("analiz keeps accepted separate", dashboard.includes("Kabul edilen") && dashboard.includes("Tamamlanan işlemler"));
  check("completed uses bilateral where", analiz.includes("BILATERAL_COMPLETED_WHERE"));
  check("no reputation score", !panel.includes("92/100") && !dealService.includes("trustScore"));
  check("legacy not auto completed", !dealService.includes("status: \"ACCEPTED\"") || !dealService.includes("backfill"));
}

if (fail > 0) {
  console.log(`\nFAILED ${fail}/${pass + fail}`);
  for (const error of errors) console.log(` - ${error}`);
  process.exit(1);
}

console.log(`\nOK ${pass}/${pass + fail} — deal completion V1`);
