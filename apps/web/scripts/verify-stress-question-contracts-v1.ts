/** Approved QA regressions: HHD-05/HHD-06 and t19. Offline production flow;
 * existing contracts and controls only, no API/database/publish operations. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { syncFromText, syncFromBrowse } from "../src/lib/request-composer/sync";
import { toResolverFieldBag } from "../src/lib/request-composer/build-state";
import { resolveHybridQuestions } from "../src/lib/request-composer/questions";
import { resolveCategoryQuestionContract } from "../src/lib/request-category-engine";
import { listProfilesForCategory } from "../src/lib/request-composer/v2/question-profiles";
import { scheduleComposerQuestions, scheduledToFocusedQuestion } from "../src/lib/request-composer/v2/focused-questions";
import { planAnswerApplication } from "../src/lib/request-composer/v2/answer-apply-plan";
import { classifyAnswerAuthority, isDeliberateNonValueAnswer, mayCloseQuestion } from "../src/lib/request-composer/answer-authority";
import type { CanonicalRequestState } from "../src/lib/request-composer/types";
import type { ScheduledQuestion } from "../src/lib/request-composer/v2/question-profile-types";

type Scenario = {
  name: string;
  text: string;
  forbidden: string[];
  required?: string[];
};
const washer = ["capacityKg", "washerDryFeature", "washerLoadType", "spinSpeed", "energyClass"];
const climate = ["airConditionerType", "capacityBtu", "climateRoomSize", "inverterPreference", "heatingFunction", "energyClass"];
const seat = ["carSeatGroup", "carSeatMount", "carSeatDirection"];
const screen = ["screenSize", "resolution", "panelType", "refreshRate"];
const machinery = ["capacity", "power", "powerKw", "voltage", "modelYear", "operatingHours", "condition"];
const scenarios: Scenario[] = [
  { name: "washer drain pump", text: "Çamaşır makinesi tahliye pompası arıyorum", forbidden: washer },
  { name: "air conditioner inner filter", text: "Klima iç ünite filtresi arıyorum", forbidden: climate },
  { name: "car seat cover", text: "Oto koltuğu kılıfı arıyorum, koltuğun kendisi değil", forbidden: seat },
  { name: "washer repair", text: "Çamaşır makinesi tamiri yaptırmak istiyorum", forbidden: [...washer, "condition"] },
  { name: "machine repair", text: "CNC makine tamiri yaptırmak istiyorum", forbidden: machinery },
  { name: "phone screen", text: "iPhone 15 için ekran arıyorum", forbidden: screen },
  { name: "explicit phone replacement screen", text: "iPhone 15 için yedek ekran parçası arıyorum", forbidden: screen },
  { name: "diaper pail", text: "Bebek bezi çöp kovası arıyorum", forbidden: ["diaperSize"], required: ["diaperDisposalProduct", "diaperDisposalCapacity", "diaperDisposalCompatibility", "model"] },
  // Positive controls prove parent purchasing and specific accessory contracts
  // keep their existing questions; a global keyword blacklist cannot pass.
  { name: "whole washer", text: "Çamaşır makinesi arıyorum", forbidden: [], required: washer },
  { name: "whole air conditioner", text: "Klima arıyorum", forbidden: [], required: climate },
  { name: "whole car seat", text: "Bebek oto koltuğu arıyorum", forbidden: [], required: seat },
  { name: "whole monitor", text: "Monitör arıyorum", forbidden: [], required: screen },
  { name: "actual diaper", text: "Bebek bezi arıyorum", forbidden: ["diaperDisposalCapacity"], required: ["diaperSize"] },
  { name: "named car seat accessories", text: "Oto koltuğu aksesuarı arıyorum", forbidden: seat, required: ["carSeatAccessoryType", "carSeatAccessoryCompatibility", "carSeatAccessoryPurpose"] },
  { name: "named stroller accessories", text: "Bebek arabası aksesuarı arıyorum", forbidden: ["strollerType", "strollerUseCase", "strollerFoldPreference"], required: ["strollerAccessoryType", "strollerAccessoryCompatibility", "strollerAccessoryWeatherUse"] },
  { name: "machine spare contract unchanged", text: "CNC tezgahı için yedek parça arıyorum", forbidden: ["capacity", "power", "voltage", "machiningPrecision"], required: ["partPreference"] },
];

function context(state: CanonicalRequestState) {
  const values = toResolverFieldBag(state);
  return { categoryId: state.categoryId ?? "", needType: values.needType,
    productType: values.productType ?? values.solutionType ?? values.applianceType ?? values.furnitureType ?? values.babyProductType ?? values.kitchenProductType ?? values.machineType ?? values.propertyType ?? values.serviceType,
    values };
}
function known(state: CanonicalRequestState, key: string) {
  return isDeliberateNonValueAnswer(state.fields[key]) || mayCloseQuestion(classifyAnswerAuthority(state.fields[key]));
}
function apply(state: CanonicalRequestState, fieldKey: string, rawValue: string, draft: Record<string, string>) {
  const plan = planAnswerApplication({ fieldKey, rawValue, currentText: state.understanding.rawInput });
  for (const effect of plan.effects) {
    if (effect.kind === "canonical") state = syncFromBrowse(state, { key: effect.fieldKey, value: effect.value, kind: effect.valueKind, isAny: effect.isAny }).state;
    else if (effect.kind === "common" || effect.kind === "dynamic") draft[effect.fieldKey] = effect.value;
    else if (effect.kind === "cityFilter") draft.city = effect.value;
    else if (effect.kind === "appendText") state = syncFromText(state, effect.value).state;
  }
  return { state, plan };
}
function answerFor(q: ScheduledQuestion, state: CanonicalRequestState): string {
  const ctx = context(state);
  const control = scheduledToFocusedQuestion(q, undefined, { productType: ctx.productType, needType: ctx.needType, brand: ctx.values.brand }).control;
  assert.ok(control, `missing production control for ${q.fieldKey}`);
  if (q.fieldKey === "needType" && ctx.needType && control.options.some((o) => o.value === ctx.needType)) return ctx.needType;
  const common: Record<string, string> = { budget: "25000", city: "İstanbul", quantity: "2", delivery: "2 hafta" };
  if (common[q.fieldKey]) return common[q.fieldKey];
  const soft = control.softOptions.find((o) => !o.opensCustom && !/skip/.test(o.value));
  if (soft) return soft.value;
  const option = control.options.find((o) => !o.opensCustom);
  if (option) return option.value;
  return q.inputHint === "number" ? "2" : "Ölçü henüz belirlenmedi";
}

const results: { name: string; passed: boolean; error?: string; details?: unknown }[] = [];
function check(name: string, run: () => unknown) {
  try { results.push({ name, passed: true, details: run() }); }
  catch (error) { results.push({ name, passed: false, error: String(error) }); }
}
for (const scenario of scenarios) check(scenario.name, () => {
  let state = syncFromText(null, scenario.text).state;
  const initial = state;
  const draft: Record<string, string> = {};
  const answered: string[] = [];
  const steps: { key: string; value: string; summary: string | null | undefined }[] = [];
  let complete = false;
  for (let step = 0; step < 40; step++) {
    const ctx = context(state);
    const profiles = listProfilesForCategory(ctx).map((p) => p.fieldKey);
    for (const key of scenario.forbidden) assert.ok(!profiles.includes(key), `${key} leaked through profile list`);
    const schedule = scheduleComposerQuestions({ categoryId: ctx.categoryId, needType: ctx.needType, values: { ...ctx.values, ...draft },
      fieldStates: state.fields, candidates: resolveHybridQuestions(state).candidates,
      answeredKeys: [...answered, ...Object.keys(state.fields).filter((key) => known(state, key))] });
    for (const q of schedule.visible) assert.ok(!scenario.forbidden.includes(q.fieldKey), `${q.fieldKey}: ${q.prompt}`);
    const question = schedule.visible[0];
    if (!question) { complete = true; break; }
    assert.ok(!answered.includes(question.fieldKey), `answer repeated: ${question.fieldKey}`);
    const value = answerFor(question, state);
    const outcome = apply(state, question.fieldKey, value, draft);
    state = outcome.state;
    if (outcome.plan.effects.some((e) => e.kind === "canonical" && e.fieldKey === question.fieldKey)) {
      assert.ok(known(state, question.fieldKey), `offered answer rejected: ${question.fieldKey}=${value}`);
    }
    answered.push(question.fieldKey);
    steps.push({ key: question.fieldKey, value, summary: state.lastComposedText });
  }
  assert.ok(complete, "flow did not terminate");
  for (const key of scenario.required ?? []) assert.ok(answered.includes(key) || known(initial, key), `existing question missing: ${key}`);
  assert.equal(state.categoryId, initial.categoryId, "answers changed request category");
  return { text: scenario.text, category: initial.categoryId, initialSummary: initial.lastComposedText, finalSummary: state.lastComposedText, steps };
});

for (const [categoryId, productType, role, forbidden] of [
  ["appliances", "Çamaşır Makinesi", "part", washer],
  ["appliances", "Klima", "part", climate],
  ["appliances", "Çamaşır Makinesi", "service", washer],
  ["baby", "Oto koltuğu", "part", seat],
  ["technology", "ekran", "part", screen],
] as const) check(`contract role ${categoryId}/${productType}/${role}`, () => {
  const ctx = { categoryId, productType, needType: role };
  const contract = resolveCategoryQuestionContract(ctx);
  assert.ok(contract, "relational request must have a bounded contract");
  const profiles = listProfilesForCategory(ctx).map((p) => p.fieldKey);
  for (const key of forbidden) {
    assert.ok(!contract.allowedCandidateFieldKeys.includes(key), `parent candidate allowed: ${key}`);
    assert.ok(!profiles.includes(key), `parent profile allowed: ${key}`);
  }
  assert.deepEqual(contract.questions, [], "role fallback must not invent questions");
  return { ctx, profiles, allowed: contract.allowedCandidateFieldKeys };
});

check("automotive service limit remains exact", () => {
  const contract = resolveCategoryQuestionContract({ categoryId: "automotive", needType: "service", productType: "Bakım" });
  assert.ok(contract?.omitDeliveryQuestion);
  assert.deepEqual(contract.allowedCandidateFieldKeys, ["needType", "serviceType", "brand", "model", "mileage", "city", "budget"]);
});
check("automotive spare limit remains exact", () => {
  const contract = resolveCategoryQuestionContract({ categoryId: "automotive", needType: "part", productType: "yedek parça" });
  assert.ok(contract);
  for (const key of ["vin", "oemNumber", "fuel", "transmission", "capacity", "power"]) assert.ok(!contract.allowedCandidateFieldKeys.includes(key), key);
});

check("component role stays stable when preserving answers after an explanation", () => {
  const text = "Oto koltuğu kılıfı arıyorum, koltuğun kendisi değil";
  let state = syncFromText(null, text).state;
  const draft: Record<string, string> = {};
  state = apply(state, "condition", "no_preference", draft).state;
  state = apply(state, "brand", "unknown", draft).state;
  const next = syncFromText(state, `${text}. Ürün fotoğraflarını da görmek istiyorum.`).state;
  assert.equal(next.fields.condition?.kind, "ANY", "same component request lost condition answer");
  assert.equal(next.fields.brand?.provenance, "EXPLICIT_BROWSE", "same component request lost brand answer");
  assert.equal(context(next).needType, "part");
  for (const key of seat) assert.ok(!listProfilesForCategory(context(next)).some((p) => p.fieldKey === key));
});

const outputDir = path.resolve(process.env.QUESTION_CONTRACT_AUDIT_OUTPUT ?? "../../reports/qa-stress-fixes-2026-09-06/questions");
fs.mkdirSync(outputDir, { recursive: true });
const totals = { checks: results.length, passed: results.filter((r) => r.passed).length, failed: results.filter((r) => !r.passed).length };
fs.writeFileSync(path.join(outputDir, "question-contracts.json"), JSON.stringify({ generatedAt: new Date().toISOString(), totals, results }, null, 2));
console.log(JSON.stringify(totals));
for (const result of results.filter((r) => !r.passed)) console.error(`${result.name}: ${result.error}`);
if (totals.failed) process.exitCode = 1;
