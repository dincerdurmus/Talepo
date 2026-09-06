/** Engine boundary tests with prior state retained. Browser interaction and
 * debounce behavior are independently tested in verify-category-browser-scenarios-v1.mjs.
 */
import fs from "node:fs";
import path from "node:path";
import { syncFromText, syncFromBrowse } from "../src/lib/request-composer/sync";
import { toResolverFieldBag } from "../src/lib/request-composer/build-state";
import { resolveBrowsePath } from "../src/lib/request-composer/resolve-browse-path";
import { listProfilesForCategory } from "../src/lib/request-composer/v2/question-profiles";
import { resolveHybridQuestions } from "../src/lib/request-composer/questions";
import { scheduleComposerQuestions } from "../src/lib/request-composer/v2/focused-questions";
import { classifyAnswerAuthority, isDeliberateNonValueAnswer, mayCloseQuestion } from "../src/lib/request-composer/answer-authority";
import type { CanonicalRequestState } from "../src/lib/request-composer/types";

type Story = {
  id: string; category: string; input: string; answers: [string, string][];
  edit: string; nextCategory?: string; expected?: Record<string, string>;
  clear?: string[]; nextQuestions?: string[]; forbidden?: string[];
  summaryHas?: string[]; summaryLacks?: string[];
};
type Finding = { code: string; expected?: unknown; actual?: unknown };
const stories: Story[] = [
  { id: "estate-room-edit", category: "real-estate", input: "2+1 kiralık daire arıyorum", answers: [["roomCount", "3+1"]], edit: "4+1 kiralık daire arıyorum", expected: { roomCount: "4+1" }, summaryHas: ["4+1"], summaryLacks: ["3+1", "2+1"] },
  { id: "estate-apartment-to-land", category: "real-estate", input: "Kiralık daire arıyorum", answers: [["roomCount", "3+1"], ["floor", "2"], ["area", "120"]], edit: "500 m2 satılık arsa arıyorum", expected: { area: "500" }, clear: ["roomCount", "floor"], nextQuestions: ["deedStatus"], forbidden: ["roomCount", "floor"], summaryHas: ["arsa"], summaryLacks: ["3+1", "daire"] },
  { id: "technology-screen-edit", category: "technology", input: "Televizyon arıyorum", answers: [["screenSize", "55"], ["resolution", "4K"]], edit: "65 inç 4K televizyon arıyorum", expected: { screenSize: "65", resolution: "4K" }, summaryHas: ["65"], summaryLacks: ["55"] },
  { id: "technology-tv-to-laptop", category: "technology", input: "Televizyon arıyorum", answers: [["screenSize", "55"], ["panelType", "OLED"]], edit: "15 inç dizüstü bilgisayar arıyorum", expected: { screenSize: "15" }, clear: ["panelType"], nextQuestions: ["ram", "processor"], forbidden: ["panelType"], summaryLacks: ["televizyon", "55"] },
  { id: "appliance-capacity-edit", category: "appliances", input: "Çamaşır makinesi arıyorum", answers: [["capacityKg", "9"], ["spinSpeed", "1400"]], edit: "10 kg çamaşır makinesi arıyorum", expected: { capacityKg: "10", spinSpeed: "1400" }, summaryHas: ["çamaşır"] },
  { id: "appliance-fridge-to-washer", category: "appliances", input: "Buzdolabı arıyorum", answers: [["fridgeCapacity", "400"], ["fridgeCoolingSystem", "No Frost"]], edit: "Çamaşır makinesi arıyorum", clear: ["fridgeCapacity", "fridgeCoolingSystem"], nextQuestions: ["capacityKg", "washerDryFeature"], forbidden: ["fridgeCapacity", "fridgeCoolingSystem"], summaryLacks: ["buzdolabı", "400"] },
  { id: "furniture-quantity-edit", category: "furniture", input: "Ofis sandalyesi arıyorum", answers: [["quantity", "4"], ["officeChairMechanism", "Senkron"]], edit: "6 adet ofis sandalyesi arıyorum", expected: { quantity: "6", officeChairMechanism: "Senkron" }, summaryHas: ["6", "sandalye"] },
  { id: "furniture-table-to-chair", category: "furniture", input: "Toplantı masası arıyorum", answers: [["meetingCapacity", "8"], ["meetingTableShape", "Yuvarlak"]], edit: "Ofis sandalyesi arıyorum", clear: ["meetingCapacity", "meetingTableShape"], nextQuestions: ["officeChairMechanism", "officeChairErgonomics"], forbidden: ["meetingCapacity"], summaryHas: ["sandalye"], summaryLacks: ["toplantı"] },
  { id: "printing-quantity-edit", category: "printing", input: "Rulo etiket bastırmak istiyorum", answers: [["quantity", "1000"], ["labelDimensions", "5 x 8 cm"]], edit: "2000 adet rulo etiket bastırmak istiyorum", expected: { quantity: "2000", labelDimensions: "5 x 8 cm" }, summaryHas: ["2000", "etiket"] },
  { id: "printing-catalog-to-card", category: "printing", input: "Katalog bastırmak istiyorum", answers: [["publicationPageCount", "32"], ["publicationBinding", "Tel dikiş"]], edit: "Kartvizit bastırmak istiyorum", clear: ["publicationPageCount", "publicationBinding"], nextQuestions: ["cardFormat", "cardStock"], forbidden: ["publicationPageCount"], summaryHas: ["kartvizit"], summaryLacks: ["katalog", "32"] },
  { id: "machine-power-edit", category: "machinery", input: "Jeneratör arıyorum", answers: [["generatorPower", "100 kVA"], ["generatorFuel", "Dizel"]], edit: "250 kVA jeneratör arıyorum", expected: { generatorPower: "250 kVA", generatorFuel: "Dizel" }, summaryHas: ["jeneratör"], summaryLacks: ["100 kVA"] },
  { id: "machine-generator-to-tractor", category: "machinery", input: "Jeneratör arıyorum", answers: [["generatorPower", "100 kVA"], ["generatorFuel", "Dizel"]], edit: "Traktör arıyorum", clear: ["generatorPower", "generatorFuel"], nextQuestions: ["tractorPowerClass", "tractorDriveType"], forbidden: ["generatorPower", "generatorFuel"], summaryHas: ["traktör"], summaryLacks: ["jeneratör", "kVA"] },
  { id: "baby-quantity-edit", category: "baby", input: "Biberon arıyorum", answers: [["quantity", "2"], ["feedingBottleMaterial", "Cam"]], edit: "4 adet biberon arıyorum", expected: { quantity: "4", feedingBottleMaterial: "Cam" }, summaryHas: ["4", "biberon"] },
  { id: "baby-stroller-to-seat", category: "baby", input: "Bebek arabası arıyorum", answers: [["strollerType", "Baston"], ["strollerFoldPreference", "Tek elle"]], edit: "Bebek oto koltuğu arıyorum", clear: ["strollerType", "strollerFoldPreference"], nextQuestions: ["carSeatGroup", "carSeatMount"], forbidden: ["strollerType"], summaryHas: ["koltuğu"], summaryLacks: ["bebek arabası"] },
  { id: "kitchen-quantity-edit", category: "home-kitchen", input: "Tencere takımı arıyorum", answers: [["quantity", "2"], ["cooktopCompatibility", "İndüksiyon"]], edit: "4 adet tencere takımı arıyorum", expected: { quantity: "4", cooktopCompatibility: "İndüksiyon" }, summaryHas: ["4", "tencere"] },
  { id: "kitchen-cookware-to-cutlery", category: "home-kitchen", input: "Tencere takımı arıyorum", answers: [["cookwareSize", "28 cm"], ["cooktopCompatibility", "İndüksiyon"]], edit: "Çatal bıçak takımı arıyorum", clear: ["cookwareSize", "cooktopCompatibility"], nextQuestions: ["cutleryServiceCount", "cutleryFinish"], forbidden: ["cooktopCompatibility"], summaryHas: ["çatal"], summaryLacks: ["tencere", "28 cm"] },
  { id: "health-condition-edit", category: "health", input: "Hasta monitörü arıyorum", answers: [["medicalDeviceCondition", "Sıfır"], ["medicalDeviceSetting", "Hastane"]], edit: "İkinci el hasta monitörü arıyorum", expected: { medicalDeviceCondition: "İkinci el", medicalDeviceSetting: "Hastane" }, summaryHas: ["monitör"], summaryLacks: ["sıfır"] },
  { id: "health-exam-table-to-dental", category: "health", input: "Muayene masası arıyorum", answers: [["clinicalEquipmentMode", "Manuel"], ["clinicalDimensions", "190 x 70 cm"]], edit: "Diş üniti arıyorum", clear: ["clinicalEquipmentMode", "clinicalDimensions"], nextQuestions: ["labUseCase", "labDeviceSpec"], forbidden: ["clinicalDimensions"], summaryHas: ["diş"], summaryLacks: ["muayene", "190"] },
  { id: "service-budget-edit", category: "services", input: "Ev temizliği yaptırmak istiyorum", answers: [["budget", "2500"], ["homeCleaningFrequency", "Tek seferlik"]], edit: "Ev temizliği için bütçem 4000 TL", expected: { budget: "4000", homeCleaningFrequency: "Tek seferlik" }, summaryHas: ["temizli"] },
  { id: "service-boiler-to-cleaning", category: "services", input: "Kombi servisi arıyorum", answers: [["boilerBrand", "Bosch"], ["boilerServiceNeed", "Bakım"]], edit: "Ev temizliği yaptırmak istiyorum", clear: ["boilerBrand", "boilerServiceNeed"], nextQuestions: ["homeCleaningSize", "homeCleaningFrequency"], forbidden: ["boilerBrand"], summaryHas: ["temizli"], summaryLacks: ["kombi", "Bosch"] },
];

