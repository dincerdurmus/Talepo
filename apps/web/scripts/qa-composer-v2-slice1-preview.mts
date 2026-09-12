/**
 * Slice-1 visual capture for /talep composer v2.
 * Usage: npx playwright test is not used — run with: npx tsx scripts/qa-composer-v2-slice1-preview.mts
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, ".qa-composer-v2-slice1");
mkdirSync(outDir, { recursive: true });

const base = process.env.TALEPO_PREVIEW_URL ?? "http://127.0.0.1:3001";

const browser = await chromium.launch({
  headless: true,
  channel: "chrome",
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto(`${base}/talep`, { waitUntil: "networkidle", timeout: 120_000 });
await page.screenshot({
  path: join(outDir, "01-empty-free-text.png"),
  fullPage: true,
});

const composer = page.locator("#talep-composer");
await composer.fill("Heidelberg SM 74 için nemlendirme pompası lazım.");
await page.waitForTimeout(2500);
await page.screenshot({
  path: join(outDir, "02-after-text-understanding.png"),
  fullPage: true,
});

// Wait for guidance card if present
const guidance = page.getByRole("heading", {
  name: "Talebinizi doğru uzmanlara yönlendirelim",
});
const guidanceVisible = await guidance.isVisible().catch(() => false);
if (guidanceVisible) {
  await guidance.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: join(outDir, "03-category-guidance.png"),
    fullPage: true,
  });
}

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${base}/talep?query=${encodeURIComponent("Ankara Çankaya'da kiralık 3+1 daire arıyorum.")}`, {
  waitUntil: "networkidle",
  timeout: 120_000,
});
await page.waitForTimeout(2500);
await page.screenshot({
  path: join(outDir, "04-mobile-query-entry.png"),
  fullPage: true,
});

await browser.close();
console.log(`Preview screenshots saved under ${outDir}`);
console.log(`guidanceVisible=${guidanceVisible}`);
