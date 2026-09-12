import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, ".qa-composer-v2-slice1");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
await page.goto("http://127.0.0.1:3001/onizleme/talep-composer-v2", {
  waitUntil: "networkidle",
  timeout: 120_000,
});
await page.waitForTimeout(800);
await page.screenshot({
  path: join(outDir, "05-onizleme-guidance.png"),
  fullPage: true,
});
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({
  path: join(outDir, "06-onizleme-mobile.png"),
  fullPage: true,
});
await browser.close();
console.log("onizleme screenshots ok");
