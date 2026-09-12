/**
 * Live DOM acceptance + screenshots for composer v2 integration fixes.
 * Assertions first; screenshots second. No publish clicks on /talep.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, devices, type Page, type ConsoleMessage } from "playwright";

const BASE = process.env.COMPOSER_QA_BASE ?? "http://127.0.0.1:3001";
const OUT = join(process.cwd(), ".qa-composer-v2-integration");
mkdirSync(OUT, { recursive: true });

type Result = { name: string; ok: boolean; detail?: string };
const results: Result[] = [];

function check(name: string, ok: boolean, detail?: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function waitUnderstanding(page: Page, _textRe?: RegExp, timeout = 30000) {
  await page
    .locator("text=Kontrol ediliyor")
    .waitFor({ state: "hidden", timeout })
    .catch(() => undefined);
  await page
    .locator(
      '[data-testid="composer-questions"], [data-testid="composer-question-budget"], [data-control-type]',
    )
    .first()
    .waitFor({ state: "visible", timeout });
}

async function openFreshDemo(page: Page) {
  await page.goto(`${BASE}/onizleme/talep-composer-v2`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* */
    }
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#preview-composer").waitFor({ state: "visible", timeout: 30000 });
}

async function fillComposer(page: Page, selector: string, text: string) {
  const box = page.locator(selector).first();
  await box.waitFor({ state: "visible", timeout: 30000 });
  await box.fill(text);
  await page.waitForTimeout(400);
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: join(OUT, name), fullPage: true });
}

async function assertNoAppIssueBadge(page: Page, label: string) {
  // Next.js issue badge (dev overlay) — must be absent after env/session fix
  const badge = page.locator("button").filter({ hasText: /\d+\s*Issue/i });
  const n = await badge.count();
  check(`${label}: no Issue badge`, n === 0, n ? `found ${n}` : undefined);
}

async function collectConsoleErrors(page: Page): Promise<string[]> {
  const errs: string[] = [];
  const handler = (m: ConsoleMessage) => {
    if (m.type() === "error") errs.push(m.text());
  };
  page.on("console", handler);
  (page as Page & { __off?: () => void }).__off = () => page.off("console", handler);
  return errs;
}

async function runDemoBabyNationwide(page: Page) {
  await openFreshDemo(page);
  await fillComposer(page, "#preview-composer", "bebek arabası arıyorum");
  await waitUnderstanding(page);

  check(
    "baby start: budget prompt",
    await page.getByText(/Bütçeniz nedir/i).isVisible(),
  );
  check(
    "baby start: budget options",
    (await page.getByRole("button", { name: /Teklifleri görmek istiyorum/i }).count()) >
      0,
  );
  check(
    "baby start: review CTA hidden",
    (await page.getByTestId("composer-review-cta").count()) === 0,
  );
  await shot(page, "desktop-baby-budget.png");
  await assertNoAppIssueBadge(page, "baby-budget");

  // Location tab
  const locTab = page.getByRole("tab", { name: /Konum/i });
  if ((await locTab.count()) > 0) await locTab.click();
  else {
    // answer budget first to surface location
    await page.getByRole("button", { name: /Teklifleri görmek istiyorum/i }).first().click();
    await page.waitForTimeout(400);
  }
  check(
    "baby: delivery location prompt exists",
    (await page.getByText(/Nereye teslim edilecek/i).count()) > 0 ||
      (await page.getByRole("tab", { name: /Konum/i }).count()) > 0,
  );

  // City-district path
  await page.locator("#composer-il").selectOption({ label: "İstanbul" });
  await page.waitForTimeout(200);
  const ilceOptions = await page.locator("#composer-ilce option").allTextContents();
  check(
    "ilçe lists İstanbul districts",
    ilceOptions.some((t) => /Kadıköy/i.test(t)) &&
      !ilceOptions.some((t) => /Çankaya/i.test(t) && !/Kadıköy/.test(t)),
  );
  await page.locator("#composer-ilce").selectOption({ label: "Kadıköy" });
  await page.waitForTimeout(400);
  await shot(page, "desktop-baby-city-district.png");

  // Finish remaining criticals for city-district review
  for (let i = 0; i < 8; i++) {
    if ((await page.getByTestId("composer-review-cta").count()) > 0) break;
    const soft = page.getByRole("button", {
      name: /Teklifleri görmek|Esnek|1 hafta|Henüz bilmiyorum|Fark etmez|Sıfır/i,
    });
    if ((await soft.count()) > 0) {
      await soft.first().click();
      await page.waitForTimeout(350);
    } else break;
  }
  if ((await page.getByTestId("composer-review-cta").count()) > 0) {
    await page.getByTestId("composer-review-cta").click();
    await page.waitForTimeout(500);
    const body = await page.locator("body").innerText();
    check(
      "city-district review shows İstanbul / Kadıköy",
      /İstanbul\s*\/\s*Kadıköy/i.test(body),
    );
    check(
      "city-district review has no Şehir: Fark etmez",
      !/Şehir\s*Fark etmez/i.test(body) && !/Şehir:.*Fark etmez/i.test(body),
    );
    check(
      "city-district no unresolved şehir warning",
      !/Hâlâ emin olmadığımız noktalar[\s\S]*Şehir/i.test(body),
    );
    await shot(page, "desktop-baby-review-city-district.png");
  } else {
    check("city-district review CTA", false, "CTA missing");
  }
}

