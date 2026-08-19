/**
 * Responsive viewport smoke + overflow checks for public homepage.
 * Run: npx tsx scripts/smoke-public-home-responsive.mts
 */
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OUT = join(tmpdir(), "talepo-public-home-qa-final");
const BASE = process.env.PUBLIC_HOME_URL ?? "http://localhost:3000";

const VIEWPORTS = [
  { w: 1440, h: 1024, file: "01-anonymous-desktop-1440.png" },
  { w: 1280, h: 900, file: "desktop-1280.png" },
  { w: 1024, h: 768, file: "laptop-1024.png" },
  { w: 768, h: 1024, file: "14-tablet-768.png" },
  { w: 390, h: 844, file: "09-mobile-390-hero.png" },
  { w: 360, h: 800, file: "mobile-360.png" },
] as const;

async function main() {
  mkdirSync(OUT, { recursive: true });
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const checks: { name: string; ok: boolean; detail?: string }[] = [];
  const check = (name: string, ok: boolean, detail?: string) => {
    checks.push({ name, ok, detail });
    console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? `: ${detail}` : ""}`);
  };

  for (const { w, h, file } of VIEWPORTS) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth > doc.clientWidth + 1;
    });
    check(`no horizontal overflow ${w}x${h}`, !overflow);

    check(`H1 visible ${w}x${h}`, await page.locator("h1").first().isVisible());
    check(`composer ${w}x${h}`, await page.locator('textarea[name="query"]').isVisible());

    await page.screenshot({ path: join(OUT, file), fullPage: true });
  }

  await browser.close();
  const failed = checks.filter((c) => !c.ok);
  console.log(`\nScreenshots: ${OUT}`);
  console.log(`Checks: ${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
