/**
 * Offer decision footer, animations, terazi styling (37 scenarios).
 * Run: npx tsx scripts/verify-offer-decision-footer-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

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

const actions = read("src/components/panel/OfferActions.tsx");
const outcome = read("src/components/panel/OfferDecisionOutcome.tsx");
const incoming = read("src/components/panel/IncomingOfferCard.tsx");
const outgoing = read("src/components/panel/OutgoingOfferCard.tsx");
const panel = read("src/components/panel/OfferNegotiationPanel.tsx");
const rail = read("src/components/panel/OfferCompareRail.tsx");
const globals = read("src/app/globals.css");

console.log("\n=== DECISION FOOTER ORDER ===\n");
{
  check("1 shared outcome component", outcome.includes("OfferDecisionOutcome"));
  check("2 footer data attribute", outcome.includes("data-offer-decision-footer"));
  check("3 layout footer mode", actions.includes('layout?: "default" | "toolbar" | "stack" | "footer"'));
  /**
   * DRIFT ONARIMI (Wave I, 2026-08-31): gelen kartta karar çubuğu bağlama
   * göre düzen seçer (seçilen-teklif masasında compact, listede footer) —
   * ölçülen bu kesin ifadedir; sabit `layout="footer"` metni tarihe karıştı.
   */
  check(
    "4 incoming uses layout footer",
    incoming.includes('layout={decisionDesk ? "compact" : "footer"}'),
  );
  check("5 outgoing uses layout footer", outgoing.includes('layout="footer"'));
  check("6 message before gallery incoming", incoming.includes("sectionOrder") && incoming.includes("galleryOrder") && incoming.indexOf("sectionOrder") < incoming.indexOf("galleryOrder"));
  check("7 gallery before history incoming", incoming.indexOf("IncomingOfferGallery") < incoming.indexOf("NegotiationHistory"));
  check("8 history before panel incoming", incoming.indexOf("NegotiationHistory") < incoming.indexOf("OfferNegotiationPanel"));
  check("9 panel before footer incoming", incoming.indexOf("OfferNegotiationPanel") < incoming.indexOf("footerOrder"));
  check("10 note before gallery outgoing", outgoing.includes("noteOrder") && outgoing.includes("galleryOrder") && outgoing.indexOf("noteOrder") < outgoing.indexOf("galleryOrder"));
  check("11 compare strip footer order-9", incoming.includes('order-9') && outgoing.includes('order-9'));
  check("12 archive after footer", incoming.includes("footerOrder") && incoming.includes("archiveOrder") && incoming.indexOf("footerOrder") < incoming.indexOf("archiveOrder"));
}

console.log("\n=== BUTTON COPY / STYLING ===\n");
{
  check("13 Teklifi kabul et", actions.includes("Teklifi kabul et"));
  check("14 Pazarlık yap", actions.includes("Pazarlık yap"));
  check("15 Teklifi reddet", actions.includes("Teklifi reddet"));
  check("16 accept primary teal", actions.includes("bg-[#0f766e]"));
  check("17 bargain amber", actions.includes("border-amber") && actions.includes("text-amber-950"));
  check("18 reject danger tone", actions.includes("text-[#8b352b]"));
  check("19 full width footer row", actions.includes("flex w-full flex-col gap-2 sm:flex-row"));
  check("20 min-h-11 targets", actions.includes("min-h-11") && outcome.includes("min-h-11"));
}