async function runDemoBabyNationwideReview(page: Page) {
  await openFreshDemo(page);
  await fillComposer(page, "#preview-composer", "bebek arabası arıyorum");
  await waitUnderstanding(page);
  await page.getByRole("button", { name: /Teklifleri görmek istiyorum/i }).first().click();
  await page.waitForTimeout(350);
  const nat = page.getByRole("button", { name: /Türkiye geneli/i });
  if ((await nat.count()) === 0) {
    await page.getByRole("tab", { name: /Konum/i }).click().catch(() => undefined);
  }
  await page.getByRole("button", { name: /Türkiye geneli/i }).first().click();
  await page.waitForTimeout(350);
  for (let i = 0; i < 6; i++) {
    if ((await page.getByTestId("composer-review-cta").count()) > 0) break;
    const soft = page.getByRole("button", {
      name: /Esnek|1 hafta|Henüz|Fark etmez|Sıfır|Öneriye/i,
    });
    if ((await soft.count()) > 0) {
      await soft.first().click();
      await page.waitForTimeout(300);
    } else break;
  }
  await page.getByTestId("composer-review-cta").click();
  await page.waitForTimeout(500);
  const body = await page.locator("body").innerText();
  check("nationwide review label", /Türkiye geneli/i.test(body));
  check(
    "nationwide no Şehir Fark etmez fact",
    !/Şehir[\s:]*Fark etmez/i.test(body),
  );
  check(
    "nationwide no unresolved şehir",
    !/Hâlâ emin olmadığımız noktalar[\s\S]*Şehir/i.test(body),
  );
  check(
    "review not showing 'soru bu ekranda'",
    !/soru bu ekranda/i.test(body),
  );
  await shot(page, "desktop-baby-review-nationwide.png");
  await assertNoAppIssueBadge(page, "nationwide-review");
}

async function runRealEstate(page: Page) {
  await openFreshDemo(page);
  await fillComposer(page, "#preview-composer", "2+1 satılık ev arıyorum");
  await waitUnderstanding(page, undefined, 40000);
  check(
    "RE: understanding visible",
    (await page.getByText(/Emlak/i).count()) > 0,
  );
  // Wait for location picker OR budget options
  await page
    .locator("#composer-il, [data-control-type='money_range'], [data-control-type='location_picker']")
    .first()
    .waitFor({ state: "visible", timeout: 20000 });
  check(
    "RE: location or budget control",
    (await page.locator("#composer-il, [data-control-type='money_range']").count()) > 0,
  );
  check(
    "RE start: review CTA hidden",
    (await page.getByTestId("composer-review-cta").count()) === 0,
  );
  await shot(page, "desktop-real-estate-questions.png");

  // Ensure location picker
  if ((await page.locator("#composer-il").count()) === 0) {
    await page.getByRole("tab", { name: /Konum/i }).click().catch(() => undefined);
  }
  await page.locator("#composer-il").selectOption({ label: "İstanbul" });
  await page.locator("#composer-ilce").selectOption({ label: "Kadıköy" });
  await page.waitForTimeout(400);
  await shot(page, "desktop-real-estate-city-district.png");

  // Budget soft
  if ((await page.getByRole("button", { name: /Teklifleri görmek/i }).count()) > 0) {
    await page.getByRole("button", { name: /Teklifleri görmek/i }).first().click();
  } else {
    await page.getByRole("tab", { name: /Bütçe|Aylık/i }).click().catch(() => undefined);
    await page.getByRole("button", { name: /Teklifleri görmek/i }).first().click().catch(() => undefined);
  }
  await page.waitForTimeout(400);
}

