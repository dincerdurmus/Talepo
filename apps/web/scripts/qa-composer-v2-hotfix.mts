/**
 * Hotfix QA: entity + global budget/location on real /talep
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, devices } from "playwright";

const BASE = process.env.COMPOSER_QA_BASE ?? "http://127.0.0.1:3000";
const OUT = join(process.cwd(), ".qa-composer-v2-hotfix");
mkdirSync(OUT, { recursive: true });

async function waitUnderstanding(page: import("playwright").Page) {
  await page.waitForTimeout(1000);
  await page
    .locator("text=Kontrol ediliyor")
    .waitFor({ state: "hidden", timeout: 20000 })
    .catch(() => undefined);
  await page.waitForTimeout(500);
}

async function shot(page: import("playwright").Page, name: string) {
  await page.screenshot({ path: join(OUT, name), fullPage: true });
  console.log("shot", name);
}

async function fillTalep(page: import("playwright").Page, text: string) {
  const el = page.locator("#talep-composer");
  if ((await el.count()) === 0) {
    await page.locator("textarea").first().fill(text);
  } else {
    await el.fill(text);
  }
  await waitUnderstanding(page);
}

async function clickIfVisible(
  page: import("playwright").Page,
  name: RegExp,
) {
  const btn = page.getByRole("button", { name });
  if ((await btn.count()) > 0) {
    await btn.first().click();
    await page.waitForTimeout(500);
    return true;
  }
  return false;
}

async function answerUntilReview(page: import("playwright").Page) {
  for (let i = 0; i < 8; i++) {
    const goReview = page.getByRole("button", { name: /Talebi gözden geçir/i });
    if ((await goReview.count()) > 0 && (await goReview.first().isEnabled())) {
      await goReview.first().click();
      await page.waitForTimeout(700);
      return true;
    }
    if (await clickIfVisible(page, /Teklifleri görmek istiyorum/i)) continue;
    if (await clickIfVisible(page, /Türkiye geneli/i)) continue;
    if (await clickIfVisible(page, /Uzaktan uygun/i)) continue;
    if (await clickIfVisible(page, /Fark etmez/i)) continue;
    if (await clickIfVisible(page, /Henüz bilmiyorum/i)) continue;
    if (await clickIfVisible(page, /Konum fark etmez/i)) continue;
    break;
  }
  return false;
}

async function runViewport(
  browser: import("playwright").Browser,
  label: "desktop" | "mobile",
  opts: { viewport?: { width: number; height: number }; device?: (typeof devices)[string] },
) {
  const context = await browser.newContext(
    opts.device ? { ...opts.device } : { viewport: opts.viewport },
  );
  const page = await context.newPage();

  await page.goto(`${BASE}/talep`, { waitUntil: "networkidle" });
  if ((await page.locator("#talep-composer, textarea").count()) === 0) {
    await shot(page, `${label}-00-talep-auth.png`);
    await context.close();
    return;
  }

  await fillTalep(page, "bebek arabası arıyorum");
  await shot(page, `${label}-01-bebek-facts-questions.png`);
  const reviewed = await answerUntilReview(page);
  await shot(
    page,
    reviewed
      ? `${label}-03-bebek-review.png`
      : `${label}-03-bebek-no-review-yet.png`,
  );

  await page.goto(`${BASE}/talep`, { waitUntil: "networkidle" });
  await fillTalep(
    page,
    "İstanbul Kadıköy'e Chicco Goody Plus bebek arabası arıyorum, bütçem 20-30 bin TL",
  );
  await shot(page, `${label}-04-chicco.png`);

  await page.goto(`${BASE}/talep`, { waitUntil: "networkidle" });
  await fillTalep(page, "mama sandalyesi arıyorum");
  await shot(page, `${label}-05-mama.png`);

  await page.goto(`${BASE}/talep`, { waitUntil: "networkidle" });
  await fillTalep(page, "uzaktan logo tasarımı yaptırmak istiyorum");
  await shot(page, `${label}-06-logo-remote.png`);

  await context.close();
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    channel: "chrome",
  });
  await runViewport(browser, "desktop", {
    viewport: { width: 1440, height: 900 },
  });
  await runViewport(browser, "mobile", { device: devices["iPhone 12"] });
  await browser.close();
  console.log("QA done →", OUT);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