console.log("\n=== DIGITAL TRANSACTION PULSE ===\n");
{
  check("21 accept loading copy", actions.includes("Teklif doğrulanıyor…") && outcome.includes("Teklif doğrulanıyor…"));
  check("22 accept success copy", outcome.includes("Teklif kabul edildi"));
  check("22b accept verified badge", outcome.includes("DOĞRULANDI"));
  check("22c accept secure subtitle", outcome.includes("üzerinden güvenli anlaşma oluştu"));
  check("23 reject confirm title", outcome.includes("Teklifi reddetmek istiyor musunuz?"));
  check("24 reject confirm body", outcome.includes("Pazarlık geçmişi silinmeyecek"));
  check("25 reject loading copy", outcome.includes("Karar işleniyor…"));
  check("26 reject success copy", outcome.includes("Teklif reddedildi"));
  check("26b reject history preserved copy", outcome.includes("Geçmiş korunuyor"));
  check("27 price exchange channel", outcome.includes("PriceChip") && outcome.includes("Yeni fiyat önerisi oluştur"));
  check("27b no handshake animation", !outcome.includes("HandshakeAnimation") && !outcome.includes("Handshake"));
  check("27c sending copy", outcome.includes("Fiyat önerisi iletiliyor…"));
  check("28 negotiation sent copy", outcome.includes("Pazarlık teklifiniz iletildi"));
  check("28b negotiation sent subtitle", outcome.includes("Karşı tarafın yanıtı bekleniyor"));
  check("29 propose loading Gönderiliyor", panel.includes("Gönderiliyor…"));
  check("30 signal keyframes", globals.includes("@keyframes txn-signal-forward") && globals.includes("@keyframes txn-signal-back"));
  check("31 outcome draw keyframes", globals.includes("@keyframes txn-draw"));
  check("31b converge + ring keyframes", globals.includes("@keyframes txn-converge-left") && globals.includes("@keyframes txn-ring"));
  check("31c sever keyframes", globals.includes("@keyframes txn-sever-left") && globals.includes("@keyframes txn-sever-right"));
  check("31d scan keyframes", globals.includes("@keyframes txn-scan"));
  check("31e balance tie to terazi", globals.includes("@keyframes txn-balance") && outcome.includes("txn-balance"));
  check("31f legacy sweep removed", !globals.includes("@keyframes decision-sweep") && !outcome.includes("SweepBar"));
  check("32 onProposeSuccess hook", panel.includes("onProposeSuccess"));
  check("33 negotiationSent prop", actions.includes("negotiationSent"));
  check("33b negotiationSubmitting prop", actions.includes("negotiationSubmitting") && outcome.includes("negotiation-sending"));
  check("34 success refresh delay", actions.includes("SUCCESS_MS"));
  check("35 no success on error path", actions.includes('setPhase("error")'));
  check("35b drawn outcome glyphs", outcome.includes("DigitalCheck") && outcome.includes("DigitalCross") && outcome.includes("ExchangeGlyph"));
  check("35c no raster or lottie asset", !outcome.includes(".gif") && !outcome.includes("lottie") && !outcome.includes("<video"));
}

console.log("\n=== WAITING FOOTER MORPH ===\n");
{
  check("35d waiting morph phase", outcome.includes("negotiation-waiting") && actions.includes("negotiation-waiting"));
  check("35e result dwell 700-1200ms", actions.includes("RESULT_DWELL_MS = 900"));
  check("35f morph duration", actions.includes("MORPH_MS = 520"));
  check("35g refresh after morph", actions.includes("RESULT_DWELL_MS + MORPH_MS"));
  check("35h buyer waiting copy wired", read("src/components/panel/IncomingOfferCard.tsx").includes('waitingMessage="Satıcının yanıtı bekleniyor"'));
  check("35i seller waiting copy wired", read("src/components/panel/OutgoingOfferCard.tsx").includes('waitingMessage="Alıcının yanıtı bekleniyor"'));
  check("35j morph keyframe", globals.includes("@keyframes txn-morph-in"));
}

console.log("\n=== A11Y / REDUCED MOTION ===\n");
{
  check("36 aria-busy accept", actions.includes('aria-busy={loadingAction === "accept"}'));
  check("37 aria-live polite", outcome.includes('aria-live="polite"'));
  check("38 role alert error", outcome.includes('role="alert"'));
  check("39 reject alertdialog", outcome.includes('role="alertdialog"'));
  check("40 motion gated behind motion-safe", outcome.includes("motion-safe:animate-[txn-") && outcome.includes("motion-reduce:hidden"));
  check("41 reduced motion bargain skip", actions.includes("prefers-reduced-motion: reduce"));
  check("42 double-submit guard", actions.includes('resolvedPhase !== "idle"'));
  check("42b timer cleanup on unmount", actions.includes("clearTimeout(timer)") && actions.includes("mounted.current = false"));
  check("42c no state update after unmount", actions.includes("if (!mounted.current) return"));
  check("42d transform/opacity only signals", !globals.includes("txn-signal-forward {\n  0% {\n    left:"));
}