const crossCategoryTargets = [
  ["technology", "Televizyon arıyorum"],
  ["appliances", "Çamaşır makinesi arıyorum"],
  ["furniture", "Ofis sandalyesi arıyorum"],
  ["printing", "Rulo etiket bastırmak istiyorum"],
  ["machinery", "Jeneratör arıyorum"],
  ["baby", "Biberon arıyorum"],
  ["home-kitchen", "Yemek takımı arıyorum"],
  ["health", "Hasta monitörü arıyorum"],
  ["services", "Ev temizliği yaptırmak istiyorum"],
  ["real-estate", "Satılık arsa arıyorum"],
];
for (const [index, [nextCategory, edit]] of crossCategoryTargets.entries()) {
  const base = stories[index * 2];
  const answers: [string, string][] = [...base.answers, ["city", "İstanbul"], ["budget", "25000"]];
  stories.push({ id: `cross-${base.category}-to-${nextCategory}`, category: base.category,
    input: base.input, answers, edit, nextCategory, expected: { city: "İstanbul", budget: "25000" },
    clear: base.answers.map(([key]) => key).filter((key) => !["quantity", "budget"].includes(key)),
  });
}

const isolationCases: [string, string][] = [
  ["Bebek odası için klima arıyorum", "appliances"],
  ["Ofis için kahve makinesi arıyorum", "appliances"],
  ["Hastane için ofis sandalyesi arıyorum", "furniture"],
  ["Matbaa için jeneratör arıyorum", "machinery"],
  ["Kafe için yemek takımı arıyorum", "home-kitchen"],
  ["Otel için çamaşır makinesi arıyorum", "appliances"],
  ["İnşaat ofisi için bilgisayar arıyorum", "technology"],
  ["Kliniğe muayene masası arıyorum", "health"],
  ["Restoran için kartvizit bastırmak istiyorum", "printing"],
  ["Bebek odası temizliği yaptırmak istiyorum", "services"],
  ["camasir makinasi ariyorum", "appliances"],
  ["dizustu bilgisayar lazim", "technology"],
  ["cnc freze lazim", "machinery"],
  ["porselen yemek takimi ariyorum", "home-kitchen"],
  ["cocuguma biberon ariyorum", "baby"],
  ["ic mimar ariyorum", "services"],
  ["satilik daire ariyorum", "real-estate"],
  ["kartvizit bastirmak istiyorum", "printing"],
  ["ofis sandalyesi lazim", "furniture"],
  ["stetoskop ariyorum", "health"],
];

