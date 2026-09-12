/**
 * Option-first UX screenshots for composer v2 controls.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, devices, type Page } from "playwright";

const BASE = process.env.COMPOSER_QA_BASE ?? "http://127.0.0.1:3001";
const OUT = join(process.cwd(), ".qa-composer-v2-controls");
mkdirSync(OUT, { recursive: true });

async function waitU(page: Page) {
  await page.waitForTimeout(1100);
  await page
    .locator("text=Kontrol ediliyor")
    .waitFor({ state: "hidden", timeout: 20000 })
    .catch(() => undefined);
  await page.waitForTimeout(400);
}

async function fill(page: Page, text: string) {
  await page.locator("#preview-composer").fill(text);
  await waitU(page);
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: join(OUT, name), fullPage: true });
  console.log("shot", name);
}

async function tabByLabel(page: Page, re: RegExp) {
  const tabs = page.locator('[role="tab"]');
  const n = await tabs.count();
  for (let i = 0; i < n; i++) {
    const t = await tabs.nth(i).innerText();
    if (re.test(t)) {
      await tabs.nth(i).click();
      await page.waitForTimeout(250);
      return true;
    }
  }
  return false;
}

async function main() {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.clearCookies();
  const page = await ctx.newPage();

  await page.goto(`${BASE}/onizleme/talep-composer-v2`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForSelector("#preview-composer", { timeout: 60000 });
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* */
    }
  });

  // Baby — budget options first
  await fill(page, "bebek arabası arıyorum");
  await shot(page, "desktop-baby-budget-options.png");

  // Open budget range form
  const rangeBtn = page.getByRole("button", { name: /Bütçe aralığı belirt/i });
  if ((await rangeBtn.count()) > 0) {
    await rangeBtn.first().click();
    await page.waitForTimeout(300);
    await shot(page, "desktop-baby-budget-range-form.png");
    await page.getByRole("button", { name: /^Geri$/i }).click().catch(() => undefined);
  }

  await page.getByRole("button", { name: /Teklifleri görmek istiyorum/i }).first().click();
  await page.waitForTimeout(400);

  // Location picker
  await tabByLabel(page, /Konum|Teslimat ili|il/i);
  await shot(page, "desktop-baby-location-picker.png");
  await page.getByRole("button", { name: /Türkiye geneli/i }).first().click();
  await page.waitForTimeout(400);

  // Delivery options
  await tabByLabel(page, /Zaman|Teslim/i);
  await shot(page, "desktop-baby-delivery-options.png");
  await page.getByRole("button", { name: /Esnek|1 hafta/i }).first().click();
  await page.waitForTimeout(400);

  // Keep answering until quantity or review
  for (let i = 0; i < 6; i++) {
    const qty = page.locator('[data-control-type="number_presets"]');
    if ((await qty.count()) > 0) {
      await shot(page, "desktop-baby-quantity-options.png");
      const custom = page.getByRole("button", { name: /Özel adet/i });
      if ((await custom.count()) > 0) {
        await custom.first().click();
        await page.waitForTimeout(200);
        await shot(page, "desktop-baby-quantity-custom.png");
        await page.locator('input[inputmode="numeric"]').fill("4");
        await page.getByRole("button", { name: /^Kaydet$/i }).click();
      } else {
        await page.getByRole("button", { name: /1 adet|^1$/i }).first().click();
      }
      break;
    }
    const cta = page.getByRole("button", { name: /Talebi gözden geçir/i });
    if ((await cta.count()) > 0) break;
    const any = page.locator('[data-testid="composer-questions"] button').first();
    if ((await any.count()) > 0) await any.click();
    await page.waitForTimeout(300);
  }

  const review = page.getByRole("button", { name: /Talebi gözden geçir/i });
  if ((await review.count()) > 0) {
    await review.click();
    await page.waitForTimeout(500);
    await shot(page, "desktop-baby-review-summary.png");
  }

  // Printing
  await page.goto(`${BASE}/onizleme/talep-composer-v2`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForSelector("#preview-composer", { timeout: 60000 });
  await fill(page, "broşür bastırmak istiyorum");
  // Answer until quantity
  for (let i = 0; i < 8; i++) {
    if ((await page.locator('[data-control-type="number_presets"]').count()) > 0) {
      await shot(page, "desktop-printing-quantity-options.png");
      break;
    }
    await tabByLabel(page, /Adet|Miktar/i);
    if ((await page.locator('[data-control-type="number_presets"]').count()) > 0) {
      await shot(page, "desktop-printing-quantity-options.png");
      break;
    }
    const soft = page.getByRole("button", {
      name: /Teklifleri|Türkiye geneli|Esnek|Henüz|Fark etmez|Konum fark/i,
    });
    if ((await soft.count()) > 0) {
      await soft.first().click();
      await page.waitForTimeout(350);
    } else break;
  }

  // Real estate
  await page.goto(`${BASE}/onizleme/talep-composer-v2`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.waitForSelector("#preview-composer", { timeout: 60000 });
  await fill(page, "2+1 satılık ev arıyorum");
  await shot(page, "desktop-re-location-budget.png");

  await ctx.close();

  // Mobile
  const mobile = await browser.newContext({ ...devices["iPhone 12"] });
  const m = await mobile.newPage();
  await m.goto(`${BASE}/onizleme/talep-composer-v2`, { waitUntil: "networkidle" });
  await fill(m, "bebek arabası arıyorum");
  await shot(m, "mobile-baby-option-chips.png");
  await mobile.close();
  await browser.close();
  console.log("QA done →", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
