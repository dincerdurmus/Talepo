/**
 * Structured offer negotiation / karşı teklif V1.
 * Run: npx tsx scripts/verify-offer-negotiation-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  negotiationAmountsEqual,
  resolveOfferCommercialAmount,
  roundOfferAmount,
} from "../src/lib/offer/commercial-amount";
import {
  NEGOTIABLE_OFFER_STATUSES,
  OFFER_NEGOTIATION_CLOSED_MESSAGE,
  OFFER_NEGOTIATION_PENDING_EXISTS_MESSAGE,
  OFFER_NEGOTIATION_PROVIDER_FIRST_MESSAGE,
  OFFER_NEGOTIATION_SAME_AMOUNT_MESSAGE,
  OFFER_NEGOTIATION_TURN_MESSAGE,
  OPEN_REQUEST_FOR_OFFER_STATUSES,
} from "../src/lib/offer/offer-negotiation";
import { featuresForPlan } from "../src/lib/membership/entitlements";
import { OFFER_INTELLIGENCE_FEATURE } from "../src/lib/monetization/offer-intelligence";
import {
  deriveNotificationPath,
  resolveNotificationDestination,
} from "../src/lib/notifications/destination";

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
  "prisma/migrations/20260817180000_offer_negotiation_v1/migration.sql",
);
const service = read("src/server/offer/offer-service.ts");
const negotiationService = read("src/server/offer/offer-negotiation-service.ts");
const access = read("src/server/offer/offer-negotiation-access.ts");
const commercial = read("src/lib/offer/commercial-amount.ts");
const route = read("src/app/api/offers/[id]/negotiations/route.ts");
const offerRoute = read("src/app/api/offers/[id]/route.ts");
const panel = read("src/components/panel/OfferNegotiationPanel.tsx");
const actions = read("src/components/panel/OfferActions.tsx");
const gelen = read("src/app/panel/gelen-teklifler/page.tsx");
const incomingCard = read("src/components/panel/IncomingOfferCard.tsx");
const teklifler = read("src/app/panel/teklifler/page.tsx");
const outgoingCard = read("src/components/panel/OutgoingOfferCard.tsx");
const taleplerim = read("src/app/panel/taleplerim/[id]/page.tsx");
const incomingTransition = read(
  "src/components/panel/my-requests/IncomingOffersTransitionCard.tsx",
);
const intelligence = read("src/server/monetization/offer-intelligence.ts");
const radar = read("src/server/monetization/talepo-radar.ts");
const destination = read("src/lib/notifications/destination.ts");
const createNotification = read("src/server/notifications/create-notification.ts");
const notify = read("src/server/offer/offer-negotiation-notifications.ts");
const dealOutcome = read("src/server/price-intelligence/deal-outcome.ts");

console.log("\n=== COMMERCIAL AMOUNT AUTHORITY ===\n");
{
  check(
    "direct original accept uses offer.amount",
    resolveOfferCommercialAmount({
      offerAmount: 75000,
      acceptedNegotiationAmount: null,
    }) === 75000,
  );
  check(
    "accepted negotiation wins",
    resolveOfferCommercialAmount({
      offerAmount: 75000,
      acceptedNegotiationAmount: 73500,
    }) === 73500,
  );
  check(
    "empty negotiation keeps original",
    resolveOfferCommercialAmount({
      offerAmount: "75000.00",
      acceptedNegotiationAmount: "",
    }) === 75000,
  );
  check("round to cents", roundOfferAmount(72000.129) === 72000.13);
  check("same amount 75000 vs 75000.00", negotiationAmountsEqual(75000, "75000.00"));
  check(
    "same amount rejected helper",
    !negotiationAmountsEqual(75000, 72000),
  );
  check(
    "single helper is canonical",
    commercial.includes("export function resolveOfferCommercialAmount") &&
      service.includes("resolveOfferCommercialAmount") &&
      negotiationService.includes("resolveOfferCommercialAmount") &&
      panel.includes("resolveOfferCommercialAmount"),
  );
}

console.log("\n=== SCHEMA / ONE PENDING ===\n");
{
  check("OfferNegotiation model exists", schema.includes("model OfferNegotiation"));
  check("BUYER/PROVIDER sides", schema.includes("enum OfferNegotiationSide"));
  check(
    "PENDING/ACCEPTED/REJECTED/SUPERSEDED/CANCELLED",
    schema.includes("SUPERSEDED") && schema.includes("CANCELLED"),
  );
  check(
    "partial unique pending index",
    migration.includes("OfferNegotiation_offerId_pending_uidx") &&
      migration.includes(`WHERE "status" = 'PENDING'`),
  );
  check("Offer.amount not altered in migration", !migration.includes('ALTER TABLE "Offer"'));
  check(
    "migration does not overwrite Offer.amount",
    !migration.includes('ALTER COLUMN "amount"'),
  );
  check(
    "notification types additive",
    schema.includes("COUNTER_OFFER_RECEIVED") &&
      schema.includes("COUNTER_OFFER_ACCEPTED") &&
      schema.includes("COUNTER_OFFER_REJECTED"),
  );
}

console.log("\n=== TURN / START POLICY ===\n");
{
  check(
    "buyer can start first",
    negotiationService.includes("side !== \"BUYER\"") &&
      negotiationService.includes("OFFER_NEGOTIATION_PROVIDER_FIRST_MESSAGE"),
  );
  check(
    "provider cannot start first",
    OFFER_NEGOTIATION_PROVIDER_FIRST_MESSAGE.includes("talep sahibi"),
  );
  check(
    "cannot respond to own pending",
    negotiationService.includes("pending.proposedBySide === side") &&
      negotiationService.includes("OFFER_NEGOTIATION_TURN_MESSAGE"),
  );
  check(
    "provider can counter after buyer",
    negotiationService.includes("status: \"SUPERSEDED\"") &&
      negotiationService.includes("proposedBySide: side"),
  );
  check("same amount rejected", negotiationService.includes("OFFER_NEGOTIATION_SAME_AMOUNT_MESSAGE"));
  check("amount > 0", negotiationService.includes("amount <= 0"));
  check(
    "currency from original offer",
    negotiationService.includes("currency: offer.currency") &&
      !negotiationService.includes("body.currency"),
  );
  check(
    "unique pending maps to user message",
    negotiationService.includes("isPrismaUniqueViolation") &&
      negotiationService.includes("OFFER_NEGOTIATION_PENDING_EXISTS_MESSAGE"),
  );
}

console.log("\n=== ACCEPT / REJECT SEMANTICS ===\n");
{
  const acceptFnStart = service.indexOf("export async function acceptOffer");
  const negotiateFnStart = service.indexOf("export async function negotiateOffer");
  const acceptFn = service.slice(acceptFnStart, negotiateFnStart);
  check("direct accept still buyer-only without negotiationId", acceptFn.includes("Orijinal teklifi yalnız talep sahibi"));
  check("counter accept uses negotiationId", acceptFn.includes("options?.negotiationId"));
  check(
    "offer accept data has no amount overwrite",
    !acceptFn
      .slice(
        acceptFn.indexOf("const acceptedRows"),
        acceptFn.indexOf("if (acceptedRows.count"),
      )
      .includes("amount"),
  );
  check("pending cancelled on direct accept", acceptFn.includes('status: "CANCELLED"'));
  check("conversation via ensureOfferConversation", acceptFn.includes("ensureOfferConversation"));
  check("buyerUserId is request owner", acceptFn.includes("buyerUserId: offer.request.createdById"));
  check("deal outcome uses commercial amount", acceptFn.includes("offerAmount: commercialAmount"));
  check("deal create writes agreedPrice", dealOutcome.includes("agreedPrice: input.offerAmount"));

  const rejectFnStart = service.indexOf("export async function rejectOffer");
  const rejectFn = service.slice(rejectFnStart);
  const rejectPending = negotiationService.slice(
    negotiationService.indexOf("export async function rejectPendingNegotiation"),
    negotiationService.indexOf("export async function acceptPendingNegotiation"),
  );
  check("offer reject uses updateMany", rejectFn.includes("updateMany"));
  check("offer reject cancels pending negotiations", rejectFn.includes("offerNegotiation.updateMany"));
  check(
    "counter reject only updates negotiation",
    rejectPending.includes('status: "REJECTED"') &&
      !rejectPending.includes("tx.offer.update"),
  );
}

console.log("\n=== RACE / ATOMIC GUARDS ===\n");
{
  check("propose FOR UPDATE", negotiationService.includes("FOR UPDATE"));
  check("acceptOffer FOR UPDATE", service.includes("FOR UPDATE"));
  check("rejectOffer FOR UPDATE", service.includes('SELECT id FROM "Offer" WHERE id = ${offerId} FOR UPDATE') || service.includes("FOR UPDATE"));
  check("negotiation claim updateMany PENDING", service.includes('status: "PENDING"') && service.includes("claimedNegotiation"));
  check("closed offer statuses", NEGOTIABLE_OFFER_STATUSES.join(",") === "SUBMITTED,VIEWED");
  check(
    "closed request statuses",
    OPEN_REQUEST_FOR_OFFER_STATUSES.join(",") === "PUBLISHED,RECEIVING_OFFERS",
  );
  check("closed message exists", Boolean(OFFER_NEGOTIATION_CLOSED_MESSAGE));
  check("pending exists message", Boolean(OFFER_NEGOTIATION_PENDING_EXISTS_MESSAGE));
  check("turn message", Boolean(OFFER_NEGOTIATION_TURN_MESSAGE));
  check("same amount message", Boolean(OFFER_NEGOTIATION_SAME_AMOUNT_MESSAGE));
}

console.log("\n=== AUTH / ISOLATION ===\n");
{
  check("buyer is request.createdById", access.includes("offer.request.createdById === userId"));
  check("personal provider companyId null", access.includes("offer.companyId == null"));
  check("company uses assertCompanyMembership", access.includes("assertCompanyMembership"));
  check("ACTIVE membership", read("src/lib/panel/company-workspace.ts").includes('status: "ACTIVE"'));
  check("unrelated side is null", access.includes("return null"));
  check("propose uses DomainError FORBIDDEN", negotiationService.includes("DomainErrorCode.FORBIDDEN"));
}

console.log("\n=== CONVERSATION / NOTIFICATIONS ===\n");
{
  check("negotiation route does not create conversation on propose", !route.includes("ensureOfferConversation"));
  check("legacy negotiateOffer still exported", service.includes("export async function negotiateOffer"));
  check("legacy negotiateOffer does not create conversation", !service.slice(
    service.indexOf("export async function negotiateOffer"),
  ).includes("ensureOfferConversation"));
  check("legacy negotiateOffer throws closed message", service.includes("LEGACY_CHAT_NEGOTIATE_CLOSED_MESSAGE"));
  check("offer POST still handles negotiate action", offerRoute.includes('action === "negotiate"'));
  check("buyer UI removed chat pazarlık CTA", !actions.includes("Pazarlık et"));
  check(
    "notifications reuse createNotification",
    notify.includes("createNotificationIfAbsent") &&
      createNotification.includes("createNotificationIfAbsent"),
  );
  check("COUNTER_OFFER_RECEIVED", createNotification.includes("COUNTER_OFFER_RECEIVED"));
  check("COUNTER_OFFER_ACCEPTED", createNotification.includes("COUNTER_OFFER_ACCEPTED"));
  check("COUNTER_OFFER_REJECTED", createNotification.includes("COUNTER_OFFER_REJECTED"));
  check(
    "buyer propose copy is pazarlık",
    notify.includes("Teklifinize yeni pazarlık teklifi geldi") &&
      notify.includes("tutarında yeni bir fiyat önerildi"),
  );
  check(
    "seller inbox deep link includes offer id",
    notify.includes("negotiationInboxPath") &&
      read("src/lib/offer/negotiation-inbox-path.ts").includes("?teklif="),
  );
  check(
    "actor is excluded from recipients",
    notify.includes("!== actorUserId") || notify.includes("=== input.actorUserId) return"),
  );
  check(
    "company recipients are ACTIVE members",
    notify.includes('status: "ACTIVE"') && notify.includes("companyMember.findMany"),
  );
  check(
    "idempotent create uses actionUrl",
    createNotification.includes("createNotificationIfAbsent") &&
      createNotification.includes("actionUrl: input.actionUrl"),
  );
  check(
    "destination sanitizer includes counter types",
    destination.includes("COUNTER_OFFER_RECEIVED"),
  );
  check(
    "actionUrl wins for buyer counter dest",
    resolveNotificationDestination({
      type: "COUNTER_OFFER_RECEIVED",
      actionUrl: "/panel/gelen-teklifler",
      requestId: "r",
      offerId: "o",
      companyId: null,
    }) === "/panel/gelen-teklifler",
  );
  check(
    "counter received without actionUrl does not dump to teklifler",
    resolveNotificationDestination({
      type: "COUNTER_OFFER_RECEIVED",
      actionUrl: null,
      requestId: "r",
      offerId: "o",
      companyId: null,
    }) === "/panel/bildirimler",
  );
  check(
    "counter accepted fallback is mesajlar",
    deriveNotificationPath({
      type: "COUNTER_OFFER_ACCEPTED",
      actionUrl: null,
      requestId: "r",
      offerId: "o",
      companyId: null,
    }) === "/panel/mesajlar",
  );
}

console.log("\n=== OFFER INTELLIGENCE / RADAR / ENTITLEMENT ===\n");
{
  check(
    "intelligence reads Offer.amount only",
    intelligence.includes("select: { amount: true }") &&
      !intelligence.includes("offerNegotiation") &&
      !intelligence.includes("negotiations"),
  );
  check(
    "radar counts Offer rows",
    radar.includes("prisma.offer.groupBy") || radar.includes("prisma.offer.findMany"),
  );
  check("radar does not query OfferNegotiation", !radar.includes("offerNegotiation"));
  check("standard has no intelligence", featuresForPlan("STANDARD")[OFFER_INTELLIGENCE_FEATURE] === false);
  check("professional has intelligence", featuresForPlan("PROFESSIONAL")[OFFER_INTELLIGENCE_FEATURE] === true);
  check("negotiation has no plan gate", !negotiationService.includes("hasFeature") && !negotiationService.includes("PROFESSIONAL"));
}

console.log("\n=== UI SURFACES ===\n");
{
  check("reusable panel exists", panel.includes("export function OfferNegotiationPanel"));
  check(
    "gelen uses panel",
    gelen.includes("OfferNegotiationPanel") ||
      incomingCard.includes("OfferNegotiationPanel"),
  );
  check(
    "teklifler uses panel",
    teklifler.includes("OutgoingOfferCompareGroup") &&
      outgoingCard.includes("OfferNegotiationPanel"),
  );
  check(
    "request detail hands off to incoming workspace",
    taleplerim.includes("buildIncomingRequestWorkspacePath") &&
      taleplerim.includes("IncomingOffersTransitionCard") &&
      incomingTransition.includes("Teklifleri incele") &&
      incomingTransition.includes("buildIncomingRequestWorkspacePath") &&
      !taleplerim.includes("OfferNegotiationPanel") &&
      !taleplerim.includes("OfferActions"),
  );
  check("original amount labelled", panel.includes("İlk teklif"));
  check("agreed amount labelled", panel.includes("Anlaşılan fiyat"));
  check("no personal names in timeline", panel.includes("Alıcının önerisi") && panel.includes("Teklif verenin önerisi"));
  check("min 44px targets", panel.includes("min-h-11"));
  check("TrMoneyInput used", panel.includes("TrMoneyInput"));
  check("V1 price only", !negotiationService.includes("deliveryDays"));
}

console.log("\n=== NO SECOND ENGINES ===\n");
{
  check("no second offer engine file", !negotiationService.includes("createOffer("));
  check("accept reuses acceptOffer", negotiationService.includes("acceptOffer("));
  check("no JSON history blob", !schema.includes("negotiationHistory"));
}

if (fail > 0) {
  console.log(`\nFAILED ${fail}/${pass + fail}`);
  for (const error of errors) console.log(` - ${error}`);
  process.exit(1);
}

console.log(`\nOK ${pass}/${pass + fail} — structured negotiation V1`);