const detailedCases: { text: string; category: string; fields: Record<string, string> }[] = [
  { text: "Ankara'da 3+1 kiralık daire arıyorum", category: "real-estate", fields: { roomCount: "3+1" } },
  { text: "55 inç 4K televizyon arıyorum", category: "technology", fields: { screenSize: "55", resolution: "4K" } },
  { text: "9 kg çamaşır makinesi arıyorum", category: "appliances", fields: { capacityKg: "9" } },
  { text: "4 adet ofis sandalyesi arıyorum", category: "furniture", fields: { quantity: "4" } },
  { text: "2000 adet kartvizit bastırmak istiyorum", category: "printing", fields: { quantity: "2000" } },
  { text: "250 kVA dizel jeneratör arıyorum", category: "machinery", fields: { generatorPower: "250 kVA", generatorFuel: "Dizel" } },
  { text: "4 adet cam biberon arıyorum", category: "baby", fields: { quantity: "4", feedingBottleMaterial: "Cam" } },
  { text: "12 kişilik porselen yemek takımı arıyorum", category: "home-kitchen", fields: { serviceCount: "12", material: "Porselen" } },
  { text: "İkinci el hasta monitörü arıyorum", category: "health", fields: { medicalDeviceCondition: "İkinci el" } },
  { text: "Ev temizliği için bütçem 4000 TL", category: "services", fields: { budget: "4000" } },
];

