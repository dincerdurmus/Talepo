/**
 * Offline integration audit of the production request composer.
 * No API, database, publishing or product-code mutations. This drives the real
 * parser, question resolver, scheduler, browse answers and text synchronization.
 * Failures are recorded as failures; expectations are not rewritten to match output.
 */
import fs from "node:fs";
import path from "node:path";
import { categoryScenarios, type CategoryScenario } from "./fixtures/category-real-scenarios-v1";
import { syncFromBrowse, syncFromText } from "../src/lib/request-composer/sync";
import { toResolverFieldBag } from "../src/lib/request-composer/build-state";
import { resolveHybridQuestions } from "../src/lib/request-composer/questions";
import { resolveBrowsePath } from "../src/lib/request-composer/resolve-browse-path";
import { scheduleComposerQuestions } from "../src/lib/request-composer/v2/focused-questions";
import { planAnswerApplication } from "../src/lib/request-composer/v2/answer-apply-plan";
import { classifyAnswerAuthority, isDeliberateNonValueAnswer, mayCloseQuestion } from "../src/lib/request-composer/answer-authority";
import { isUnsupportedRequestScope } from "../src/lib/request-understanding/types";
import type { CanonicalRequestState } from "../src/lib/request-composer/types";
import type { BrowseSelectionInput } from "../src/lib/request-composer/apply-browse";
import type { ScheduledQuestion } from "../src/lib/request-composer/v2/question-profile-types";

type Finding = { phase: string; code: string; expected?: unknown; actual?: unknown };
type Step = { field: string; prompt: string; answer: BrowseSelectionInput; summary: string };
type Result = {
  id: string; category: string; input: string; initialCategory: string | null;
  initialPath: string[]; initialSummary: string; questions: Step[];
  finalSummary: string; editedSummary?: string; findings: Finding[];
};

export function schedule(state: CanonicalRequestState, answeredKeys: string[] = [], draft: Record<string, string> = {}) {
  const bag = toResolverFieldBag(state);
  if (isUnsupportedRequestScope(state.understanding.requestScope?.value)) return null;
  return scheduleComposerQuestions({
    categoryId: state.categoryId ?? "",
    needType: bag.needType,
    candidates: resolveHybridQuestions(state).candidates,
    values: { ...bag, ...draft },
    fieldStates: state.fields,
    answeredKeys: [...answeredKeys, ...Object.entries(state.fields).filter(([, field]) =>
      isDeliberateNonValueAnswer(field) || mayCloseQuestion(classifyAnswerAuthority(field)),
    ).map(([key]) => key)],
    realEstateLocationComplete: state.categoryId === "real-estate" ? Boolean(bag.city) : undefined,
    isRemoteService: bag.locationMode === "remote",
  });
}

function answerFor(q: ScheduledQuestion, scenario: CategoryScenario, state: CanonicalRequestState): BrowseSelectionInput | null {
  const categoryId = scenario.categoryId;
  const common: Record<string, string> = {
    budget: categoryId === "real-estate" ? "5000000" : "25000",
    city: "İstanbul / Kadıköy / Caferağa",
    quantity: categoryId === "printing" ? "1000" : "2",
    delivery: "2 hafta",
    dimensions: "120 x 60 x 75 cm",
    area: "120", floor: "2", buildingAge: "5", totalFloors: "2",
    boxDimensions: "20 x 15 x 10 cm", labelDimensions: "5 x 8 cm",
    clinicalDimensions: "190 x 70 cm", largeFormatDimensions: "85 x 200 cm",
    customPrintSpecs: "4 x 2 cm otomatik kaşe", medicalDeviceSpec: "Taşınabilir, şarjlı model",
    labDeviceSpec: "Masaüstü model", supportProductRequirement: "Katlanabilir model",
  };
  const needTypes: Record<string, string> = {
    machinery: "machine", technology: "hardware", services: "service", automotive: "vehicle",
  };
  if (q.fieldKey === "needType" && needTypes[categoryId]) {
    const value = categoryId === "automotive" ? automotiveNeedType(scenario.text, state)
      : /yedek parça/iu.test(scenario.text) ? "part"
      : state.fields.needType?.kind === "VALUE" ? String(state.fields.needType.value)
      : needTypes[categoryId];
    if (q.quickChoices?.some((choice) => choice.value === value)) return { key: q.fieldKey, value };
  }
  // A smoke runner must not silently change the requested product by choosing
  // the first family option (e.g. dinnerware for an explicitly requested sink).
  if (["needType", "productType", "kitchenProductType", "babyProductType", "healthProductType", "machineType", "furnitureType", "applianceType", "serviceType", "propertyType"].includes(q.fieldKey)) {
    const existing = state.fields[q.fieldKey];
    const value = existing?.kind === "VALUE" ? String(existing.value) : null;
    if (value && q.quickChoices?.some((choice) => choice.value === value)) return { key: q.fieldKey, value };
    if (q.allowUnknown) return { key: q.fieldKey, value: "Henüz bilmiyorum", kind: "UNKNOWN" };
    if (q.allowDontCare) return { key: q.fieldKey, value: "Fark etmez", kind: "ANY" };
    return null;
  }
  if (common[q.fieldKey]) return { key: q.fieldKey, value: common[q.fieldKey] };
  if ((q.fieldKey === "brand" || q.fieldKey === "model") && q.allowDontCare) {
    return { key: q.fieldKey, value: "Fark etmez", kind: "ANY" };
  }
  // Otomotiv alt türleri: harness gerçek bir araç/parça cevabı verir ki
  // soru zinciri "örnek cevap yok" diye kırılmasın; değer ürün kararı değildir.
  if (categoryId === "automotive" && automotiveAnswers[q.fieldKey]) {
    return { key: q.fieldKey, value: automotiveAnswers[q.fieldKey] };
  }
  const choice = q.quickChoices?.find((candidate) => !/fark|bilmi|unknown|skip|no_preference/i.test(candidate.value));
  if (choice) return { key: q.fieldKey, value: choice.value };
  if (q.allowUnknown) return { key: q.fieldKey, value: "Henüz bilmiyorum", kind: "UNKNOWN" };
  if (q.allowDontCare) return { key: q.fieldKey, value: "Fark etmez", kind: "ANY" };
  return null;
}

