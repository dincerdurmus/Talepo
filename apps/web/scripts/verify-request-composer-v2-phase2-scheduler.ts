/**
 * Phase 2 verifier — question scheduler, entity roles, publish readiness, scenarios.
 */
import assert from "node:assert/strict";

import { syncFromText } from "../src/lib/request-composer/sync";
import { toResolverFieldBag } from "../src/lib/request-composer/build-state";
import { buildUnderstoodFacts } from "../src/lib/request-composer/ui-helpers";
import { resolveHybridQuestions } from "../src/lib/request-composer/questions";
import {
  selectFocusedQuestions,
  scheduleComposerQuestions,
} from "../src/lib/request-composer/v2/focused-questions";
import {
  isInvalidBrandCandidate,
  isInvalidModelCandidate,
  sanitizeFactRoles,
} from "../src/lib/request-composer/v2/entity-roles";
import { computeComposerPublishReadiness } from "../src/lib/request-composer/v2/publish-readiness";
import { isFieldSatisfied } from "../src/lib/request-composer/v2/question-scheduler";
import { listProfilesForCategory } from "../src/lib/request-composer/v2/question-profiles";

function factsMap(text: string) {
  const { state } = syncFromText(null, text);
  const facts = buildUnderstoodFacts(state);
  const byKey = Object.fromEntries(facts.map((f) => [f.key, f.displayValue]));
  return { state, facts, byKey, categoryId: state.categoryId };
}

function scheduleFor(text: string, values: Record<string, string> = {}) {
  const { state } = syncFromText(null, text);
  const hybrid = resolveHybridQuestions(state);
  const needType =
    state.fields.needType?.kind === "VALUE"
      ? String(state.fields.needType.value ?? "")
      : null;
  const locCity = state.understanding.location?.city?.value?.trim();
  const locDistrict = state.understanding.location?.district?.value?.trim();
  const reComplete =
    state.categoryId === "real-estate"
      ? Boolean(locCity && locDistrict)
      : undefined;
  return scheduleComposerQuestions({
    categoryId: state.categoryId ?? "technology",
    needType,
    candidates: hybrid.candidates,
    values: {
      quantity: values.quantity,
      city: values.city ?? locCity,
      budget: values.budget,
      delivery: values.delivery,
      ...values,
    },
    realEstateLocationComplete: values.city?.includes("/")
      ? true
      : reComplete,
  });
}

let failed = 0;
let passed = 0;

function check(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`PASS  ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL  ${name}`);
    console.error(error);
  }
}

check("entity: category word is not brand", () => {
  assert.equal(isInvalidBrandCandidate("matbaa"), true);
  assert.equal(isInvalidBrandCandidate("Arçelik"), false);
});

check("entity: quantity phrase is not model", () => {
  assert.equal(
    isInvalidModelCandidate({
      model: "5000 broşür",
      brand: null,
      productType: "broşür",
    }),
    true,
  );
});

check("entity: brand≠model dedupe", () => {
  const cleaned = sanitizeFactRoles({
    brand: "Arçelik",
    model: "Arçelik",
    productType: "Televizyon",
  });
  assert.equal(cleaned.model, null);
});

check("scheduler: max 3 visible, more critical remain", () => {
  const schedule = scheduleFor("Arçelik 55 inç televizyon arıyorum");
  assert.ok(schedule.visible.length <= 3);
  assert.ok(
    schedule.remainingCriticalCount + schedule.remainingOptionalCount >=
      schedule.visible.length,
  );
  assert.equal(schedule.canEnterReview, false);
});

check("scheduler: answered quantity not re-asked (printing)", () => {
  const schedule = scheduleFor("Matbaa için 5000 broşür baskısı istiyorum", {
    quantity: "5000",
  });
  assert.ok(!schedule.visible.some((q) => q.fieldKey === "quantity"));
  assert.ok(
    !schedule.blockingFieldKeys.includes("quantity") ||
      schedule.blockingFieldKeys.filter((k) => k === "quantity").length === 0,
  );
});

/**
 * ÖNCE BÜTÇE + KONUM, SONRA DETAY (kurucu, 2026-09-12).
 * Bütçe/konum açıkken görünen küme yalnız onlardır; kapanınca kategori
 * soruları "Talebi detaylandır" başlığıyla gelir. Metinde yazılmış konum
 * ilk aşamayı atlatır.
 */
check("scheduler: essentials phase shows only budget/city while they are open", () => {
  const schedule = scheduleFor("Arçelik 55 inç televizyon arıyorum");
  assert.equal(schedule.phase, "essentials");
  assert.ok(schedule.visible.length >= 1);
  assert.ok(
    schedule.visible.every((q) => q.importance === "publish_required"),
    `beklenen yalnız publish_required, alınan ${schedule.visible.map((q) => q.fieldKey).join(",")}`,
  );
  assert.ok(schedule.visible.some((q) => q.fieldKey === "budget"));
  assert.ok(schedule.visible.some((q) => q.fieldKey === "city"));
  assert.equal(schedule.phaseHeading, "Teklif için iki bilgi yeterli");
});

