/**
 * Locked “Teklif taslağı” product surface until presentation status is LIVE.
 * Run: npx tsx scripts/verify-offer-draft-lock-v1.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { isOfferDraftAssistantLive } from "../src/lib/offer/offer-draft-assistant";

const root = join(process.cwd(), "src");

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

let pass = 0;
let fail = 0;

function check(label: string, ok: boolean) {
  if (ok) {
    pass += 1;
    console.log(`PASS — ${label}`);
  } else {
    fail += 1;
    console.log(`FAIL — ${label}`);
  }
}

console.log("\n=== OFFER DRAFT LOCK V1 ===\n");

check("draft assistant not LIVE", isOfferDraftAssistantLive() === false);

const draftUi = read("components/panel/OfferDraftSuggestion.tsx");
const form = read("components/panel/OfferForm.tsx");
const helper = read("lib/offer/offer-draft-assistant.ts");

check(
  "shared availability helper exists",
  helper.includes("isOfferDraftAssistantLive") &&
    helper.includes('status === "LIVE"'),
);

check(
  "detail draft has disabled button",
  draftUi.includes("disabled") && draftUi.includes('aria-disabled="true"'),
);

check(
  "detail draft has no offer-assistant fetch",
  !draftUi.includes("/api/monetization/offer-assistant") &&
    !draftUi.includes("generateDraft"),
);

check(
  "detail draft has no Link navigation to form draft",
  !draftUi.includes("Teklif formuna aktar") && !draftUi.includes("?draft="),
);

check(
  "composer uses locked draft row",
  form.includes("OfferDraftComposerLock") &&
    !form.includes('href={`/panel/asistan?request=${requestId}`}'),
);

check(
  "composer does not link Teklif taslağı oluştur when locked",
  !form.includes(">Teklif taslağı oluştur<") &&
    form.includes("OfferDraftComposerLock"),
);

check(
  "coming soon copy present",
  draftUi.includes("yakında kullanıma açılacak") ||
    helper.includes("yakında kullanıma açılacak"),
);

/**
 * TEK INTELLIGENCE CORE (FD-3 kurucu kararı, 2026-08-31).
 *
 * İki asistan giriş yüzeyi (panel bağlamı + teklif bağlamı) korunur ama
 * taslak/fiyat mantığı TEK çekirdekten türer: `@/lib/ai/offer-assistant`
 * (generateOfferAssistantDraft). Monetization sağlayıcısı kendi ikinci
 * şablonunu/fiyat metnini KURAMAZ — ölçülen kusur: rule-based stub ayrı
 * bir taslak şablonu ve sahte pricingHint taşıyordu.
 */
const monetizationProvider = read("server/monetization/ai-offer-assistant.ts");
check(
  "monetization provider derives from the single core",
  monetizationProvider.includes('from "@/lib/ai/offer-assistant"') &&
    monetizationProvider.includes("generateOfferAssistantDraft"),
);
check(
  "monetization provider keeps no second draft template",
  !monetizationProvider.includes("Kapsam:") &&
    !monetizationProvider.includes("Gerçek AI fiyat önerisi bir sonraki fazda"),
);

if (fail > 0) {
  console.log(`\nFAILED ${fail} / ${pass + fail}`);
  process.exit(1);
}

console.log(`\nALL ${pass} PASSED`);
assert.equal(fail, 0);
