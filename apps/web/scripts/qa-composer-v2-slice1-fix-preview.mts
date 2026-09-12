/**
 * Visual proof for slice-1 stale-clear + guidance actions.
 * Uses system Chrome channel (no bundled chromium download).
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, ".qa-composer-v2-slice1-fix");
mkdirSync(outDir, { recursive: true });

const base = process.env.TALEPO_PREVIEW_URL ?? "http://127.0.0.1:3001";
const url = `${base}/onizleme/talep-composer-v2?forceAmbiguous=1`;

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });

await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
await page.waitForTimeout(1200);

const composer = page.locator("#preview-composer");

// 1) Heidelberg
await composer.fill("Heidelberg SM 74 için nemlendirme pompası lazım.");
await page.waitForTimeout(1800);
await page.screenshot({
  path: join(outDir, "01-heidelberg.png"),
  fullPage: true,
});

// 2) Switch to Arçelik — Heidelberg must not linger
await composer.fill("Arçelik 55 inç televizyon arıyorum.");
await page.waitForTimeout(2000);
const bodyText = await page.locator("main").innerText();
if (/Heidelberg/i.test(bodyText) || /SM 74/i.test(bodyText) || /nemlendirme/i.test(bodyText)) {
  throw new Error("Stale Heidelberg content still visible after Arçelik edit");
}
if (/userChoice|Seçilen slug/i.test(bodyText)) {
  throw new Error("Debug panel leaked into user preview");
}
await page.screenshot({
  path: join(outDir, "02-arcelik-after-switch.png"),
  fullPage: true,
});

// 3) none_of_these
await page.getByRole("button", { name: /Bunlardan hiçbiri/i }).click();
await page.waitForTimeout(400);
await page.screenshot({
  path: join(outDir, "03-none-of-these.png"),
  fullPage: true,
});

// Reset text to refresh guidance for other actions
await composer.fill("Arçelik 55 inç televizyon arıyorum.");
await page.waitForTimeout(1600);

// 4) other_domain
await page.getByRole("button", { name: /Başka bir alan/i }).click();
await page.waitForTimeout(400);
await page.getByLabel(/nerede kullanılıyor/i).fill(
  "Ev oturma odasında kullanacağım",
);
await page.waitForTimeout(300);
await page.screenshot({
  path: join(outDir, "04-other-domain.png"),
  fullPage: true,
});

// 5) defer
await composer.fill("Arçelik 55 inç televizyon arıyorum.");
await page.waitForTimeout(1600);
await page.getByRole("button", { name: /Emin değilim, Talepo seçsin/i }).click();
await page.waitForTimeout(400);
await page.screenshot({
  path: join(outDir, "05-defer-to-talepo.png"),
  fullPage: true,
});

// 6) mobile
await page.setViewportSize({ width: 390, height: 844 });
await composer.fill("Ankara Çankaya'da kiralık 3+1 daire arıyorum.");
await page.waitForTimeout(1800);
await page.screenshot({
  path: join(outDir, "06-mobile.png"),
  fullPage: true,
});

await browser.close();
console.log(`Screenshots saved under ${outDir}`);