/**
 * Otomotiv senaryolarında alt tür metinden okunur: lastik/jant → tire,
 * parça adı → part, bakım/arıza → service, aksi hâlde araç. Anlama katmanı
 * zaten bir needType koyduysa o kazanır; harness ikinci bir router değildir.
 */
function automotiveNeedType(text: string, state: CanonicalRequestState): string {
  const existing = state.fields.needType;
  if (existing?.kind === "VALUE" && existing.value) return String(existing.value);
  const fold = text.toLocaleLowerCase("tr-TR");
  if (/lastik|jant/u.test(fold)) return "tire";
  if (/yedek parça|tampon|\bfar\b|balata|debriyaj|amortisör|parça/u.test(fold)) return "part";
  if (/bakım|servis|arıza|ekspertiz|tamir|onarım/u.test(fold)) return "service";
  return "vehicle";
}

const automotiveAnswers: Record<string, string> = {
  brand: "Renault", model: "Clio", modelYear: "2019", partVehicleYear: "2015",
  part: "arka tampon", tireSize: "205/55 R16", tireQuantity: "4", mileage: "150000",
  color: "Beyaz", engine: "1.0 TCe", generation: "5. nesil", bodyCondition: "Hasarsız",
};

function known(state: CanonicalRequestState, key: string) {
  return mayCloseQuestion(classifyAnswerAuthority(state.fields[key])) ||
    isDeliberateNonValueAnswer(state.fields[key]);
}

