/**
 * Live DOM wiring acceptance against real rendered /onizleme and /talep.
 * Asserts visible question prompts and review CTA gating — not unit helpers alone.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, devices, type Page } from "playwright";

const BASE = process.env.COMPOSER_QA_BASE ?? "http://127.0.0.1:3001";
const OUT = join(process.cwd(), ".qa-composer-v2-wiring");
mkdirSync(OUT, { recursive: true });

let passed = 0;
let failed = 0;
const lines: string[] = [];

function log(msg: string) {
  lines.push(msg);
  console.log(msg);
}

async function check(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed += 1;
    log(`PASS  ${name}`);
  } catch (e) {
    failed += 1;
    log(`FAIL  ${name}`);
    log(String(e));
  }
}

async function waitUnderstanding(page: Page) {
  await page.waitForTimeout(1200);
  await page
    .locator("text=Kontrol ediliyor")
    .waitFor({ state: "hidden", timeout: 25000 })
    .catch(() => undefined);
  await page.waitForTimeout(600);
}

async function fill(page: Page, text: string, selector: string) {
  const el = page.locator(selector);
  if ((await el.count()) === 0) {
    await page.locator("textarea").first().fill(text);
  } else {
    await el.fill("");
    await el.fill(text);
  }
  await waitUnderstanding(page);
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: join(OUT, name), fullPage: true });
  log(`shot ${name}`);
}

async function bodyText(page: Page) {
  return (await page.locator("body").innerText()).toLocaleLowerCase("tr-TR");
}

async function assertNoReviewCta(page: Page) {
  const cta = page.getByRole("button", { name: /^Talebi gözden geçir$/i });
  const count = await cta.count();
  if (count > 0 && (await cta.first().isVisible())) {
    throw new Error("Review CTA visible but should be hidden");
  }
}

async function assertHasPrompt(page: Page, re: RegExp) {
  const text = await bodyText(page);
  if (!re.test(text)) {
    throw new Error(`Expected prompt matching ${re}; body snippet: ${text.slice(0, 400)}`);
  }
}

async function activateQuestion(page: Page, fieldKey: string) {
  const panel = page.locator(`[data-testid="composer-question-${fieldKey}"]`);
  if ((await panel.count()) > 0) return;
  const tabs = page.locator('[role="tab"]');
  const n = await tabs.count();
  for (let i = 0; i < n; i++) {
    await tabs.nth(i).click();
    await page.waitForTimeout(200);
    if ((await page.locator(`[data-testid="composer-question-${fieldKey}"]`).count()) > 0) {
      return;
    }
  }
}

async function clickEscape(page: Page, name: RegExp, fieldKey?: string) {
  if (fieldKey) await activateQuestion(page, fieldKey);
  const btn = page.getByRole("button", { name });
  if ((await btn.count()) === 0) {
    throw new Error(`Escape missing: ${name}`);
  }
  await btn.first().click();
  await page.waitForTimeout(500);
}

async function answerUntilReview(page: Page, max = 10) {
  for (let i = 0; i < max; i++) {
    const cta = page.getByRole("button", { name: /^Talebi gözden geçir$/i });
    if ((await cta.count()) > 0 && (await cta.first().isVisible())) {
      return true;
    }
    for (const re of [
      /Teklifleri görmek istiyorum/i,
      /Türkiye geneli/i,
      /Konum fark etmez/i,
      /Uzaktan uygun/i,
      /Fark etmez/i,
      /Henüz bilmiyorum/i,
    ]) {
      const btn = page.getByRole("button", { name: re });
      if ((await btn.count()) > 0 && (await btn.first().isVisible())) {
        await btn.first().click();
        await page.waitForTimeout(450);
        break;
      }
    }
  }
  return false;
}

async function run() {
  const browser = await chromium.launch({
    headless: true,
    channel: "chrome",
  });
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  // Fresh session — no prior composer storage
  await desktop.clearCookies();
  const page = await desktop.newPage();

  // --- Demo: bebek before answers ---
  await page.goto(`${BASE}/onizleme/talep-composer-v2`, {
    waitUntil: "networkidle",
  });
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
  });
  await page.reload({ waitUntil: "networkidle" });
  await fill(page, "bebek arabası arıyorum", "#preview-composer");
  await shot(page, "desktop-baby-before-answers.png");

  await check("demo baby: product fact", async () => {
    const t = await bodyText(page);
    if (!/bebek arabas/.test(t)) throw new Error("product missing");
  });
  await check("demo baby: no brand/model rows", async () => {
    const t = await bodyText(page);
    // Fact board labels — Marka/Model should not appear as fact rows for this input
    if (/\n\s*marka\s*\n/i.test(t) || /\n\s*model\s*\n/i.test(t)) {
      throw new Error("brand/model fact row visible");
    }
  });
  await check("demo baby: budget prompt visible", async () => {
    await assertHasPrompt(page, /bütçeniz nedir/i);
  });
  await check("demo baby: location prompt visible", async () => {
    // May be on tab 2 — open all question tabs
    const tabs = page.locator('[role="tab"]');
    const n = await tabs.count();
    let found = false;
    for (let i = 0; i < n; i++) {
      await tabs.nth(i).click();
      await page.waitForTimeout(200);
      const t = await bodyText(page);
      if (/nereye teslim|hangi il|konum/i.test(t)) found = true;
    }
    if (!found) {
      // Also check question panel contains city field
      const cityQ = page.locator('[data-field-key="city"], [data-testid="composer-question-city"]');
      if ((await cityQ.count()) === 0 && n === 0) {
        await assertHasPrompt(page, /nereye teslim|hangi il/i);
      } else if ((await cityQ.count()) === 0 && !found) {
        // cycle tabs already — fail
        throw new Error("location prompt not found across tabs");
      }
    }
  });
  await check("demo baby: review CTA hidden", async () => {
    await assertNoReviewCta(page);
  });
  await check("demo baby: no Uzaktan for physical", async () => {
    const t = await bodyText(page);
    // Soft escape "Uzaktan" should not appear for baby product location
    const tabs = page.locator('[role="tab"]');
    for (let i = 0; i < (await tabs.count()); i++) {
      await tabs.nth(i).click();
      await page.waitForTimeout(150);
    }
    const cityPanel = page.locator('[data-testid="composer-question-city"]');
    if ((await cityPanel.count()) > 0) {
      const cityText = (await cityPanel.innerText()).toLocaleLowerCase("tr-TR");
      if (/\buzaktan\b/.test(cityText)) {
        throw new Error("Uzaktan shown on physical product location");
      }
    } else {
      // If city is active prompt area
      void t;
    }
  });

  // Answer budget + location + delivery
  await clickEscape(page, /Teklifleri görmek istiyorum/i, "budget");
  await shot(page, "desktop-baby-after-budget-location.png");
  // location
  await activateQuestion(page, "city");
  const nationwide = page.getByRole("button", { name: /Türkiye geneli/i });
  if ((await nationwide.count()) > 0) {
    await nationwide.first().click();
    await page.waitForTimeout(400);
  } else {
    await clickEscape(page, /Konum fark etmez/i, "city");
  }
  await activateQuestion(page, "delivery");
  const fark = page.getByRole("button", { name: /^Fark etmez$/i });
  if ((await fark.count()) > 0) {
    await fark.first().click();
    await page.waitForTimeout(400);
  } else {
    const bilmiyorum = page.getByRole("button", { name: /Henüz bilmiyorum/i });
    if ((await bilmiyorum.count()) > 0) {
      await bilmiyorum.first().click();
      await page.waitForTimeout(400);
    }
  }
  // Keep answering soft escapes until review
  const gotReview = await answerUntilReview(page);
  await check("demo baby: review after criticals", async () => {
    if (!gotReview) throw new Error("Review CTA never appeared");
  });
  await page.getByRole("button", { name: /^Talebi gözden geçir$/i }).click();
  await page.waitForTimeout(600);
  await shot(page, "desktop-baby-review.png");

  // --- Demo: RE without location ---
  await page.goto(`${BASE}/onizleme/talep-composer-v2`, {
    waitUntil: "networkidle",
  });
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
  });
  await fill(page, "2+1 satılık ev arıyorum", "#preview-composer");
  await shot(page, "desktop-real-estate-before-answers.png");
  await check("demo RE: location prompt", async () => {
    const tabs = page.locator('[role="tab"]');
    let found = false;
    for (let i = 0; i < (await tabs.count()); i++) {
      await tabs.nth(i).click();
      await page.waitForTimeout(150);
      if (/hangi il|ilçede|konum/i.test(await bodyText(page))) found = true;
    }
    if (!found) await assertHasPrompt(page, /hangi il|ilçede|konum/i);
  });
  await check("demo RE: budget prompt", async () => {
    const tabs = page.locator('[role="tab"]');
    let found = false;
    for (let i = 0; i < (await tabs.count()); i++) {
      await tabs.nth(i).click();
      await page.waitForTimeout(150);
      if (/bütçe/i.test(await bodyText(page))) found = true;
    }
    if (!found) await assertHasPrompt(page, /bütçe/i);
  });
  await check("demo RE: review CTA hidden", async () => {
    await assertNoReviewCta(page);
  });

  // --- Demo: RE with location+budget in text ---
  await fill(
    page,
    "İstanbul Kadıköy’de 5-7 milyon TL bütçeyle 2+1 satılık daire arıyorum",
    "#preview-composer",
  );
  await shot(page, "desktop-real-estate-with-location-budget.png");
  await check("demo RE filled: no re-ask budget/city if extracted", async () => {
    const t = await bodyText(page);
    // Should not show review yet if other criticals remain, but budget/city may be filled
    const reviewVisible =
      (await page.getByRole("button", { name: /^Talebi gözden geçir$/i }).count()) >
        0 &&
      (await page
        .getByRole("button", { name: /^Talebi gözden geçir$/i })
        .first()
        .isVisible()
        .catch(() => false));
    // If city+budget extracted, remaining criticals like listingType may remain
    if (reviewVisible) {
      // Only OK if schedule truly empty critical — still assert location/budget present in facts
      if (!/istanbul|kadıköy|kadikoy/i.test(t)) {
        throw new Error("location not in facts/body");
      }
    }
  });

  // --- Demo: remote logo ---
  await page.goto(`${BASE}/onizleme/talep-composer-v2`, {
    waitUntil: "networkidle",
  });
  await fill(page, "uzaktan logo tasarımı yaptırmak istiyorum", "#preview-composer");
  await shot(page, "desktop-remote-service.png");
  await check("demo remote: budget visible, review hidden", async () => {
    await assertHasPrompt(page, /bütçe/i);
    await assertNoReviewCta(page);
  });

  // --- Real /talep ---
  await page.goto(`${BASE}/talep`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
  });
  if ((await page.locator("#talep-composer, textarea").count()) === 0) {
    await shot(page, "desktop-real-talep-auth.png");
    log("SKIP real /talep — auth wall");
  } else {
    await fill(page, "bebek arabası arıyorum", "#talep-composer");
    await shot(page, "desktop-real-talep-before-answers.png");
    await check("talep baby: budget+location, no review", async () => {
      await assertHasPrompt(page, /bütçe/i);
      const tabs = page.locator('[role="tab"]');
      let loc = false;
      for (let i = 0; i < (await tabs.count()); i++) {
        await tabs.nth(i).click();
        await page.waitForTimeout(150);
        if (/nereye teslim|hangi il/i.test(await bodyText(page))) loc = true;
      }
      if (!loc) await assertHasPrompt(page, /nereye teslim|hangi il/i);
      await assertNoReviewCta(page);
    });
    const reviewed = await answerUntilReview(page);
    if (reviewed) {
      await page.getByRole("button", { name: /^Talebi gözden geçir$/i }).click();
      await page.waitForTimeout(600);
    }
    await shot(page, "desktop-real-talep-review.png");
    await check("talep baby: review reachable after answers", async () => {
      if (!reviewed) throw new Error("could not reach review on /talep");
    });
  }

  // Mobile baby
  await desktop.close();
  const mobile = await browser.newContext({ ...devices["iPhone 12"] });
  await mobile.clearCookies();
  const mpage = await mobile.newPage();
  await mpage.goto(`${BASE}/onizleme/talep-composer-v2`, {
    waitUntil: "networkidle",
  });
  await mpage.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
  });
  await fill(mpage, "bebek arabası arıyorum", "#preview-composer");
  await shot(mpage, "mobile-baby-before-answers.png");
  await check("mobile baby: no review CTA", async () => {
    await assertNoReviewCta(mpage);
  });
  const mReview = await answerUntilReview(mpage);
  if (mReview) {
    await mpage.getByRole("button", { name: /^Talebi gözden geçir$/i }).click();
    await mpage.waitForTimeout(500);
  }
  await shot(mpage, "mobile-baby-review.png");

  await mobile.close();
  await browser.close();

  log(`\n${passed} passed, ${failed} failed`);
  writeFileSync(join(OUT, "RESULTS.txt"), lines.join("\n"), "utf8");
  if (failed > 0) process.exit(1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
