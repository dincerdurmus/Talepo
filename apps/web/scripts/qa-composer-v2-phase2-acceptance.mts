/**
 * Phase 2 acceptance QA screenshots (gitignored under .qa-composer-v2-phase2/).
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
    .locator("text=Kontrol ediliyor")
    .waitFor({ state: "hidden", timeout: 15000 })
    .catch(() => undefined);
  await page.waitForTimeout(400);
}

async function shot(page: import("playwright").Page, name: string) {
  await page.screenshot({ path: join(OUT, name), fullPage: true });
  console.log("shot", name);
}

async function fillComposer(
  page: import("playwright").Page,
  text: string,
  selector = "#preview-composer",
) {
  const el = page.locator(selector);
  if ((await el.count()) === 0) {
    await page.locator("textarea").first().fill(text);
  } else {
    await el.fill(text);
  }
  await waitUnderstanding(page);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const desktop = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await desktop.newPage();

  const scenarios: Array<{ id: string; text: string; note: string }> = [
    { id: "01-tv-q1", text: "Arçelik 55 inç televizyon arıyorum", note: "first group" },
    {
      id: "02-tv-a55",
      text: "Arçelik A55 D 55 inç televizyon arıyorum",
      note: "real model",
    },
    {
      id: "03-brosur",
      text: "Matbaa için 5000 broşür baskısı istiyorum",
      note: "print qty",
    },
    {
      id: "04-heidelberg",
      text: "Heidelberg SM 74 için nemlendirme pompası arıyorum",
      note: "part",
    },
    {
      id: "05-re-loc",
      text: "Ankara Çankaya’da kiralık 3+1 daire arıyorum",
      note: "re with city",
    },
    {
      id: "06-re-noloc",
      text: "Kiralık 3+1 daire arıyorum",
      note: "re needs city",
    },
    {
      id: "07-clio",
      text: "2019 Renault Clio 1.5 dCi otomatik arıyorum",
      note: "auto",
    },
    {
      id: "08-bosch",
      text: "Bosch Serie 6 çamaşır makinesi arıyorum",
      note: "appliance",
    },
    {
      id: "09-logo",
      text: "Logo tasarımı yaptırmak istiyorum",
      note: "remote service",
    },
  ];

  for (const s of scenarios) {
    await page.goto(`${BASE}/onizleme/talep-composer-v2`, {
      waitUntil: "networkidle",
    });
    await fillComposer(page, s.text);
    await shot(page, `desktop-${s.id}.png`);
  }

  // Answer budget+city path toward review on TV
  await page.goto(`${BASE}/onizleme/talep-composer-v2`, {
    waitUntil: "networkidle",
  });
  await fillComposer(page, "Arçelik 55 inç televizyon arıyorum");
  // Soft-answer budget if escape visible
  const openOffers = page.getByRole("button", {
    name: /Teklifleri görmek istiyorum/i,
  });
  if ((await openOffers.count()) > 0) {
    await openOffers.first().click();
    await page.waitForTimeout(500);
  }
  await shot(page, "desktop-10-tv-after-budget.png");

  // Real /talep — single publish CTA in review
  await page.goto(`${BASE}/talep`, { waitUntil: "networkidle" });
  const talepBox = page.locator("#talep-composer");
  if ((await talepBox.count()) > 0) {
    await fillComposer(page, "Arçelik 55 inç televizyon arıyorum", "#talep-composer");
    await shot(page, "desktop-11-talep-clarify.png");
    const publishButtons = page.getByRole("button", { name: /Talebi yayınla/i });
    const countClarify = await publishButtons.count();
    console.log("publish_cta_clarify_count", countClarify);
    const goReview = page.getByRole("button", { name: /Talebi gözden geçir/i });
    if ((await goReview.count()) > 0) {
      await goReview.first().click();
      await page.waitForTimeout(600);
    }
    await shot(page, "desktop-12-talep-review.png");
    console.log(
      "publish_cta_review_count",
      await page.getByRole("button", { name: /Talebi yayınla/i }).count(),
    );
  } else {
    await shot(page, "desktop-11-talep-auth-or-empty.png");
  }

  // Demo must say yayınlanmaz
  await page.goto(`${BASE}/onizleme/talep-composer-v2`, {
    waitUntil: "networkidle",
  });
  await shot(page, "desktop-13-demo-banner.png");

  await desktop.close();

  const mobile = await browser.newContext({ ...devices["iPhone 12"] });
  const mpage = await mobile.newPage();
  await mpage.goto(`${BASE}/onizleme/talep-composer-v2`, {
    waitUntil: "networkidle",
  });
  await fillComposer(mpage, "Arçelik 55 inç televizyon arıyorum");
  await shot(mpage, "mobile-01-tv.png");
  await fillComposer(mpage, "Kiralık 3+1 daire arıyorum");
  await shot(mpage, "mobile-02-re-noloc.png");
  await fillComposer(mpage, "Matbaa için 5000 broşür baskısı istiyorum");
  await shot(mpage, "mobile-03-brosur.png");
  await mpage.goto(`${BASE}/talep`, { waitUntil: "networkidle" });
  if ((await mpage.locator("#talep-composer").count()) > 0) {
    await fillComposer(
      mpage,
      "Ankara Çankaya’da kiralık 3+1 daire arıyorum",
      "#talep-composer",
    );
    await shot(mpage, "mobile-04-talep-re.png");
  }
  await mobile.close();
  await browser.close();
  console.log("QA done →", OUT);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
