/**
 * Commercial journey consolidation V1.
 * Canonical: TEKLİF → KARŞI TEKLİF → PAZARLIK (OfferNegotiation) → ANLAŞMA → MESAJLAŞMA
 * Run: npx tsx scripts/verify-commercial-journey-consolidation-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { resolveOfferCommercialAmount } from "../src/lib/offer/commercial-amount";
import { LEGACY_CHAT_NEGOTIATE_CLOSED_MESSAGE } from "../src/lib/offer/offer-negotiation";
import {
  deriveNotificationPath,
  resolveNotificationDestination,
} from "../src/lib/notifications/destination";
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

const service = read("src/server/offer/offer-service.ts");
const access = read("src/server/message/conversation-access.ts");
const sendMessage = read("src/server/message/send-message.ts");
const offerRoute = read("src/app/api/offers/[id]/route.ts");
const panel = read("src/components/panel/OfferNegotiationPanel.tsx");
const actions = read("src/components/panel/OfferActions.tsx");
const existing = read("src/components/panel/OfferExistingStatus.tsx");
const composer = read("src/components/panel/MessageComposer.tsx");
const gelen = read("src/app/panel/gelen-teklifler/page.tsx");
const incomingCard = read("src/components/panel/IncomingOfferCard.tsx");
const teklifler = read("src/app/panel/teklifler/page.tsx");
const outgoingCard = read("src/components/panel/OutgoingOfferCard.tsx");
const taleplerim = read("src/app/panel/taleplerim/[id]/page.tsx");
const talepler = read("src/app/panel/talepler/[id]/page.tsx");
const teklifForm = read("src/app/panel/talepler/[id]/teklif/page.tsx");
const mesajlar = read("src/app/panel/mesajlar/page.tsx");
const mesajDetail = read("src/app/panel/mesajlar/[id]/page.tsx");
const intelligence = read("src/server/monetization/offer-intelligence.ts");
const performance = read("src/server/monetization/commercial-performance.ts");
const negotiationService = read("src/server/offer/offer-negotiation-service.ts");

console.log("\n=== LEGACY CHAT PAZARLIK REMOVED FROM JOURNEY ===\n");
{
  check(
    "legacy CTA copy gone from gelen",
    !gelen.includes("Pazarlık sohbetini aç"),
  );
  check(
    "legacy CTA copy gone from teklifler",
    !teklifler.includes("Pazarlık sohbeti"),
  );
  check(
    "legacy CTA copy gone from taleplerim",
    !taleplerim.includes("Pazarlık sohbetini aç"),
  );
  check(
    "legacy CTA copy gone from OfferExistingStatus",
    !existing.includes("Pazarlık sohbeti"),
  );
  check(
    "composer has no negotiationMode",
    !composer.includes("negotiationMode"),
  );
  check(
    "request detail messagesHref only ACCEPTED",
    talepler.includes('existingOffer.status === "ACCEPTED"') &&
      !talepler.includes('["ACCEPTED", "SUBMITTED", "VIEWED"]'),
  );
  check(
    "teklif form messagesHref only ACCEPTED",
    teklifForm.includes('existingOffer.status === "ACCEPTED"'),
  );
  check(
    "negotiateOffer throws closed message",
    service.includes("LEGACY_CHAT_NEGOTIATE_CLOSED_MESSAGE") &&
      LEGACY_CHAT_NEGOTIATE_CLOSED_MESSAGE.includes("karşı teklif"),
  );
  const negotiateSlice = service.slice(
    service.indexOf("export async function negotiateOffer"),
  );
  check(
    "negotiateOffer does not call ensureOfferConversation",
    !negotiateSlice.includes("ensureOfferConversation"),
  );
  check("POST still rejects negotiate action", offerRoute.includes("negotiate"));
}

console.log("\n=== CONVERSATION ONLY AFTER ACCEPT ===\n");
{
  check(
    "sendable conversation requires ACCEPTED",
    access.includes('status !== "ACCEPTED"') &&
      access.includes("Mesajlaşma yalnızca teklif kabul edildikten sonra açılır"),
  );
  check(
    "sendMessage uses getSendableConversation",
    sendMessage.includes("getSendableConversation"),
  );
  check(
    "conversation detail send only when accepted",
    mesajDetail.includes("const canSendMessages = offerAccepted"),
  );
  check(
    "historical conversations stay readable",
    mesajlar.includes("Salt okunur") && mesajDetail.includes("salt okunur"),
  );
  const acceptFn = service.slice(
    service.indexOf("export async function acceptOffer"),
    service.indexOf("export async function negotiateOffer"),
  );
  check(
    "accept still creates conversation",
    acceptFn.includes("ensureOfferConversation"),
  );
}

console.log("\n=== ACCEPT HIERARCHY / PRICE LABELS ===\n");
{
  check("pending accept shows amount", panel.includes("Kabul et ·"));
  check("whose turn copy", panel.includes("sıra sizde") || panel.includes("Sıra alıcıda"));
  check("original accept is secondary when pending", actions.includes("Orijinal teklifi kabul et"));
  check("pending warning copy", actions.includes("anlaşılan tutar o tutar olur"));
  check("teklifler Anlaşılan caption", read("src/lib/offer/offer-card-status.ts").includes("Anlaşılan fiyat"));
  check(
    "teklifler İlk teklif caption",
    read("src/lib/offer/offer-card-status.ts").includes("İlk teklifiniz"),
  );
  check(
    "gelen pending caption",
    read("src/lib/offer/offer-card-status.ts").includes("Satıcının son önerisi") ||
      read("src/lib/offer/offer-card-status.ts").includes("Son öneriniz"),
  );
  check("panel min-h-11", panel.includes("min-h-11") && actions.includes("min-h-11"));
}

console.log("\n=== AMOUNT AUTHORITY UNCHANGED ===\n");
{
  check(
    "agreed 73500 from 75000 original",
    resolveOfferCommercialAmount({
      offerAmount: 75000,
      acceptedNegotiationAmount: 73500,
    }) === 73500,
  );
  check(
    "OI still Offer.amount only",
    intelligence.includes("select: { amount: true }") &&
      !intelligence.includes("offerNegotiation"),
  );
  check(
    "analiz volume uses agreedPrice",
    performance.includes("agreedPrice") || performance.includes("completedVolume"),
  );
  check(
    "accept does not overwrite Offer.amount",
    !acceptSliceHasAmountOverwrite(service),
  );
}

console.log("\n=== NOTIFICATIONS ===\n");
{
  check(
    "counter received actionUrl wins",
    resolveNotificationDestination({
      type: "COUNTER_OFFER_RECEIVED",
      actionUrl: "/panel/gelen-teklifler",
      requestId: "r",
      offerId: "o",
      companyId: null,
    }) === "/panel/gelen-teklifler",
  );
  check(
    "counter received missing url stays on bildirimler",
    resolveNotificationDestination({
      type: "COUNTER_OFFER_RECEIVED",
      actionUrl: null,
      requestId: "r",
      offerId: "o",
      companyId: null,
    }) === "/panel/bildirimler",
  );
  check(
    "legacy OFFER_NEGOTIATE fallback is teklifler",
    deriveNotificationPath({
      type: "OFFER_NEGOTIATE",
      actionUrl: null,
      requestId: "r",
      offerId: "o",
      companyId: null,
    }) === "/panel/teklifler",
  );
}

console.log("\n=== ENTITLEMENT: SAME STRUCTURED NEGOTIATION ===\n");
{
  check(
    "negotiation service has no plan gate",
    !negotiationService.includes("hasFeature") &&
      !negotiationService.includes("PROFESSIONAL"),
  );
  check("standard can submit offers", featuresForPlan("STANDARD").submit_offer === true);
  check(
    "professional can submit offers",
    featuresForPlan("PROFESSIONAL").submit_offer === true,
  );
}

if (fail > 0) {
  console.log(`\nFAILED ${fail}/${pass + fail}`);
  for (const error of errors) console.log(` - ${error}`);
  process.exit(1);
}

console.log(`\nOK ${pass}/${pass + fail} — commercial journey consolidation V1`);

function acceptSliceHasAmountOverwrite(src: string) {
  const start = src.indexOf("export async function acceptOffer");
  const end = src.indexOf("export async function negotiateOffer");
  const acceptFn = src.slice(start, end);
  const claim = acceptFn.slice(
    acceptFn.indexOf("const acceptedRows"),
    acceptFn.indexOf("if (acceptedRows.count"),
  );
  return claim.includes("amount");
}
