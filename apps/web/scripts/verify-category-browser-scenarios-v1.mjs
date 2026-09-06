/** Live local-page audit. No publishing, login, database writes or market lookup. */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const outputDir = path.resolve(process.env.CATEGORY_AUDIT_OUTPUT || "../../reports/category-scenario-audit-2026-09-05");
fs.mkdirSync(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || "msedge" });
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
await context.route("**/api/**", async (route) => {
  const request = route.request();
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
    // Question authority is local. Market preview is deliberately unavailable;
    // no synthetic category/question data is returned to the page.
    return route.fulfill({ status: 503, contentType: "application/json",
      body: JSON.stringify({ ok: false, message: "Local category audit: external preview and writes disabled" }) });
  }
  return route.continue();
});

const baseUrl = process.env.CATEGORY_AUDIT_URL || "http://127.0.0.1:3210";
const only = process.env.CATEGORY_AUDIT_ONLY?.split(",").filter(Boolean);
const resultFile = path.join(outputDir, "browser-scenarios.json");
const results = only && fs.existsSync(resultFile) ? JSON.parse(fs.readFileSync(resultFile, "utf8")).results : [];
function saveResult(row) {
  const existing = results.findIndex((item) => item.id === row.id);
  if (existing < 0) results.push(row); else results[existing] = row;
}
async function openForm(input, mode = "standard") {
  const page = await context.newPage();
  page.setDefaultTimeout(9000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${baseUrl}/talep`, { waitUntil: "domcontentloaded" });
  await page.locator("#talep-composer").fill(input);
  await page.getByTestId("composer-intro-continue").click();
  await page.getByTestId(mode === "maira" ? "maira-handoff-talk" : "maira-handoff-standard").click();
  if (mode === "maira") await page.getByTestId("maira-handoff").waitFor({ state: "hidden" });
  await page.waitForTimeout(650);
  return { page, errors };
}
async function snapshot(page) {
  return {
    rawInput: await page.locator("#talep-composer").inputValue(),
    body: await page.locator("body").innerText(),
    questions: await page.locator("[data-field-key]").evaluateAll((elements) =>
      elements.map((element) => ({ key: element.getAttribute("data-field-key"), text: element.innerText }))),
  };
}
async function answerBudget(page) {
  const input = page.locator("#budget-amount");
  await input.fill("25000");
  await input.press("Enter");
  await page.waitForTimeout(200);
}

const editCases = [
  ["real-estate", "Kiralık daire arıyorum"],
  ["technology", "Televizyon arıyorum"],
  ["appliances", "Çamaşır makinesi arıyorum"],
  ["furniture", "Ofis sandalyesi arıyorum"],
  ["printing", "Kartvizit bastırmak istiyorum"],
  ["machinery", "Jeneratör arıyorum"],
  ["baby", "Biberon arıyorum"],
  ["home-kitchen", "Yemek takımı arıyorum"],
  ["health", "Hasta monitörü arıyorum"],
  ["services", "Ev temizliği yaptırmak istiyorum"],
];
for (const [category, input] of editCases) {
  const row = { id: `browser-edit-${category}`, category, input, findings: [] };
  if (only && !only.includes(row.id)) continue;
  let page;
  try {
    const opened = await openForm(input);
    page = opened.page;
    await answerBudget(page);
    row.before = await snapshot(page);
    if (!row.before.body.includes("25.000")) row.findings.push("harness-budget-not-visible-before-edit");
    await page.locator("#talep-composer").fill(`${input}. Ayrıca fotoğraf paylaşılmasını istiyorum.`);
    await page.waitForTimeout(650);
    row.after = await snapshot(page);
    if (row.before.body.includes("25.000") && !row.after.body.includes("25.000")) row.findings.push("saved-budget-lost-on-unrelated-text-edit");
    row.errors = opened.errors;
    if (opened.errors.length) row.findings.push("browser-runtime-error");
    if (category === "technology") await page.screenshot({ path: path.join(outputDir, "browser-budget-after-text-edit.png"), fullPage: true });
  } catch (error) { row.findings.push(`harness-error: ${error.message}`); }
  if (page) await page.close();
  saveResult(row);
  console.log(JSON.stringify({ id: row.id, findings: row.findings }));
}

const probes = [
  ["wheelchair", "Tekerlekli sandalye arıyorum", ["supportProductUsage", "supportProductFit"], [], "Sağlık"],
  ["bottle-nipple", "Biberon ucu arıyorum", ["feedingNippleStage"], ["feedingBottleCapacity"], "Anne & Çocuk"],
  ["oven-dish", "Fırın kabı arıyorum", [], ["ovenType"], "Ev ve Mutfak"],
  ["milk-storage", "Anne sütü saklama poşeti arıyorum", [], ["paperWeight", "printType"], "Anne & Çocuk"],
  ["ac-service", "Klima servisi arıyorum", ["airConditionerBrand", "airConditionerNeed"], [], "Hizmetler"],
  ["sofa-cleaning", "Koltuk yıkama yaptırmak istiyorum", ["upholsterySeatCount"], [], "Hizmetler"],
  ["ac-product", "Klima arıyorum", ["airConditionerType"], [], "Beyaz Eşya"],
  ["concrete-pump", "Beton pompası arıyorum", ["concretePumpType"], ["partPreference"], "Makine"],
  ["cardboard-box", "Ürünlerim için karton kutu bastırmak istiyorum", ["boxPrintCoverage"], [], "Matbaa ve Ambalaj"],
  ["loader", "Yükleyici arıyorum", [], [], "Makine"],
  ["roof-rack-suv", "SUV tavan bagajı arıyorum", [], ["fuel", "transmission", "mileage", "modelYear"], "Otomotiv"],
  ["roof-rack-portbagaj", "Araba için portbagaj arıyorum", [], ["fuel", "transmission", "mileage", "modelYear"], "Otomotiv"],
  ["towbar-truck", "Kamyon için çeki demiri arıyorum", [], ["fuel", "transmission", "mileage", "modelYear"], "Otomotiv"],
  ["rubber-glove", "Lastik eldiven arıyorum", ["quantity"], ["tireSize", "tireSeason", "brand", "model", "machineType", "capacity", "modelYear", "power", "voltage", "operatingHours", "warranty"], "Makine"],
  ["negative-wheel-tire", "Jant değil lastik arıyorum", ["tireSeason"], [], "Otomotiv"],
  ["tire-storage-property", "Lastik deposu kiralamak istiyorum", ["area"], ["tireSize", "tireSeason"], "Emlak"],
  ["console-five", "PlayStation 5 arıyorum", [], ["model"], "Teknoloji"],
  ["console-four", "PlayStation 4 arıyorum", [], ["model"], "Teknoloji"],
];
for (const [id, input, required, forbidden, categoryLabel] of probes) {
  const row = { id: `browser-${id}`, input, categoryLabel, questions: [], findings: [] };
  if (only && !only.includes(row.id)) continue;
  let page;
  try {
    const opened = await openForm(input);
    page = opened.page;
    row.initial = await snapshot(page);
    if (!row.initial.body.split("\n").some((line) => line.trim() === categoryLabel)) {
      row.findings.push(`expected-category-not-shown:${categoryLabel}`);
    }
    for (let step = 0; step < 24; step++) {
      const question = page.locator("[data-field-key]").first();
      if (!await question.count()) break;
      const key = await question.getAttribute("data-field-key");
      const questionText = await question.innerText();
      if (row.questions.some((q) => q.key === key)) { row.findings.push(`question-did-not-advance:${key}`); break; }
      const entry = { key, text: questionText, answer: "" };
      row.questions.push(entry);
      if (key === "budget") { entry.answer = "25000"; await answerBudget(page); }
      else if (key === "city") {
        await question.getByLabel("İstanbul", { exact: true }).check();
        const select = question.locator("select");
        if (await select.count()) await select.selectOption({ label: "Kadıköy" });
        await question.getByRole("button", { name: "Kaydet", exact: true }).click();
        entry.answer = "İstanbul / Kadıköy";
      } else {
        const buttons = question.getByRole("button");
        const labels = await buttons.allTextContents();
        // Do not change the user's requested product to the first unrelated
        // family. Use an explicit unknown answer if the UI provides one.
        const family = /^(needType|productType|.*ProductType|machineType|furnitureType|applianceType|serviceType|propertyType)$/.test(key);
        const soft = /Fark etmez|Henüz bilmiyorum/;
        const selected = labels.find((label) =>
          (family || key === "brand" || key === "model") ? soft.test(label) :
            !/Kaydet|Atla|atla|Tümünü|Daha |Özel|Kendi|Fark etmez|Henüz bilmiyorum/.test(label));
        const fallback = selected || labels.find((label) => soft.test(label));
        if (fallback) {
          entry.answer = fallback.trim();
          await question.getByRole("button", { name: fallback.trim(), exact: true }).click();
        } else {
          const textInput = question.locator("input:not([type=checkbox])").first();
          if (await textInput.count()) {
            const answer = /quantity/.test(key) ? "2" : /dimension/i.test(key) ? "20 x 15 x 10 cm" : "Taşınabilir model";
            entry.answer = answer;
            await textInput.fill(answer);
            await question.getByRole("button", { name: "Kaydet", exact: true }).click();
          } else { row.findings.push(`harness-no-answer-control:${key}`); break; }
        }
      }
      await page.waitForTimeout(200);
      if (key === "airConditionerType") {
        row.afterAcTypeAnswer = await snapshot(page);
        if (/split/i.test(entry.answer) && !/split/i.test(row.afterAcTypeAnswer.body)) {
          row.findings.push("saved-ac-type-not-shown-in-answers");
        }
      }
    }
    row.final = await snapshot(page);
    if (["roof-rack-suv", "roof-rack-portbagaj", "towbar-truck"].includes(id) && !row.findings.length) {
      await page.locator("#talep-composer").fill(`${input}. Ayrıca fotoğraf paylaşılmasını istiyorum.`);
      await page.waitForTimeout(650);
      row.afterDetails = await snapshot(page);
      for (const question of row.afterDetails.questions) {
        row.findings.push(`accessory-answer-reopened-after-details:${question.key}`);
      }
      if (!row.afterDetails.body.includes("25.000")) row.findings.push("accessory-budget-lost-after-details");
    }
    for (const key of required) if (!row.questions.some((q) => q.key === key)) row.findings.push(`missing-family-question:${key}`);
    for (const key of forbidden) if (row.questions.some((q) => q.key === key)) row.findings.push(`unrelated-question:${key}`);
    row.errors = opened.errors;
    if (opened.errors.length) row.findings.push("browser-runtime-error");
    if (["wheelchair", "bottle-nipple", "oven-dish", "ac-product", "roof-rack-suv", "console-five"].includes(id)) await page.screenshot({ path: path.join(outputDir, `browser-${id}.png`), fullPage: true });
  } catch (error) { row.findings.push(`harness-error: ${error.message}`); }
  if (page) await page.close();
  saveResult(row);
  console.log(JSON.stringify({ id: row.id, steps: row.questions.length, findings: row.findings }));
}
const retentionCases = [
  ["rapid-edit", "Kiralık daire arıyorum"],
  ["budget-replacement", "Televizyon arıyorum"],
  ["blank-reset", "Televizyon arıyorum"],
  ["open-budget", "Biberon arıyorum"],
  ["nationwide-location", "Televizyon arıyorum"],
  ["maira-to-standard", "Klima arıyorum"],
];
for (const [id, input] of retentionCases) {
  const row = { id: `browser-retention-${id}`, input, findings: [] };
  if (only && !only.includes(row.id)) continue;
  let page;
  try {
    const opened = await openForm(input, id === "maira-to-standard" ? "maira" : "standard");
    page = opened.page;
    if (id === "maira-to-standard") {
      if (!/bütçe/i.test(await page.getByTestId("maira-question-prompt").innerText())) throw new Error("Expected budget question in Maira");
      await page.getByTestId("maira-free-answer").fill("25000");
      await page.getByTestId("maira-send-answer").click();
      await page.getByTestId("maira-exit-to-standard").click();
    } else if (id === "open-budget") {
      await page.locator('[data-field-key="budget"]').getByRole("button", { name: "Teklifleri görmek istiyorum", exact: true }).click();
    } else await answerBudget(page);
    if (id === "rapid-edit" || id === "nationwide-location") {
      const city = page.locator('[data-field-key="city"]');
      if (id === "nationwide-location") await city.getByLabel("Tümü (Türkiye geneli)", { exact: true }).check();
      else {
        await city.getByLabel("İstanbul", { exact: true }).check();
        await city.locator("select").selectOption({ label: "Kadıköy" });
      }
      await city.getByRole("button", { name: "Kaydet", exact: true }).click();
    }
    await page.waitForTimeout(200);
    row.before = await snapshot(page);
    const composer = page.locator("#talep-composer");
    if (id === "rapid-edit") {
      await composer.focus();
      await composer.press("End");
      await composer.pressSequentially(". Ayrıca fotoğraf paylaşılmasını istiyorum.", { delay: 8 });
    } else if (id === "budget-replacement") await composer.fill(`${input}. Bütçem 40000 TL.`);
    else if (id === "blank-reset") {
      await composer.fill("");
      await page.waitForTimeout(650);
      await composer.fill("Biberon arıyorum");
    } else await composer.fill(`${input}. Ayrıca fotoğraf paylaşılmasını istiyorum.`);
    await page.waitForTimeout(650);
    row.after = await snapshot(page);
    const keys = row.after.questions.map((q) => q.key);
    if (id === "blank-reset") {
      if (row.after.body.includes("25.000")) row.findings.push("reset-retained-old-budget");
      if (!keys.includes("budget")) row.findings.push("reset-did-not-reopen-budget");
    } else if (id === "budget-replacement") {
      if (!row.after.body.includes("40.000")) row.findings.push("new-budget-not-shown");
      if (row.after.body.includes("25.000")) row.findings.push("old-budget-retained");
    } else if (id === "open-budget") {
      if (keys.includes("budget")) row.findings.push("open-budget-reopened");
      if (!row.after.body.includes("Teklifleri görmek istiyorum")) row.findings.push("open-budget-choice-lost");
    } else if (!row.after.body.includes("25.000")) row.findings.push("saved-budget-lost");
    if (id === "rapid-edit") {
      if (!row.after.body.includes("Kadıköy")) row.findings.push("saved-district-lost");
      if (keys.includes("city")) row.findings.push("answered-city-reopened");
    }
    if (id === "nationwide-location") {
      if (!row.after.body.includes("Türkiye geneli")) row.findings.push("nationwide-choice-lost");
      if (keys.includes("city")) row.findings.push("nationwide-city-reopened");
    }
    row.errors = opened.errors;
    if (opened.errors.length) row.findings.push("browser-runtime-error");
  } catch (error) { row.findings.push(`harness-error: ${error.message}`); }
  if (page) await page.close();
  saveResult(row);
  console.log(JSON.stringify({ id: row.id, findings: row.findings }));
}
await browser.close();
fs.writeFileSync(resultFile, JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl,
  conditions: "Headless Edge, actual /talep page, standard form. External price preview and non-GET API calls disabled; no publishing.", results }, null, 2));
console.log(`Browser evidence written to ${outputDir}`);
if (results.some((row) => row.findings.length)) process.exitCode = 1;