check("scheduler: detail phase opens after budget and city are answered", () => {
  const schedule = scheduleFor("Arçelik 55 inç televizyon arıyorum", {
    budget: "25000",
    city: "İstanbul / Kadıköy",
  });
  assert.equal(schedule.phase, "detail");
  assert.ok(!schedule.visible.some((q) => q.importance === "publish_required"));
  assert.equal(schedule.phaseHeading, "Talebi detaylandır, daha gerçek teklif al");
});

check("scheduler: city written in the text (budget answered) skips the essentials phase", () => {
  const schedule = scheduleFor(
    "Arçelik 55 inç televizyon arıyorum, İstanbul Kadıköy, bütçem 25 bin",
    { budget: "25000" },
  );
  assert.ok(!schedule.visible.some((q) => q.fieldKey === "budget"));
  assert.ok(!schedule.visible.some((q) => q.fieldKey === "city"));
  assert.equal(schedule.phase, "detail");
});

/**
 * YAZDIĞINI SORMA — otomotiv (kurucu, 2026-09-12). Metindeki mevsim ve
 * parça-araç yılı kanonik alana bağlanır; lastik akışına genel ürün
 * soruları girmez.
 */
check("automotive: 'kışlık' binds tireSeason from text", () => {
  const { state } = syncFromText(null, "205/55 R16 kışlık 4 adet lastik arıyorum");
  assert.equal(state.categoryId, "automotive");
  assert.equal(state.fields.tireSeason?.kind, "VALUE");
  assert.equal(String(state.fields.tireSeason?.value), "Kış");
  assert.equal(state.fields.tireSeason?.provenance, "EXPLICIT_TEXT");
  const summer = syncFromText(null, "Yazlık lastik arıyorum 195/65 R15").state;
  assert.equal(String(summer.fields.tireSeason?.value), "Yaz");
  const all = syncFromText(null, "Dört mevsim lastik arıyorum").state;
  assert.equal(String(all.fields.tireSeason?.value), "Dört mevsim");
});

check("automotive: part request year becomes partVehicleYear", () => {
  const { state } = syncFromText(null, "Renault Clio 2015 arka tampon arıyorum");
  assert.equal(state.categoryId, "automotive");
  assert.equal(state.fields.partVehicleYear?.kind, "VALUE");
  assert.equal(String(state.fields.partVehicleYear?.value), "2015");
  assert.equal(state.fields.partVehicleYear?.provenance, "EXPLICIT_TEXT");
  const schedule = scheduleFor("Renault Clio 2015 arka tampon arıyorum", {
    budget: "5000",
    city: "İstanbul / Kadıköy",
  });
  assert.ok(!schedule.visible.some((q) => q.fieldKey === "partVehicleYear"));
});

check("automotive: tire flow does not ask product condition or model", () => {
  const schedule = scheduleFor("Araba lastiği arıyorum", {
    budget: "5000",
    city: "İstanbul / Kadıköy",
  });
  assert.equal(schedule.phase, "detail");
  const keys = schedule.visible.map((q) => q.fieldKey);
  assert.ok(!keys.includes("condition"), `condition soruldu: ${keys.join(",")}`);
  assert.ok(!keys.includes("model"), `model soruldu: ${keys.join(",")}`);
  const profileKeys = listProfilesForCategory({
    categoryId: "automotive",
    needType: "tire",
    productType: "Lastik",
  }).map((p) => p.fieldKey);
  assert.ok(!profileKeys.includes("condition"), profileKeys.join(","));
  assert.ok(!profileKeys.includes("model"), profileKeys.join(","));
  assert.ok(profileKeys.includes("tireSize"), profileKeys.join(","));
});

check("automotive: '800 bine kadar' is a written budget and is not re-asked", () => {
  const { state } = syncFromText(null, "Hatasız ikinci el SUV arıyorum 800 bine kadar");
  assert.equal(state.categoryId, "automotive");
  assert.equal(
    state.fields.budget?.kind,
    "VALUE",
    `budget alanı yok: ${JSON.stringify(state.understanding.budget)}`,
  );
  assert.equal(state.fields.budget?.provenance, "EXPLICIT_TEXT");
  const bag = toResolverFieldBag(state);
  assert.ok(bag.budget, `bag.budget boş: ${JSON.stringify(bag)}`);
  const kgOnly = syncFromText(null, "Oto koltuğu arıyorum 9-36 kg").state;
  assert.notEqual(kgOnly.fields.budget?.kind, "VALUE", "kg aralığı bütçe sayıldı");
});

check("automotive: 'İzmir Bornova' written without a comma is the location", () => {
  const { state } = syncFromText(
    null,
    "2019 Renault Clio arıyorum, İzmir Bornova, bütçem 700 bin",
  );
  const city = state.understanding.location?.city?.value;
  assert.equal(
    String(city ?? ""),
    "İzmir / Bornova",
    `understanding city=${JSON.stringify(state.understanding.location)}`,
  );
  /* Konum kanonik alan olarak yazılmaz (dokunulmamış ortak alan sunucuya
     sızmamalı kuralı); sayfa onu anlama katmanından okur. Ölçüt sayfa
     yoludur: soru görünmez. */
  const schedule = scheduleFor(
    "2019 Renault Clio arıyorum, İzmir Bornova, bütçem 700 bin",
    { budget: "700000" },
  );
  assert.ok(!schedule.visible.some((q) => q.fieldKey === "city"), schedule.visible.map((q) => q.fieldKey).join(","));
});

