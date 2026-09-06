/** Regression checks for deliberate answers, cleared fields and text edits. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { syncFromBrowse, syncFromText } from "../src/lib/request-composer/sync";
import type { CanonicalRequestState } from "../src/lib/request-composer/types";
import { planAnswerApplication, projectCanonicalCommonAnswers } from "../src/lib/request-composer/v2/answer-apply-plan";
import { scheduleNextQuestions } from "../src/lib/request-composer/v2/question-scheduler";
import { toResolverFieldBag } from "../src/lib/request-composer/build-state";
import { resolveHybridQuestions } from "../src/lib/request-composer/questions";
import { scheduledToFocusedQuestion } from "../src/lib/request-composer/v2/focused-questions";

const results: { name: string; passed: boolean; error?: string }[] = [];
function check(name: string, run: () => void) {
  try { run(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: String(error) }); }
}
function answer(state: CanonicalRequestState, fieldKey: string, rawValue: string) {
  for (const effect of planAnswerApplication({ fieldKey, rawValue }).effects) {
    if (effect.kind === "canonical") state = syncFromBrowse(state, {
      key: effect.fieldKey, value: effect.value, isAny: effect.isAny, kind: effect.valueKind,
    }).state;
  }
  return state;
}
for (const [field, value, kind, display] of [
  ["budget", "unknown", "UNKNOWN", "Henüz bilmiyorum"],
  ["delivery", "unknown", "UNKNOWN", "Henüz bilmiyorum"],
  ["delivery", "flexible", "ANY", "Fark etmez"],
  ["budget", "open_to_offers", "VALUE", "Teklifleri görmek istiyorum"],
  ["city", "nationwide", "VALUE", "Türkiye geneli"],
  ["city", "no_location_preference", "ANY", "Konum fark etmez"],
] as const) {
  check(`${field}/${value} survives unrelated typing`, () => {
    const initial = answer(syncFromText(null, "Biberon arıyorum").state, field, value);
    const edited = syncFromText(initial, "Biberon arıyorum. Ayrıca fotoğraf paylaşılmasını istiyorum.").state;
    assert.equal(edited.fields[field]?.kind, kind);
    assert.equal(edited.fields[field]?.provenance, "EXPLICIT_BROWSE");
    assert.equal(projectCanonicalCommonAnswers(edited.fields)[field], display);
  });
}
check("unknown product answer survives typing but clears on a new family", () => {
  const initial = answer(syncFromText(null, "Buzdolabı arıyorum").state, "fridgeCapacity", "unknown");
  const edited = syncFromText(initial, "Buzdolabı arıyorum. Fotoğraf paylaşılmasını istiyorum.").state;
  assert.equal(edited.fields.fridgeCapacity.kind, "UNKNOWN");
  assert.equal(edited.fields.fridgeCapacity.provenance, "EXPLICIT_BROWSE");
  const switched = syncFromText(edited, "Çamaşır makinesi arıyorum").state;
  assert.notEqual(switched.fields.fridgeCapacity?.provenance, "EXPLICIT_BROWSE");
});
check("fresh explicit text replaces an earlier unknown answer", () => {
  const initial = answer(syncFromText(null, "Jeneratör arıyorum").state, "generatorPower", "unknown");
  const edited = syncFromText(initial, "250 kVA jeneratör arıyorum").state;
  assert.equal(edited.fields.generatorPower.value, "250 kVA");
  assert.equal(edited.fields.generatorPower.kind, "VALUE");
});
check("remote answer retains both city and delivery mode", () => {
  const initial = answer(syncFromText(null, "Web sitesi yaptırmak istiyorum").state, "city", "remote");
  const edited = syncFromText(initial, "Web sitesi yaptırmak istiyorum. Örnek işler görmek istiyorum.").state;
  assert.equal(edited.fields.locationMode.value, "remote");
  assert.equal(projectCanonicalCommonAnswers(edited.fields).city, "Uzaktan");
});
check("inferred placeholders do not become answered common fields", () => {
  assert.deepEqual(projectCanonicalCommonAnswers({ budget: { kind: "UNKNOWN", value: null, provenance: "INFERRED" } }), {});
});
for (const fieldKey of ["budget", "city", "quantity"]) {
  check(`cleared ${fieldKey} reopens despite old draft and answered ledger`, () => {
    const scheduled = scheduleNextQuestions({
      categoryId: "printing", productType: "Kartvizit", needType: "product",
      hybridCandidates: [], values: { budget: "25000", city: "İstanbul / Kadıköy", quantity: "1000" },
      answeredKeys: ["budget", "city", "quantity"],
      fieldStates: { [fieldKey]: { kind: "UNKNOWN", value: null, provenance: "INFERRED" } },
    });
    assert.ok(scheduled.visible.some((question) => question.fieldKey === fieldKey), JSON.stringify(scheduled));
  });
}
check("printing summary does not turn a request verb into a product name", () => {
  const state = syncFromText(null, "Ürünlerim için karton kutu bastırmak istiyorum").state;
  assert.match(state.lastComposedText ?? "", /karton kutu/iu);
  assert.doesNotMatch(state.lastComposedText ?? "", /bastırmak arıyorum/iu);
});
for (const raw of [
  "SUV tavan bagajı arıyorum", "Araba için portbagaj arıyorum",
  "Kamyon için çeki demiri arıyorum", "Periyodik bakım yaptırmak istiyorum",
  "PPF kaplama yaptırmak istiyorum", "Araba için şanzıman arıyorum",
]) {
  check(`${raw}: every offered brand/model soft answer closes its question`, () => {
    let state = syncFromText(null, raw).state;
    state = answer(state, "budget", "25000");
    state = answer(state, "city", "İstanbul / Kadıköy");
    for (const fieldKey of ["brand", "model"]) {
      const bag = toResolverFieldBag(state);
      const schedule = (current: CanonicalRequestState) => scheduleNextQuestions({
        categoryId: current.categoryId!, needType: bag.needType, values: toResolverFieldBag(current),
        hybridCandidates: resolveHybridQuestions(current).candidates, fieldStates: current.fields,
      });
      const question = schedule(state).visible.find((q) => q.fieldKey === fieldKey);
      assert.ok(question, `${fieldKey} must be asked before answering`);
      const control = scheduledToFocusedQuestion(question, undefined, {
        productType: bag.productType, needType: bag.needType, brand: bag.brand,
      }).control!;
      const escapes = control.softOptions.filter((option) => option.soft && !option.opensCustom);
      assert.ok(escapes.length > 0, `${fieldKey} must offer its permitted soft answer`);
      for (const option of escapes) {
        const answered = answer(state, fieldKey, option.value);
        assert.ok(!schedule(answered).visible.some((q) => q.fieldKey === fieldKey), `${fieldKey}/${option.value} reopens`);
      }
      state = answer(state, fieldKey, escapes[0].value);
    }
    const edited = syncFromText(state, `${raw}. Ayrıca fotoğraf paylaşılmasını istiyorum.`).state;
    for (const key of ["brand", "model"]) {
      assert.equal(edited.fields[key].kind, state.fields[key].kind);
      assert.equal(edited.fields[key].provenance, "EXPLICIT_BROWSE");
    }
  });
}
const outputDir = path.resolve(process.env.CATEGORY_AUDIT_OUTPUT ?? "../../reports/category-fixes-2026-09-05");
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, "answer-retention.json"), JSON.stringify({ results }, null, 2));
console.log(JSON.stringify({ checks: results.length, passed: results.filter((row) => row.passed).length,
  failures: results.filter((row) => !row.passed) }, null, 2));
if (results.some((row) => !row.passed)) process.exitCode = 1;
