/**
 * Public homepage visual smoke + screenshots (anonymous).
 * Run: npx tsx scripts/smoke-public-home-qa-final.mts
 */
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OUT = join(tmpdir(), "talepo-public-home-qa-final");
const BASE = process.env.PUBLIC_HOME_URL ?? "http://localhost:3000";

async function main() {
  mkdirSync(OUT, { recursive: true });

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1024 },
    locale: "tr-TR",
  });
  const page = await context.newPage();

  const checks: { name: string; ok: boolean; detail?: string }[] = [];
  const check = (name: string, ok: boolean, detail?: string) => {
    checks.push({ name, ok, detail });
    console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? `: ${detail}` : ""}`);
  };

  const res = await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  check("GET / 200", res?.status() === 200, String(res?.status()));

  check("H1 visible", await page.locator("h1").first().isVisible());
  check(
    "hero headline",
    (await page.locator("h1").first().textContent())?.includes("İhtiyacınızı yazın") ?? false,
  );

  const textarea = page.locator('textarea[name="query"]');
  check("composer textarea", await textarea.isVisible());
  await textarea.fill("50 ofis sandalyesi, İstanbul");
  const devam = page.getByRole("button", { name: /Devam/i });
  check("devam enabled with text", await devam.isEnabled());

  await Promise.all([
    page.waitForURL(/\/talep\?query=/),
    devam.click(),
  ]);
  check("composer navigates to /talep", page.url().includes("/talep?query="));
  check(
    "query encoded",
    decodeURIComponent(page.url()).includes("50 ofis sandalyesi, İstanbul"),
  );

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /5\.000 adet karton kutu/i }).click();
  check(
    "suggestion chip fills composer",
    (await textarea.inputValue()).includes("5.000 adet karton kutu"),
  );

  for (const [id, file] of [
    ["#kategoriler", "04-categories-desktop.png"],
    ["#nasil", "05-how-it-works-desktop.png"],
    ["#saticilar", "06-buyer-seller-desktop.png"],
    ["#planlar", "07-pricing-desktop.png"],
  ] as const) {
    await page.locator(id).scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(OUT, file) });
    check(`anchor ${id} scroll`, await page.locator(id).isVisible());
  }

  await page.screenshot({ path: join(OUT, "01-anonymous-desktop-1440.png"), fullPage: true });
  await page.screenshot({ path: join(OUT, "03-hero-desktop.png"), clip: { x: 0, y: 0, width: 1440, height: 900 } });

  await page.locator("footer").scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(OUT, "08-footer-desktop.png") });
  check("footer no önizleme", !(await page.locator("footer").textContent())?.includes("Önizleme"));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.screenshot({ path: join(OUT, "09-mobile-390-hero.png") });
  await page.locator("#kategoriler").scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(OUT, "10-mobile-390-categories.png") });
  await page.locator("#nasil").scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(OUT, "11-mobile-390-flow.png") });
  await page.locator("#planlar").scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(OUT, "12-mobile-390-pricing.png") });
  await page.locator("footer").scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(OUT, "13-mobile-390-footer.png") });
  await page.screenshot({ path: join(OUT, "full-mobile-390.png"), fullPage: true });

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.screenshot({ path: join(OUT, "14-tablet-768.png"), fullPage: true });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.screenshot({ path: join(OUT, "desktop-1280.png"), fullPage: true });

  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.screenshot({ path: join(OUT, "laptop-1024.png"), fullPage: true });

  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.screenshot({ path: join(OUT, "mobile-360.png"), fullPage: true });

  const failed = checks.filter((c) => !c.ok);
  await browser.close();

  console.log(`\nScreenshots: ${OUT}`);
  console.log(`Checks: ${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
