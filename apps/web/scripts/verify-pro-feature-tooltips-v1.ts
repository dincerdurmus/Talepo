import assert from "node:assert/strict";
import { PRO_FEATURE_PRESENTATION } from "../src/lib/membership/feature-presentation";
import { PRO_VALUE_PILLARS } from "../src/lib/membership/feature-meta";
import { featuresForPlan } from "../src/lib/membership/entitlements";
assert.equal(PRO_VALUE_PILLARS.length, 4);
for (const key of ["smart_matching", "opportunity_intelligence", "basic_market_insights", "ai_offer_assistant", "follow_up_intelligence"] as const) assert.ok(PRO_FEATURE_PRESENTATION[key]);
assert.match(PRO_FEATURE_PRESENTATION.ai_offer_assistant?.trustNote ?? "", /onayınız/);
/**
 * BEKLENTİ TAZELENDİ (OL-0011, 2026-09-20). Eski satır follow_up_intelligence
 * için "otomatik gönderilmez" trustNote'u arıyordu. O not 659ce26'da
 * (2026-08-17, iki planlı üyelik modeli) ürünle birlikte bilinçli kalktı:
 * özellik "Follow-up Intelligence" (teklif sonrası mesaj önerisi) olmaktan
 * çıkıp "Takiplerim" (kayıtlı kritere bildirim, interactionType=ALERT) oldu.
 * Bildirim göndermek bu özelliğin İŞİDİR; "otomatik gönderilmez" sözü artık
 * başka özelliğe aittir ve burada aranması yanlış pozitif üretir. Bugünkü
 * sözleşme: Takiplerim sunumu var, ALERT tipinde ve mesaj-gönderme vaadi
 * taşımaz.
 */
assert.equal(PRO_FEATURE_PRESENTATION.follow_up_intelligence?.interactionType, "ALERT");
assert.equal(PRO_FEATURE_PRESENTATION.follow_up_intelligence?.label, "Takiplerim");
assert.ok(!("trustNote" in (PRO_FEATURE_PRESENTATION.follow_up_intelligence ?? {})));
assert.equal(PRO_FEATURE_PRESENTATION.hidden_inventory?.contexts.includes("PERSONAL"), false);
assert.equal(PRO_FEATURE_PRESENTATION.automatic_opportunity_hunter, undefined);
assert.equal(featuresForPlan("STANDARD").ai_offer_assistant, false);
assert.equal(featuresForPlan("PROFESSIONAL").ai_offer_assistant, true);
console.log("verify-pro-feature-tooltips-v1: PASS");
