/**
 * Phase 2 screenshot capture for /onizleme/talep-composer-v2
 * Uses npx playwright (not a permanent package.json dependency).
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, devices } from "playwright";

const BASE = process.env.COMPOSER_QA_BASE ?? "http://127.0.0.1:3001";
const OUT = join(process.cwd(), ".qa-composer-v2-phase2");
mkdirSync(OUT, { recursive: true });

async function waitUnderstanding(page: import("playwright").Page) {
  await page.waitForTimeout(900);
  await page
    .locator("text=Talebinizi yeniden değerlendiriyoruz")
    .waitFor({ state: "hidden", timeout: 12000 })
    .catch(() => undefined);
  await page.waitForTimeout(400);
}

async function shot(page: import("playwright").Page, name: string) {
  await page.screenshot({
    path: join(OUT, name),
    fullPage: true,
  });
  console.log("shot", name);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  await page.goto(`${BASE}/onizleme/talep-composer-v2`, {
    waitUntil: "networkidle",
  });
  await shot(page, "01-empty-freetext.png");

  await page.fill("#preview-composer", "Arçelik 55 inç televizyon");
  await waitUnderstanding(page);
  await shot(page, "02-arcelik-55-facts.png");

  await page.fill("#preview-composer", "Heidelberg SM 74 nemlendirme pompası");
  await waitUnderstanding(page);
  await shot(page, "03-heidelberg-facts.png");

  await page.goto(`${BASE}/onizleme/talep-composer-v2?forceAmbiguous=1`, {
    waitUntil: "networkidle",
  });
  await page.fill("#preview-composer", "Arçelik televizyon");
  await waitUnderstanding(page);
  await shot(page, "04-category-ambiguous.png");

  // Conditional questions if present
  if ((await page.locator("text=Birkaç netleştirme").count()) > 0) {
    await shot(page, "05-focused-questions.png");
  } else {
    await page.fill("#preview-composer", "İstanbul’da kiralık 2+1 daire arıyorum");
    await waitUnderstanding(page);
    await shot(page, "05-focused-questions.png");
  }

  await page.fill("#preview-composer", "Matbaa için 5000 broşür baskısı");
  await waitUnderstanding(page);
  const bilmiyorum = page.getByRole("button", { name: /Ölçüyü bilmiyorum|Bilmiyorum/i });
  if ((await bilmiyorum.count()) > 0) {
    await bilmiyorum.first().click();
    await page.waitForTimeout(500);
  }
  await shot(page, "06-printing-dimensions-unknown.png");

  await page.goto(`${BASE}/onizleme/talep-composer-v2?forceAmbiguous=1`, {
    waitUntil: "networkidle",
  });
  await page.fill("#preview-composer", "Özel bir üretim ihtiyacım var");
  await waitUnderstanding(page);
  const other = page.getByRole("button", { name: /Başka alan/i });
  if ((await other.count()) > 0) await other.first().click();
  await page.waitForTimeout(400);
  await shot(page, "07-other-domain.png");

  const defer = page.getByRole("button", { name: /Talepo seçsin|Talepo karar versin/i });
  if ((await defer.count()) > 0) await defer.first().click();
  await page.waitForTimeout(400);
  await shot(page, "08-defer-to-talepo.png");

  await page.fill("#preview-composer", "Samsung 65 inç QLED TV");
  await waitUnderstanding(page);
  await shot(page, "09-attachments-panel.png");

  const summaryBtn = page.getByRole("button", {
    name: /Yayın öncesi özeti göster/i,
  });
  if ((await summaryBtn.count()) > 0) {
    await summaryBtn.first().click();
    await page.waitForTimeout(400);
  }
  await shot(page, "10-publish-summary.png");

  await context.close();

  const mobile = await browser.newContext({
    ...devices["iPhone 12"],
  });
  const mpage = await mobile.newPage();
  await mpage.goto(`${BASE}/onizleme/talep-composer-v2`, {
    waitUntil: "networkidle",
  });
  await shot(mpage, "11-mobile-empty.png");
  await mpage.fill("#preview-composer", "Arçelik 55 inç televizyon");
  await waitUnderstanding(mpage);
  const sum = mpage.getByRole("button", { name: /Yayın öncesi özeti göster/i });
  if ((await sum.count()) > 0) await sum.first().click();
  await mpage.waitForTimeout(500);
  await shot(mpage, "12-mobile-questions-summary.png");

  await browser.close();
  console.log("QA screenshots written to", OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
