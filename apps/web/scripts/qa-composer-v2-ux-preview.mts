/**
 * UX polish screenshots for composer v2 (npx playwright --no-save).
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, devices } from "playwright";

const BASE = process.env.COMPOSER_QA_BASE ?? "http://127.0.0.1:3001";
const OUT = join(process.cwd(), ".qa-composer-v2-ux");
mkdirSync(OUT, { recursive: true });

async function waitUnderstanding(page: import("playwright").Page) {
  await page.waitForTimeout(1000);
  await page
    .locator("text=Kontrol ediliyor")
    .waitFor({ state: "hidden", timeout: 12000 })
    .catch(() => undefined);
  await page.waitForTimeout(500);
}

async function shot(page: import("playwright").Page, name: string) {
  await page.screenshot({ path: join(OUT, name), fullPage: true });
  console.log("shot", name);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const desktop = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await desktop.newPage();

  await page.goto(`${BASE}/onizleme/talep-composer-v2`, {
    waitUntil: "networkidle",
  });
  await shot(page, "01-desktop-empty.png");

  await page.fill("#preview-composer", "Arçelik 55 inç televizyon");
  await waitUnderstanding(page);
  await shot(page, "02-desktop-signal.png");

  if ((await page.locator("text=Birkaç netleştirme").count()) > 0) {
    await shot(page, "03-desktop-one-question.png");
  }

  await page.goto(`${BASE}/onizleme/talep-composer-v2?forceAmbiguous=1`, {
    waitUntil: "networkidle",
  });
  await page.fill("#preview-composer", "Arçelik televizyon");
  await waitUnderstanding(page);
  await shot(page, "04-desktop-category-ambiguous.png");

  const tech = page.getByRole("button", { name: /Teknoloji/i }).first();
  if ((await tech.count()) > 0) {
    await tech.click();
    await page.waitForTimeout(400);
  }
  await shot(page, "05-desktop-category-compact.png");

  const review = page.getByRole("button", { name: /Talebi gözden geçir/i });
  if ((await review.count()) > 0) {
    await review.first().click();
    await page.waitForTimeout(500);
  }
  await shot(page, "06-desktop-review.png");

  // Real /talep CTA presence (may require auth chrome around it)
  await page.goto(`${BASE}/talep`, { waitUntil: "networkidle" });
  await page.fill("#talep-composer", "Samsung 65 inç QLED TV");
  await waitUnderstanding(page);
  const goReview = page.getByRole("button", { name: /Talebi gözden geçir/i });
  if ((await goReview.count()) > 0) {
    await goReview.first().click();
    await page.waitForTimeout(600);
  }
  await shot(page, "07-desktop-publish-cta.png");

  await desktop.close();

  const mobile = await browser.newContext({ ...devices["iPhone 12"] });
  const m = await mobile.newPage();
  await m.goto(`${BASE}/onizleme/talep-composer-v2`, {
    waitUntil: "networkidle",
  });
  await shot(m, "08-mobile-empty.png");
  await m.fill("#preview-composer", "Arçelik 55 inç televizyon");
  await waitUnderstanding(m);
  await shot(m, "09-mobile-signal.png");
  if ((await m.locator("text=Birkaç netleştirme").count()) > 0) {
    await shot(m, "10-mobile-question.png");
  }
  const mReview = m.getByRole("button", { name: /Talebi gözden geçir/i });
  if ((await mReview.count()) > 0) {
    await mReview.first().click();
    await m.waitForTimeout(400);
  }
  await shot(m, "11-mobile-review.png");

  await m.fill("#preview-composer", "Matbaa için 5000 broşür baskısı");
  await waitUnderstanding(m);
  await shot(m, "12-printing.png");

  await m.goto(`${BASE}/onizleme/talep-composer-v2`, {
    waitUntil: "networkidle",
  });
  await m.fill("#preview-composer", "Heidelberg SM 74 nemlendirme pompası");
  await waitUnderstanding(m);
  await shot(m, "13-heidelberg.png");

  await browser.close();
  console.log("QA written to", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