function fold(value: unknown) {
  return String(value ?? "").toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i").trim();
}
function sameValue(key: string, actual: unknown, expected: unknown) {
  if (fold(actual) === fold(expected)) return true;
  // Display formatting is not a defect: 9 kg == 9, 12 kişilik == 12,
  // and 4.000 TL == 4000. Different numeric values still fail.
  if (!["area", "screenSize", "capacityKg", "quantity", "serviceCount", "budget"].includes(key)) return false;
  const number = (value: unknown) => {
    const raw = fold(value).replace(/\.(?=\d{3}(?:\D|$))/g, "");
    const match = raw.match(/^(\d+(?:[.,]\d+)?)(?:\s*(?:kg|m2|m²|inc|kisilik|adet|tl))?$/u);
    return match ? Number(match[1].replace(",", ".")) : null;
  };
  const left = number(actual);
  return left != null && left === number(expected);
}
function profiles(state: CanonicalRequestState) {
  const bag = toResolverFieldBag(state);
  return listProfilesForCategory({ categoryId: state.categoryId ?? "", needType: bag.needType, productType: bag.productType ?? bag.machineType ?? bag.kitchenProductType ?? bag.serviceType ?? bag.propertyType }).map((p) => p.fieldKey);
}
function unanswered(state: CanonicalRequestState) {
  const bag = toResolverFieldBag(state);
  return scheduleComposerQuestions({ categoryId: state.categoryId ?? "", needType: bag.needType, values: bag,
    candidates: resolveHybridQuestions(state).candidates, fieldStates: state.fields,
    answeredKeys: Object.entries(state.fields).filter(([, f]) => isDeliberateNonValueAnswer(f) || mayCloseQuestion(classifyAnswerAuthority(f))).map(([key]) => key),
    realEstateLocationComplete: state.categoryId === "real-estate" ? Boolean(bag.city) : undefined,
  }).visible.map((q) => q.fieldKey);
}
const results: { id: string; category: string; kind: string; input: string; beforeSummary?: string; edit?: string; summary: string; path: string[]; findings: Finding[]; answers?: [string, string][]; actualFields?: Record<string, unknown> }[] = [];
for (const story of stories) {
  let state = syncFromText(null, story.input).state;
  const findings: Finding[] = [];
  if (state.categoryId !== story.category) findings.push({ code: "wrong-initial-category", expected: story.category, actual: state.categoryId });
  for (const [key, value] of story.answers) state = syncFromBrowse(state, { key, value }).state;
  const beforeSummary = state.lastComposedText ?? "";
  const edited = syncFromText(state, story.edit).state;
  const nextCategory = story.nextCategory ?? story.category;
  if (edited.categoryId !== nextCategory) findings.push({ code: "wrong-edited-category", expected: nextCategory, actual: edited.categoryId });
  for (const [key, value] of Object.entries(story.expected ?? {})) {
    if (!sameValue(key, edited.fields[key]?.value, value)) findings.push({ code: "explicit-edit-not-applied", expected: { key, value }, actual: edited.fields[key] });
  }
  for (const key of story.clear ?? []) {
    if (edited.fields[key]?.kind === "VALUE") findings.push({ code: "stale-family-field-retained", expected: `${key} cleared`, actual: edited.fields[key] });
  }
  const keys = profiles(edited);
  for (const key of story.nextQuestions ?? []) if (!keys.includes(key)) findings.push({ code: "new-family-question-missing", expected: key, actual: keys });
  for (const key of story.forbidden ?? []) if (keys.includes(key)) findings.push({ code: "old-family-question-leaked", expected: `${key} absent`, actual: keys });
  const summary = edited.lastComposedText ?? "";
  for (const token of story.summaryHas ?? []) if (!fold(summary).includes(fold(token))) findings.push({ code: "summary-missing-detail", expected: token, actual: summary });
  for (const token of story.summaryLacks ?? []) if (fold(summary).includes(fold(token))) findings.push({ code: "summary-retains-old-detail", expected: `${token} absent`, actual: summary });
  results.push({ id: story.id, category: story.category, kind: "text-edit-or-family-switch", input: story.input, answers: story.answers, beforeSummary, edit: story.edit, summary, path: resolveBrowsePath(edited).map((p) => p.label), findings });
}
for (const [index, [text, category]] of isolationCases.entries()) {
  const state = syncFromText(null, text).state;
  results.push({ id: `context-${index + 1}`, category, kind: "context-or-spelling", input: text, summary: state.lastComposedText ?? "", path: resolveBrowsePath(state).map((p) => p.label), findings: state.categoryId === category ? [] : [{ code: "context-or-spelling-misroute", expected: category, actual: state.categoryId }] });
}
for (const [index, scenario] of detailedCases.entries()) {
  const state = syncFromText(null, scenario.text).state;
  const findings: Finding[] = [];
  if (state.categoryId !== scenario.category) findings.push({ code: "wrong-detailed-category", expected: scenario.category, actual: state.categoryId });
  for (const [key, expected] of Object.entries(scenario.fields)) {
    if (!sameValue(key, state.fields[key]?.value, expected)) findings.push({ code: "written-detail-not-read", expected: { key, value: expected }, actual: state.fields[key] });
    if (unanswered(state).includes(key)) findings.push({ code: "written-detail-asked-again", expected: `${key} answered in text`, actual: unanswered(state) });
  }
  results.push({ id: `details-${index + 1}`, category: scenario.category, kind: "details-in-initial-text", input: scenario.text, summary: state.lastComposedText ?? "", path: resolveBrowsePath(state).map((p) => p.label), findings, actualFields: Object.fromEntries(Object.keys(scenario.fields).map((key) => [key, state.fields[key]])) });
}

