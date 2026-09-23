import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { syncFromBrowse, syncFromText } from "../src/lib/request-composer/sync";
import { toResolverFieldBag } from "../src/lib/request-composer/build-state";
import { resolveHybridQuestions } from "../src/lib/request-composer/questions";
import { listProfilesForCategory } from "../src/lib/request-composer/v2/question-profiles";
import { scheduleComposerQuestions } from "../src/lib/request-composer/v2/focused-questions";
import { planAnswerApplication } from "../src/lib/request-composer/v2/answer-apply-plan";
import type { CanonicalRequestState } from "../src/lib/request-composer/types";

const results: { name: string; passed: boolean; error?: string }[] = [];
function check(name: string, action: () => void) {
  try { action(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: String(error) }); }
}
function answer(state: CanonicalRequestState, key: string, rawValue: string) {
  for (const effect of planAnswerApplication({ fieldKey: key, rawValue }).effects) {
    if (effect.kind === "canonical") state = syncFromBrowse(state, {
      key: effect.fieldKey, value: effect.value, isAny: effect.isAny, kind: effect.valueKind,
    }).state;
  }
  return state;
}
function profileKeys(state: CanonicalRequestState) {
  const bag = toResolverFieldBag(state);
  return listProfilesForCategory({ categoryId: state.categoryId!, needType: bag.needType,
    productType: bag.productType || bag.serviceType }).map((q) => q.fieldKey);
}
const tireServiceKeys = ["needType", "city", "tireQuantity", "serviceDate", "budget"];
for (const text of ["Rot balans yaptırmak istiyorum", "Lastik saklama hizmeti arıyorum"]) {
  check(`${text}: common and service answers preserve the complete question contract`, () => {
    let state = syncFromText(null, text).state;
    const answered: string[] = [];
    for (let i = 0; i < 10; i++) {
      assert.equal(toResolverFieldBag(state).needType, "tire");
      assert.ok(profileKeys(state).every((key) => tireServiceKeys.includes(key)), profileKeys(state).join(","));
      const bag = toResolverFieldBag(state);
      const question = scheduleComposerQuestions({ categoryId: "automotive", needType: bag.needType,
        values: bag, candidates: resolveHybridQuestions(state).candidates,
        fieldStates: state.fields, answeredKeys: answered }).visible[0];
      if (!question) break;
      assert.ok(!answered.includes(question.fieldKey), `repeated ${question.fieldKey}`);
      assert.ok(tireServiceKeys.includes(question.fieldKey), question.fieldKey);
      const values: Record<string, string> = { budget: "30000", city: "İstanbul / Kadıköy",
        tireQuantity: "4", serviceDate: "15 Eylül 2026" };
      assert.ok(values[question.fieldKey], question.fieldKey);
      state = answer(state, question.fieldKey, values[question.fieldKey]);
      answered.push(question.fieldKey);
    }
    assert.ok(answered.includes("tireQuantity"));
    assert.ok(answered.includes("serviceDate"));
    assert.match(state.lastComposedText ?? "", /4 adet/iu);
    assert.match(state.lastComposedText ?? "", /15 Eylül 2026/iu);
    const edited = syncFromText(state, `${text}. Akşam aranmak istiyorum.`).state;
    assert.equal(toResolverFieldBag(edited).tireQuantity, "4");
    assert.equal(toResolverFieldBag(edited).serviceDate, "15 Eylül 2026");
  });
}
check("vehicle answers cannot pin a later brake-pad request", () => {
  let state = syncFromText(null, "Honda Civic araba arıyorum").state;
  for (const [key, value] of [["city", "İstanbul / Kadıköy"], ["budget", "30000"],
    ["mileage", "50000"], ["fuel", "Benzin"], ["transmission", "Otomatik"]]) {
    state = answer(state, key, value);
  }
  const result = syncFromText(state, "Honda Civic için fren balatası arıyorum");
  const bag = toResolverFieldBag(result.state);
  assert.equal(bag.needType, "part");
  assert.equal(result.state.subcategorySlug, "yedek-parca");
  for (const key of ["mileage", "fuel", "transmission"]) assert.ok(!bag[key], `${key}: ${bag[key]}`);
  assert.equal(bag.city, "İstanbul / Kadıköy");
  assert.equal(bag.budget?.replace(/[^0-9]/g, ""), "30000");
  assert.ok(profileKeys(result.state).every((key) => ["needType", "brand", "model", "part",
    "partVehicleYear", "partPreference", "city", "budget"].includes(key)));
  assert.match(result.state.lastComposedText ?? "", /Honda Civic.*fren balatası/iu);
});
check("part browse context survives vehicle identity enrichment", () => {
  let state = syncFromText(null, "Yedek parça arıyorum").state;
  state = answer(state, "needType", "part");
  state = answer(state, "part", "far");
  state = syncFromText(state, "Toyota Corolla için yedek parça arıyorum. Fotoğraf paylaşılmasını istiyorum.").state;
  assert.equal(toResolverFieldBag(state).needType, "part");
  assert.ok(!profileKeys(state).includes("fuel"));
});
check("PPF color clears when switching to maintenance", () => {
  let state = syncFromText(null, "PPF kaplama yaptırmak istiyorum").state;
  state = answer(state, "color", "Şeffaf");
  state = answer(state, "budget", "unknown");
  const edited = syncFromText(state, "Periyodik bakım yaptırmak istiyorum").state;
  assert.ok(!toResolverFieldBag(edited).color);
  assert.equal(edited.fields.budget.kind, "UNKNOWN");
  assert.equal(edited.fields.budget.provenance, "EXPLICIT_BROWSE");
  assert.ok(!profileKeys(edited).includes("color"));
});
check("PPF color remains during an unrelated detail edit", () => {
  let state = syncFromText(null, "PPF kaplama yaptırmak istiyorum").state;
  state = answer(state, "color", "Şeffaf");
  state = syncFromText(state, "PPF kaplama yaptırmak istiyorum. Garanti belgesi paylaşılmasını istiyorum.").state;
  assert.equal(toResolverFieldBag(state).color, "Şeffaf");
});
check("changing the service answer from PPF to maintenance clears PPF color", () => {
  let state = syncFromText(null, "PPF kaplama yaptırmak istiyorum").state;
  state = answer(state, "color", "Şeffaf");
  state = answer(state, "serviceType", "Periyodik bakım");
  assert.ok(!toResolverFieldBag(state).color);
  assert.ok(!profileKeys(state).includes("color"));
  assert.match(state.lastComposedText ?? "", /Periyodik bakım/iu);
});
for (const [text, model, subject] of [
  ["2019 model Golf için 4 adet 17 inç jant arıyorum", "Golf", "jant"],
  ["BMW 320i 2020 için 4 adet 18 inç jant arıyorum", "320i", "jant"],
  ["Renault Clio 2021 için tavan bagajı arıyorum", "Clio", "bagaj"],
  ["BMW 320i 2020 için çeki demiri arıyorum", "320i", "çeki demiri"],
]) {
  check(`${text}: compatibility remains before and after common answers`, () => {
    let state = syncFromText(null, text).state;
    for (const phase of ["initial", "budget", "city"]) {
      if (phase !== "initial") state = answer(state, phase, phase === "budget" ? "30000" : "İstanbul / Kadıköy");
      assert.ok(state.lastComposedText?.includes(model), `${phase}: ${state.lastComposedText}`);
      assert.ok(state.lastComposedText?.includes(subject), `${phase}: ${state.lastComposedText}`);
    }
  });
}
const outputDir = path.resolve(process.env.STRESS_TRANSITION_OUTPUT ?? "../../reports/qa-stress-fixes-2026-09-06/automotive");
for (const [text, target, rejected] of [
  ["Dükkan değil depo kiralamak istiyorum", /depo/iu, /dükkan/iu],
  ["Janttan vazgeçtim, araba arıyorum", /araç|araba/iu, /vazgeçtim|janttan/iu],
  ["Çeki demiri değil, tavan bagajı arıyorum", /bagaj/iu, /çeki demiri/iu],
  ["Televizyon değil dizüstü bilgisayar arıyorum", /dizüstü/iu, /televizyon/iu],
] as const) {
  check(`${text}: raw summary fallback cannot restore a rejected target`, () => {
    const state = syncFromText(null, text).state;
    assert.match(state.lastComposedText ?? "", target);
    assert.doesNotMatch(state.lastComposedText ?? "", rejected);
    assert.equal(state.understanding.rawInput, text);
  });
}
fs.mkdirSync(outputDir, { recursive: true });
const report = { checks: results.length, passed: results.filter((r) => r.passed).length,
  failed: results.filter((r) => !r.passed).length, results };
fs.writeFileSync(path.join(outputDir, "transition-regressions.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (report.failed) process.exitCode = 1;