async function runRealTalep(page: Page) {
  await page.goto(`${BASE}/talep`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  // Prefer main composer textarea
  const input = page.locator("textarea").first();
  await input.waitFor({ state: "visible", timeout: 30000 });
  await input.fill("bebek arabası arıyorum");
  await page.waitForTimeout(1200);
  await page
    .getByText(/Bebek arabası|Bütçeniz nedir/i)
    .first()
    .waitFor({ state: "visible", timeout: 35000 })
    .catch(() => undefined);

  const hasBudget =
    (await page.getByText(/Bütçeniz nedir/i).count()) > 0 ||
    (await page.getByRole("button", { name: /Teklifleri görmek/i }).count()) > 0;
  check("real /talep: budget visible", hasBudget);
  check(
    "real /talep start: no review publish yet",
    (await page.getByRole("button", { name: /Talebi yayınla/i }).count()) === 0 ||
      !(await page.getByRole("button", { name: /Talebi yayınla/i }).isEnabled().catch(() => false)),
  );
  await shot(page, "desktop-real-talep-questions.png");

  if (hasBudget) {
    await page.getByRole("button", { name: /Teklifleri görmek istiyorum/i }).first().click().catch(() => undefined);
    await page.waitForTimeout(400);
    const nat = page.getByRole("button", { name: /Türkiye geneli/i });
    if ((await nat.count()) > 0) await nat.first().click();
    await page.waitForTimeout(350);
    for (let i = 0; i < 6; i++) {
      const review = page.getByRole("button", { name: /Talebi gözden geçir/i });
      if ((await review.count()) > 0) {
        await review.click();
        break;
      }
      const soft = page.getByRole("button", { name: /Esnek|1 hafta|Sıfır|Fark etmez/i });
      if ((await soft.count()) > 0) await soft.first().click();
      else break;
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(500);
    await shot(page, "desktop-real-talep-review.png");
    const body = await page.locator("body").innerText();
    check(
      "real /talep review: single publish CTA path",
      /Talebi yayınla|Yayınlamadan önce/i.test(body),
    );
    // Do NOT click publish
  }
}

async function runMobile(page: Page) {
  await openFreshDemo(page);
  await fillComposer(page, "#preview-composer", "bebek arabası arıyorum");
  await waitUnderstanding(page);
  await shot(page, "mobile-baby-budget.png");
  await assertNoAppIssueBadge(page, "mobile-budget");

  await page.getByRole("button", { name: /Teklifleri görmek istiyorum/i }).first().click();
  await page.waitForTimeout(350);
  await shot(page, "mobile-baby-location.png");

  await page.getByRole("button", { name: /Türkiye geneli/i }).first().click().catch(() => undefined);
  await page.waitForTimeout(300);
  for (let i = 0; i < 5; i++) {
    if ((await page.getByTestId("composer-review-cta").count()) > 0) break;
    const soft = page.getByRole("button", { name: /Esnek|1 hafta|Sıfır/i });
    if ((await soft.count()) > 0) await soft.first().click();
    else break;
    await page.waitForTimeout(250);
  }
  if ((await page.getByTestId("composer-review-cta").count()) > 0) {
    await page.getByTestId("composer-review-cta").click();
    await page.waitForTimeout(400);
  }
  await shot(page, "mobile-baby-review.png");
}

async function main() {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });

  // Session health
  {
    const probe = await browser.newContext();
    const p = await probe.newPage();
    const session = await p.request.get(`${BASE}/api/auth/session`);
    check("auth session HTTP not 500", session.status() !== 500, `status=${session.status()}`);
    await probe.close();
  }

  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errs: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errs.push(m.text());
    });
    await runDemoBabyNationwide(page);
    (globalThis as { __composerErrs?: string[] }).__composerErrs = errs;
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await runDemoBabyNationwideReview(page);
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await runRealEstate(page);
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await runRealTalep(page);
    await ctx.close();
  }

  {
    const mobile = await browser.newContext({ ...devices["iPhone 12"] });
    const m = await mobile.newPage();
    await runMobile(m);
    await mobile.close();
  }

  const appErrors = ((globalThis as { __composerErrs?: string[] }).__composerErrs ?? []).filter(
    (e) => !/favicon/i.test(e) && !/Download the React DevTools/i.test(e),
  );
  check(
    "no next-auth CLIENT_FETCH_ERROR",
    !appErrors.some((e) => /CLIENT_FETCH_ERROR|next-auth/i.test(e)),
    appErrors.filter((e) => /next-auth|CLIENT_FETCH/i.test(e)).join(" | ") || undefined,
  );

  writeFileSync(
    join(OUT, "acceptance-results.json"),
    JSON.stringify({ results, consoleErrors: appErrors.slice(0, 20) }, null, 2),
  );

  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed → ${OUT}`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