console.log("\n=== TERAZI / PAZARLIK VISIBILITY ===\n");
{
  check("43 white gradient bg", rail.includes("via-white") && rail.includes("from-amber-50/35"));
  check("44 no yellow terazi bg", !rail.includes("bg-[#faf8f4]"));
  check("45 scale white circle", rail.includes("bg-white shadow") && rail.includes("Scale"));
  check("46 teal scale icon", rail.includes("text-teal-700/75"));
  check("47 PAZARLIK label uppercase", rail.includes("Pazarlık") && rail.includes("uppercase"));
  check("48 turn prominent text-base", rail.includes("text-base font-semibold"));
  check("49 turn before price desktop", rail.indexOf("TurnHint") < rail.indexOf("Güncel fiyat"));
  check("50 visual priority turn price diff", rail.indexOf("TurnHint") < rail.indexOf("deltaLabel"));
}

console.log("\n=== PENDING-COUNTER INTEGRATION ===\n");
{
  check("55 counter reject confirm title", outcome.includes("Bu pazarlık teklifini reddetmek istiyor musunuz?"));
  check("56 counter reject confirm body", outcome.includes("Bu fiyat önerisi reddedilecek"));
  check("57 counter reject confirm button", outcome.includes("Pazarlık teklifini reddet"));
  check("58 counter reject success copy", outcome.includes("Pazarlık teklifi reddedildi"));
  check("59 counter mode runPendingAction", actions.includes("runPendingAction"));
  check("60 counter rejectVariant prop", outcome.includes("rejectVariant"));
  check("61 pending onAccept Promise", actions.includes("onAccept: () => Promise<void>"));
  check("62 no pendingCounter.busy", !actions.includes("pendingCounter?.busy") && !actions.includes('busy: pendingBusy'));
  check("63 SUCCESS_MS 500-900", actions.includes("SUCCESS_MS = 700"));
  check("64 negotiate-composer phase", outcome.includes("negotiate-composer") && actions.includes("negotiate-composer"));
  check("65 composerOpen prop", actions.includes("composerOpen"));
  check("66 seller counter reject label", outgoing.includes('rejectLabel: "Pazarlık teklifini reddet"'));
  check("67 postPending throws on error incoming", incoming.includes("throw new Error") && incoming.includes("postPending"));
  check("68 channel open CHANNEL_OPEN_MS", actions.includes("CHANNEL_OPEN_MS = 460"));
  check("69 offer lifecycle reject distinct", actions.includes("Teklifi reddet") && outcome.includes('variant === "counter"'));
  check("70 double-submit pending guard", actions.includes('resolvedPhase !== "idle"') && actions.includes("runPendingAction"));
  check("70b composer phase derived not effect-set", !actions.includes('setPhase("negotiate-composer")') && actions.includes("negotiationPhase"));
}

console.log("\n=== COLLAPSED / SAFETY ===\n");
{
  check("51 collapsed no decision footer marker", !read("src/components/panel/OfferCollapsedSummary.tsx").includes("OfferDecisionOutcome"));
  check("52 collapsible envelope preserved", read("src/components/panel/CollapsibleOfferGroup.tsx").includes("from-amber-200/70"));
  check("53 archive separate", incoming.includes("OfferArchiveActions"));
  check("54 hideTriggers preserved", incoming.includes("hideTriggers"));
}

if (fail > 0) {
  console.log(`\nFAILED ${fail}/${pass + fail}`);
  for (const error of errors) console.log(` - ${error}`);
  process.exit(1);
}

console.log(`\nOK ${pass}/${pass + fail} — offer decision footer v1`);