const outputDir = path.resolve(process.env.CATEGORY_AUDIT_OUTPUT ?? "../../reports/category-scenario-audit-2026-09-05");
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, "edits-and-context.json"), JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
const lines = ["# Metin, ürün değişimi ve bağlam senaryoları", "", "Üretimdeki saf talep motoru önceki durum korunarak çalıştırıldı. Tarayıcı etkileşimi ayrıca browser-scenarios.json dosyasında doğrulanır. DB işlemi yapılmadı.", ""];
for (const row of results) lines.push(`## ${row.id}`, "", `Talep: ${row.input}`, "", ...(row.answers ? [`Cevaplar: ${row.answers.map(([k, v]) => `${k}=${v}`).join("; ")}`, ""] : []), ...(row.edit ? [`Yeni metin: ${row.edit}`, ""] : []), `Yol: ${row.path.join(" → ") || "Çözülemedi"}`, "", `Özet: ${row.summary}`, "", ...(row.findings.length ? row.findings.map((f) => `- ${f.code}: beklenen ${JSON.stringify(f.expected)}; alınan ${JSON.stringify(f.actual)}`) : ["Kontroller geçti."]), "");
fs.writeFileSync(path.join(outputDir, "edits-and-context.md"), lines.join("\n"));
console.log(JSON.stringify({ scenarios: results.length, passed: results.filter((r) => !r.findings.length).length, failed: results.filter((r) => r.findings.length).length, outputDir }, null, 2));
if (results.some((r) => r.findings.length)) process.exitCode = 1;
