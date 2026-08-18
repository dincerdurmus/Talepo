/**
 * Compare strip, collapsed summary, animation a11y, archive rules (43 scenarios).
 * Run: npx tsx scripts/verify-offer-compare-archive-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  canArchiveOffer,
  filterOffersByArchiveView,
  isArchivableOfferStatus,
  isActiveNegotiationOffer,
  parseOfferArchiveView,
} from "../src/lib/offer/offer-archive";
import {
  countNegotiationRounds,
  formatOfferRelativeTime,
  resolveOfferCompareDiff,
  resolveOfferCompareTurn,
  resolveOfferDecisionAmount,
  resolveOfferLastActivityAt,
} from "../src/lib/offer/offer-compare-rail";
import { compareBuyerBudgetToOffer, budgetCompareCopy } from "../src/lib/offer/budget-offer-compare";
import { compareNegotiationPrices } from "../src/lib/offer/negotiation-price-compare";

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

console.log("\n=== COMPARE RAIL ===\n");
{
  const rail = read("src/components/panel/OfferCompareRail.tsx");
  const incomingGroup = read("src/components/panel/IncomingOfferCompareGroup.tsx");
  const outgoingGroup = read("src/components/panel/OutgoingOfferCompareGroup.tsx");
  check("1 rail Scale icon", rail.includes("Scale") && rail.includes("rounded-full"));
  check("1b mobile horizontal terazi", rail.includes("lg:hidden") && rail.includes("flex min-w-0 items-center"));
  check("1c desktop vertical strip", rail.includes("hidden min-h-full") && rail.includes("lg:flex"));
  check("1d terazi white gradient", rail.includes("via-white") && !rail.includes("bg-[#faf8f4]"));
  check("1e turn hint prominent", rail.includes("TurnHint") && rail.includes("text-base font-semibold"));
  check("2 three-column incoming", incomingGroup.includes("OfferCompareRail") && incomingGroup.includes("grid-cols-[minmax(0,17.5rem)_9.5rem"));
  check("3 three-column outgoing", outgoingGroup.includes("OfferCompareRail") && outgoingGroup.includes("grid-cols-[minmax(0,17.5rem)_9.5rem"));
  check("4 left amber request summary", incomingGroup.includes("Sizin talebiniz"));
  check("5 seller Müşterinin talebi", outgoingGroup.includes("Müşterinin talebi"));
  check("6 compareStripLayout hides duplicate price", read("src/components/panel/IncomingOfferCard.tsx").includes("compareStripLayout"));
  check("7 no price caption in strip mode", read("src/components/panel/IncomingOfferCard.tsx").includes("!compareStripLayout"));
  check("8 turn Sıra sizde", resolveOfferCompareTurn("buyer", { status: "SUBMITTED", negotiations: [] }) === "Sıra sizde");
  check("9 turn Sıra satıcıda buyer waiting", resolveOfferCompareTurn("buyer", {
    status: "VIEWED",
    negotiations: [{ status: "PENDING", proposedBySide: "BUYER", createdAt: "2026-01-01" }],
  }) === "Sıra satıcıda");
  check("10 budget diff utility wired", resolveOfferCompareDiff({
    status: "SUBMITTED",
    amount: 48000,
    currency: "TRY",
    negotiations: [],
    budgetMax: 45000,
    requestCurrency: "TRY",
  }).relativeLabel.includes("üstünde"));
  check("11 negotiation diff utility wired", resolveOfferCompareDiff({
    status: "VIEWED",
    amount: 48000,
    currency: "TRY",
    negotiations: [{ status: "PENDING", proposedBySide: "PROVIDER", amount: 43000, currency: "TRY", createdAt: "2026-01-02" }],
    budgetMax: 45000,
    requestCurrency: "TRY",
  }).deltaLabel.includes("fark"));
}

console.log("\n=== COLLAPSED SUMMARY ===\n");
{
  const summary = read("src/components/panel/OfferCollapsedSummary.tsx");
  check("12 collapsed summary component", summary.includes("OfferCollapsedSummary"));
  check("13 role label", summary.includes("roleLabel"));
  check("14 city MapPin", summary.includes("MapPin"));
  check("15 photo count Camera", summary.includes("Camera"));
  check("16 Yeni badge", summary.includes("Yeni"));
  check("17 Yanıtınız bekleniyor", summary.includes("Yanıtınız bekleniyor"));
  check("18 negotiation rounds", summary.includes("tur"));
  check("19 multi-line layout grid", summary.includes("grid"));
  check("20 group uses collapsed summary", read("src/components/panel/IncomingOfferCompareGroup.tsx").includes("OfferCollapsedSummary"));
  check("21 round count helper", countNegotiationRounds([
    { status: "ACCEPTED", proposedBySide: "BUYER", amount: 1, currency: "TRY", createdAt: "2026-01-01" },
    { status: "REJECTED", proposedBySide: "PROVIDER", amount: 2, currency: "TRY", createdAt: "2026-01-02" },
  ]) === 2);
  check("22 relative time helper", formatOfferRelativeTime(new Date(Date.now() - 120_000)) === "2 dk önce");
}

console.log("\n=== ENVELOPE ANIMATION / A11Y ===\n");
{
  const group = read("src/components/panel/CollapsibleOfferGroup.tsx");
  check("23 aria-expanded on toggle", group.includes("aria-expanded={open}"));
  check("24 aria-controls", group.includes("aria-controls={panelId}"));
  check("25 role region", group.includes('role="region"'));
  check("26 min-h-11 toggle target", group.includes("min-h-11"));
  check("27 grid-rows animation", group.includes("grid-rows-[1fr]") && group.includes("grid-rows-[0fr]"));
  check("28 opacity translateY", group.includes("translate-y-0") && group.includes("-translate-y-1"));
  check("29 prefers-reduced-motion", group.includes("motion-reduce"));
  check("30 envelope flap hint", group.includes("from-amber-200/70"));
  check("31 duration 220ms band", group.includes("220ms"));
}

console.log("\n=== ARCHIVE MODEL / API ===\n");
{
  const schema = read("prisma/schema.prisma");
  const migration = read("prisma/migrations/20260818120000_offer_archive_v1/migration.sql");
  check("32 OfferArchive model", schema.includes("model OfferArchive"));
  check("33 userId offerId companyId fields", schema.includes("userId") && schema.includes("offerId") && schema.includes("companyId"));
  check("34 partial unique indexes migration", migration.includes("OfferArchive_personal_unique") && migration.includes("OfferArchive_company_unique"));
  check("35 archive API route", read("src/app/api/offers/[id]/archive/route.ts").includes("archiveOfferForUser"));
  check("36 unarchive API route", read("src/app/api/offers/[id]/unarchive/route.ts").includes("unarchiveOfferForUser"));
  check("37 Arşivle label not Sil", read("src/components/panel/OfferArchiveActions.tsx").includes("Arşivle") && !read("src/components/panel/OfferArchiveActions.tsx").includes(">Sil<"));
  check("38 Aktife geri al", read("src/components/panel/OfferArchiveActions.tsx").includes("Aktife geri al"));
  check("39 archive chip incoming", read("src/components/panel/IncomingOfferInboxFilters.tsx").includes("Arşiv"));
  check("40 archive chip outgoing", read("src/components/panel/OutgoingOfferInboxFilters.tsx").includes("Arşiv"));
  check("41 gorunum=arsiv param", read("src/lib/offer/incoming-offer-inbox.ts").includes('gorunum", "arsiv"'));
}

console.log("\n=== ARCHIVE RULES ===\n");
{
  check("42 ACCEPTED archivable when read", canArchiveOffer({
    offer: { status: "ACCEPTED", negotiations: [] },
    isUnread: false,
    isActionRequired: false,
  }));
  check("43 unread blocks archive", !canArchiveOffer({
    offer: { status: "ACCEPTED", negotiations: [] },
    isUnread: true,
    isActionRequired: false,
  }));
  check("44 action-required blocks archive", !canArchiveOffer({
    offer: { status: "SUBMITTED", negotiations: [] },
    isUnread: false,
    isActionRequired: true,
  }));
  check("45 active negotiation blocks archive", !canArchiveOffer({
    offer: {
      status: "VIEWED",
      negotiations: [{ status: "PENDING", proposedBySide: "PROVIDER", createdAt: "2026-01-01" }],
    },
    isUnread: false,
    isActionRequired: false,
  }));
  check("46 SUBMITTED not archivable", !isArchivableOfferStatus("SUBMITTED"));
  check("47 WITHDRAWN archivable status", isArchivableOfferStatus("WITHDRAWN"));
  check("48 active view excludes archived", filterOffersByArchiveView(
    [{ id: "a" }, { id: "b" }],
    new Set(["b"]),
    "active",
  ).length === 1);
  check("49 archive view only archived", filterOffersByArchiveView(
    [{ id: "a" }, { id: "b" }],
    new Set(["b"]),
    "archive",
  ).map((row) => row.id).join(",") === "b");
  check("50 parse archive view", parseOfferArchiveView("arsiv") === "archive");
  check("51 unread excludes archived ids", read("src/lib/offer/offer-event-unread.ts").includes("archivedOfferIdsForScope"));
  check("52 auto unarchive on notification", read("src/server/notifications/create-notification.ts").includes("unarchiveOfferOnNewEvent"));
  check("53 deep link archived redirect incoming", read("src/app/panel/gelen-teklifler/page.tsx").includes("archiveView: true"));
  check("54 deep link archived redirect outgoing", read("src/app/panel/teklifler/page.tsx").includes("archiveView: true"));
  check("55 decision amount helper", resolveOfferDecisionAmount({
    status: "SUBMITTED",
    amount: 1000,
    currency: "TRY",
    negotiations: [],
  }) === 1000);
  check("56 last activity helper", resolveOfferLastActivityAt({
    createdAt: "2026-01-01",
    negotiations: [{ status: "PENDING", proposedBySide: "BUYER", amount: 900, currency: "TRY", createdAt: "2026-02-01" }],
  }) != null);
  check("57 budget compare still valid", compareBuyerBudgetToOffer({
    budgetMax: 45000,
    requestCurrency: "TRY",
    offerAmount: 48000,
    offerCurrency: "TRY",
  }).kind === "above");
  check("58 negotiation compare still valid", compareNegotiationPrices({
    originalAmount: 48000,
    pendingAmount: 43000,
    originalCurrency: "TRY",
    pendingCurrency: "TRY",
  }).kind === "down");
  check("59 active negotiation detector", isActiveNegotiationOffer({
    status: "VIEWED",
    negotiations: [{ status: "PENDING", proposedBySide: "BUYER", createdAt: "2026-01-01" }],
  }));
  check("60 message block preserved", read("src/components/panel/IncomingOfferCard.tsx").includes("OfferMessageBlock"));
}

console.log("\n=== PRISMA DELEGATE / INLINE SURFACES ===\n");
{
  const generated = read("src/generated/prisma/internal/class.ts");
  check("61 offerArchive delegate generated", generated.includes("get offerArchive()"));
  check("62 no separate pazarlik route", !read("src/components/panel/panel-nav.ts").includes("/panel/pazarlik"));
  check("63 negotiation deep link stays inbox", read("src/lib/offer/negotiation-inbox-path.ts").includes("/panel/gelen-teklifler"));
  check("64 inline compare not modal", !read("src/components/panel/IncomingOfferCompareGroup.tsx").includes("Dialog"));
  check("65 budget null no fake percent", budgetCompareCopy(
    compareBuyerBudgetToOffer({
      budgetMax: null,
      requestCurrency: "TRY",
      offerAmount: 48000,
      offerCurrency: "TRY",
    }),
    "TRY",
  ).relativeLabel.includes("gösterilmiyor"));
  check("66 currency mismatch no percent", budgetCompareCopy(
    compareBuyerBudgetToOffer({
      budgetMax: 45000,
      requestCurrency: "TRY",
      offerAmount: 48000,
      offerCurrency: "USD",
    }),
    "TRY",
  ).relativeLabel.includes("yapılamadı"));
}

if (fail > 0) {
  console.log(`\nFAILED ${fail}/${pass + fail}`);
  for (const error of errors) console.log(` - ${error}`);
  process.exit(1);
}

console.log(`\nOK ${pass}/${pass + fail} — offer compare archive v1`);