check("scheduler: RE without city cannot review", () => {
  const schedule = scheduleFor("Kiralık 3+1 daire arıyorum");
  const readiness = computeComposerPublishReadiness({
    hasUsableText: true,
    schedule,
    categoryId: "real-estate",
    realEstateLocationComplete: false,
  });
  assert.equal(readiness.canReview, false);
  assert.ok(
    schedule.blockingFieldKeys.includes("city") ||
      readiness.blockingLabels.some((l) => /il|konum|ilçe/i.test(l)),
  );
});

check("budget open_to_offers satisfies quote_critical", () => {
  assert.equal(
    isFieldSatisfied({
      fieldKey: "budget",
      state: { softStatus: "open_to_offers", value: "open_to_offers" },
      importance: "quote_critical",
      allowUnknown: true,
      allowDontCare: true,
    }),
    true,
  );
});

check("skip optional does not satisfy publish_required", () => {
  assert.equal(
    isFieldSatisfied({
      fieldKey: "city",
      state: {},
      importance: "publish_required",
      allowUnknown: false,
      allowDontCare: false,
      optionallySkipped: true,
    }),
    false,
  );
});

check("scenario: Arçelik TV facts", () => {
  const { byKey } = factsMap("Arçelik 55 inç televizyon arıyorum");
  assert.match(String(byKey.brand ?? ""), /Arçelik/i);
  assert.ok(!byKey.model || !/inç|televizyon/i.test(byKey.model));
  assert.ok(
    /televizyon|tv/i.test(String(byKey.productType ?? byKey.applianceType ?? "")),
  );
});

check("scenario: A55 D model kept", () => {
  const { byKey } = factsMap("Arçelik A55 D 55 inç televizyon arıyorum");
  assert.match(String(byKey.brand ?? ""), /Arçelik/i);
  assert.match(String(byKey.model ?? ""), /A55\s*D/i);
  assert.ok(!/Galaxy/i.test(String(byKey.model ?? "")));
});

check("scenario: matbaa no brand", () => {
  const { byKey, categoryId } = factsMap(
    "Matbaa için 5000 broşür baskısı istiyorum",
  );
  assert.ok(
    categoryId === "printing" ||
      /matbaa|baskı|print/i.test(categoryId ?? ""),
  );
  assert.ok(!byKey.brand || isInvalidBrandCandidate(byKey.brand));
  assert.ok(!byKey.model);
});

check("scenario: Heidelberg pump", () => {
  const { byKey } = factsMap(
    "Heidelberg SM 74 için nemlendirme pompası arıyorum",
  );
  assert.match(String(byKey.brand ?? ""), /Heidelberg/i);
  assert.match(String(byKey.model ?? ""), /SM\s*74/i);
});

check("scenario: RE with location", () => {
  const { byKey, categoryId, state } = factsMap(
    "Ankara Çankaya’da kiralık 3+1 daire arıyorum",
  );
  assert.equal(categoryId, "real-estate");
  const city =
    byKey.city ?? state.understanding.location?.city?.value ?? "";
  assert.match(String(city), /Ankara/i);
  assert.ok(!byKey.brand, `brand should be empty, got ${byKey.brand}`);
  assert.ok(!byKey.model, `model should be empty, got ${byKey.model}`);
  const schedule = scheduleFor(
    "Ankara Çankaya’da kiralık 3+1 daire arıyorum",
  );
  assert.ok(!schedule.blockingFieldKeys.includes("city"));
});

check("scenario: Clio facts", () => {
  const { byKey } = factsMap("2019 Renault Clio 1.5 dCi otomatik arıyorum");
  assert.match(String(byKey.brand ?? ""), /Renault/i);
  assert.match(String(byKey.model ?? ""), /Clio/i);
});

check("scenario: Bosch Serie 6", () => {
  const { byKey } = factsMap("Bosch Serie 6 çamaşır makinesi arıyorum");
  assert.match(String(byKey.brand ?? ""), /Bosch/i);
  // Serie 6 may be family — model must not be invented garbage
  if (byKey.model) {
    assert.ok(!/çamaşır|makine/i.test(byKey.model));
  }
});

check("focused selectVisible ≤ 3", () => {
  const { state } = syncFromText(
    null,
    "Arçelik 55 inç televizyon arıyorum",
  );
  const hybrid = resolveHybridQuestions(state);
  const focused = selectFocusedQuestions({
    candidates: hybrid.candidates,
    strategy: null,
    requiredDynamicKeys: [],
    dynamicFields: [],
    categoryId: state.categoryId ?? "technology",
    values: {},
    maxVisible: 3,
  });
  assert.ok(focused.length <= 3);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