function run(scenario: CategoryScenario): Result {
  let state = syncFromText(null, scenario.text).state;
  const initial = state;
  const result: Result = {
    id: scenario.id, category: scenario.categoryId, input: scenario.text,
    initialCategory: state.categoryId,
    initialPath: resolveBrowsePath(state).map((step) => step.label),
    initialSummary: state.lastComposedText ?? "", finalSummary: "", questions: [], findings: [],
  };
  const add = (phase: string, code: string, expected?: unknown, actual?: unknown) =>
    result.findings.push({ phase, code, expected, actual });
  if (state.categoryId !== scenario.categoryId) {
    add("initial", "wrong-category", scenario.categoryId, state.categoryId);
    result.finalSummary = state.lastComposedText ?? "";
    return result;
  }
  const asked = new Set<string>();
  const draft: Record<string, string> = {};
  let completed = false;
  for (let i = 0; i < 35; i++) {
    const next = schedule(state, [...asked], draft);
    const q = next?.visible[0];
    if (!q) { completed = true; break; }
    if (asked.has(q.fieldKey)) {
      add("answers", "answered-question-repeated", "closed after answer", q.fieldKey);
      break;
    }
    if (scenario.forbiddenQuestions.includes(q.fieldKey)) {
      add("questions", "unrelated-question", scenario.forbiddenQuestions, { key: q.fieldKey, prompt: q.prompt });
    }
    const answer = answerFor(q, scenario, state);
    if (!answer) { add("harness", "needs-real-answer-example", q.fieldKey, q.prompt); break; }
    asked.add(q.fieldKey);
    const plan = planAnswerApplication({ fieldKey: q.fieldKey, rawValue: answer.value, currentText: scenario.text });
    for (const effect of plan.effects) {
      if (effect.kind === "canonical") {
        state = syncFromBrowse(state, { key: effect.fieldKey, value: effect.value,
          isAny: effect.isAny, kind: effect.valueKind }).state;
      } else if (effect.kind === "common" || effect.kind === "dynamic") {
        draft[effect.fieldKey] = effect.value;
      } else if (effect.kind === "cityFilter") {
        draft.city = effect.value;
      } else if (effect.kind === "appendText") {
        state = syncFromText(null, effect.value).state;
      }
    }
    // The actual question handler preserves original raw input and keeps an
    // answered-key ledger. It does NOT reparse the generated summary per answer.
    if (plan.effects.some((effect) => effect.kind === "canonical") && !known(state, q.fieldKey)) {
      add("answers", "answer-lost", answer, state.fields[q.fieldKey]);
    }
    result.questions.push({ field: q.fieldKey, prompt: q.prompt, answer, summary: state.lastComposedText ?? "" });
    if (state.categoryId !== scenario.categoryId) {
      add("answers", "category-changed-after-answer", scenario.categoryId, state.categoryId);
      break;
    }
  }
  if (!completed && result.questions.length === 35) add("answers", "question-loop", "at most 35 steps", 35);
  for (const key of scenario.requiredQuestions) {
    if (!asked.has(key) && !known(initial, key)) {
      add("questions", "missing-relevant-question", key, [...asked]);
    }
  }
  result.finalSummary = state.lastComposedText ?? "";
  // Text edits are exercised separately: engine state transitions and the live
  // React page have different reset behavior and must not be conflated here.
  return result;
}

const results = categoryScenarios.map((scenario) => {
  try { return run(scenario); }
  catch (error) {
    return { id: scenario.id, category: scenario.categoryId, input: scenario.text,
      initialCategory: null, initialPath: [], initialSummary: "", finalSummary: "", questions: [],
      findings: [{ phase: "runtime", code: "exception", actual: String(error) }],
    } satisfies Result;
  }
});
const outputDir = path.resolve(process.env.CATEGORY_AUDIT_OUTPUT ?? "../../reports/category-scenario-audit-2026-09-05");
fs.mkdirSync(outputDir, { recursive: true });
const totals = [...new Set(results.map((r) => r.category))].map((category) => {
  const rows = results.filter((r) => r.category === category);
  return { category, scenarios: rows.length, passed: rows.filter((r) => !r.findings.length).length,
    failed: rows.filter((r) => r.findings.length).length, answers: rows.reduce((sum, r) => sum + r.questions.length, 0) };
});
fs.writeFileSync(path.join(outputDir, "family-flows.json"), JSON.stringify({ generatedAt: new Date().toISOString(), totals, results }, null, 2));
const lines = ["# Kategori senaryo denetimi", "", "Üretimdeki ayrıştırıcı, soru çözümleyici, zamanlayıcı ve ekranın cevap uygulama planı doğrudan çalıştırıldı. Cevaplarda özgün kullanıcı metni korunur; cevap defteri ve taslak etkileri işlenir. Bu dosya bir tarayıcı veya yayınlama/DB testi değildir.", "",
  "| Kategori | Senaryo | Sorunsuz | İncelenecek | Cevap adımı |", "|---|---:|---:|---:|---:|",
  ...totals.map((t) => `| ${t.category} | ${t.scenarios} | ${t.passed} | ${t.failed} | ${t.answers} |`), "",
];
for (const result of results) {
  lines.push(`## ${result.id}: ${result.input}`, "", `Yol: ${result.initialPath.join(" → ") || "Çözülemedi"}`, "",
    `Başlangıç özeti: ${result.initialSummary}`, "", `Son özet: ${result.finalSummary}`, "");
  if (result.editedSummary) lines.push(`Metin düzenlemesi sonrası: ${result.editedSummary}`, "");
  lines.push("| Soru | Cevap |", "|---|---|", ...result.questions.map((s) => `| ${s.prompt.replace(/\|/g, "/")} | ${s.answer.value.replace(/\|/g, "/")} |`), "");
  if (result.findings.length) lines.push(...result.findings.map((f) => `- ${f.phase} / ${f.code}: beklenen ${JSON.stringify(f.expected)}; alınan ${JSON.stringify(f.actual)}`), "");
  else lines.push("Bu senaryonun kontrolleri geçti.", "");
}
fs.writeFileSync(path.join(outputDir, "family-flows.md"), lines.join("\n"));
console.log(JSON.stringify({ scenarios: results.length, totals, outputDir }, null, 2));
if (results.some((r) => r.findings.length)) process.exitCode = 1;
