/**
 * FAZ 2 — ALICI GOZUYLE TARAYICI TESTI (2026-09-23)
 *
 * Olculen: ekranda sorulan sorular Faz 1 motoruyla ayni mi, kapsam disi
 * talepte uyari gorunuyor mu ve yayin yolu kapali mi, kategori disi mesru
 * talep ilerleyebiliyor mu, konsol hatasi / 4xx-5xx / takilma / tasma.
 *
 * ONEMLI: bu kosuda kabul veritabani ULASILAMAZ durumdadir. DB'ye bagli
 * uclar (matching/estimate, price-intelligence) 500 doner; bunlar BLOCKED
 * olarak ayri sayilir, "yeni bulgu" diye raporlanmaz.
 */
import { test, expect, type Page, type ConsoleMessage } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const REPORT_DIR = resolve(__dirname, "../../../reports/e2e-a-z-2026-09-23");
const SHOT_DIR = resolve(REPORT_DIR, "ekran");
const NET_LOG = resolve(REPORT_DIR, "ag-hatalari.jsonl");
const UI_LOG = resolve(REPORT_DIR, "faz2-ui.jsonl");

type Case = {
  caseId: string;
  bucketId: string;
  text: string;
  expectedScope: string;
  expectedCategory: string | null;
  expectedOutOfScope: boolean;
  expectedNotice: string | null;
  expectedQuestionKeys: string[];
  expectedQuestionLabels: string[];
  expectedQuestionPrompts: string[];
  expectedCanReview: boolean;
};

const CASES: Case[] = JSON.parse(
  readFileSync(resolve(REPORT_DIR, "faz2-secim.json"), "utf8"),
);

/** DB kapali oldugu icin beklenen 5xx uclari — yeni bulgu degildir. */
const DB_BLOCKED_ENDPOINTS = [
  "/api/matching/estimate",
  "/api/price-intelligence/preview",
];

mkdirSync(SHOT_DIR, { recursive: true });
if (!existsSync(NET_LOG)) writeFileSync(NET_LOG, "", "utf8");
if (!existsSync(UI_LOG)) writeFileSync(UI_LOG, "", "utf8");

function appendJsonl(path: string, row: unknown) {
  writeFileSync(path, JSON.stringify(row) + "\n", { flag: "a", encoding: "utf8" });
}

type Probe = {
  consoleErrors: string[];
  netFailures: Array<{ status: number; url: string; dbBlocked: boolean }>;
};

function attachProbes(page: Page, caseId: string, project: string): Probe {
  const probe: Probe = { consoleErrors: [], netFailures: [] };
  page.on("console", (m: ConsoleMessage) => {
    if (m.type() !== "error") return;
    probe.consoleErrors.push(m.text().slice(0, 200));
  });
  page.on("response", (r) => {
    if (r.status() < 400) return;
    const url = r.url().replace(/^https?:\/\/[^/]+/, "");
    const dbBlocked = DB_BLOCKED_ENDPOINTS.some((e) => url.startsWith(e));
    probe.netFailures.push({ status: r.status(), url: url.slice(0, 200), dbBlocked });
    appendJsonl(NET_LOG, {
      caseId,
      project,
      status: r.status(),
      url: url.slice(0, 200),
      dbBlocked,
    });
  });
  return probe;
}

/** Sessiz besteciden form yoluna gec: yaziyi KLAVYEYLE yaz. */
async function typeRequest(page: Page, text: string) {
  await page.goto("/talep", { waitUntil: "domcontentloaded" });
  const textarea = page.locator("textarea").first();
  await textarea.waitFor({ state: "visible" });
  await textarea.click();
  await textarea.pressSequentially(text, { delay: 4 });
  const intro = page.locator('[data-testid="composer-intro-continue"]');
  await expect(intro).toBeEnabled({ timeout: 15_000 });
  /**
   * ANLAMA OTURSUN DIYE BEKLE. Buton 5 harfte acilir ama anlama katmani
   * yaziyi geriktirmeli (debounce) okur. Beklemeden tiklamak, motorun
   * HENUZ VERMEDIGI karari "UI vermedi" diye raporlar — olculdu: ilac
   * vakasinda yanlis P0 uretiyordu.
   */
  await page.waitForTimeout(2500);
  await intro.click();
  const formButton = page.getByRole("button", { name: /Formla devam/i });
  await formButton.waitFor({ state: "visible", timeout: 15_000 });
  await formButton.click();
  await page.waitForTimeout(1500);
}

/** Ekranda gorunen soru basliklari (ozet etiketleri). */
async function visibleQuestionLabels(page: Page): Promise<string[]> {
  const block = page.locator('[data-testid="composer-questions"]');
  if ((await block.count()) === 0) return [];
  const text = await block.first().innerText();
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

test.describe("FAZ 2 — alici gozuyle talep olusturma", () => {
  for (const c of CASES) {
    test(`${c.caseId}`, async ({ page }, testInfo) => {
      const probe = attachProbes(page, c.caseId, testInfo.project.name);
      const started = Date.now();
      await typeRequest(page, c.text);

      // Soru blogu ya da kapsam karti gorunene kadar bekle (3 sn siniri olculur).
      const settleStart = Date.now();
      await page
        .locator(
          '[data-testid="composer-questions"], [data-testid="composer-out-of-scope"], [data-testid="composer-review-cta"], [data-testid="composer-continue-hint"]',
        )
        .first()
        .waitFor({ state: "visible", timeout: 30_000 })
        .catch(() => undefined);
      const settleMs = Date.now() - settleStart;

      const outOfScope = page.locator('[data-testid="composer-out-of-scope"]');
      const reviewCta = page.locator('[data-testid="composer-review-cta"]');
      const continueHint = page.locator('[data-testid="composer-continue-hint"]');

      const outOfScopeVisible = (await outOfScope.count()) > 0 && (await outOfScope.first().isVisible());
      const noticeText = outOfScopeVisible
        ? (await outOfScope.first().innerText()).replace(/\s+/g, " ").trim()
        : null;
      const reviewVisible = (await reviewCta.count()) > 0 && (await reviewCta.first().isVisible());
      const continueVisible =
        (await continueHint.count()) > 0 && (await continueHint.first().isVisible());
      const screenLabels = await visibleQuestionLabels(page);

      // Mobilde yatay tasma: govde sayfanin genisligini asmamali.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );

      const shot = resolve(
        SHOT_DIR,
        `${testInfo.project.name}__${c.caseId}__intake.png`,
      );
      await page.screenshot({ path: shot, fullPage: true });

      const row = {
        caseId: c.caseId,
        bucketId: c.bucketId,
        project: testInfo.project.name,
        text: c.text,
        expected: {
          outOfScope: c.expectedOutOfScope,
          canReview: c.expectedCanReview,
          questionLabels: c.expectedQuestionLabels,
          notice: c.expectedNotice ? c.expectedNotice.slice(0, 60) : null,
        },
        observed: {
          outOfScopeVisible,
          notice: noticeText ? noticeText.slice(0, 160) : null,
          reviewVisible,
          continueVisible,
          screenLabels,
          settleMs,
          totalMs: Date.now() - started,
          horizontalOverflowPx: overflow,
          consoleErrors: probe.consoleErrors,
          netFailures: probe.netFailures,
        },
        screenshot: shot,
      };
      appendJsonl(UI_LOG, row);

      // --- ISPATLAR ----------------------------------------------------
      // 1. Kapsam kapisi: kapsam disi talepte uyari gorunur, yayin yolu kapali.
      if (c.expectedOutOfScope) {
        expect(outOfScopeVisible, "kapsam disi uyarisi gorunmeli").toBe(true);
        expect(reviewVisible, "kapsam disi talepte yayin butonu olmamali").toBe(false);
      } else {
        expect(outOfScopeVisible, "kapsam ici talepte uyari cikmamali").toBe(false);
      }

      /**
       * 2. UI/MOTOR TUTARLILIGI.
       *
       * Kapsam disi talepte bu olcum YAPILMAZ: zamanlayici kapsam kararini
       * okumadigi icin yine kuresel cekirdek sorularini uretir, sayfa ise
       * kapsam kartini gosterip soru yolunu hic acmaz. Dogru davranis
       * sayfaninkidir; bunu tutarsizlik saymak yanlis bulgu uretir.
       * (Zamanlayicinin kapsami okumamasi ayrica P3 olarak raporlanir.)
       *
       * Ekranda gorunen metin OZET ETIKET degil SORUNUN KENDISIDIR; bu
       * yuzden ikisi de kabul edilir.
       */
      if (!c.expectedOutOfScope) {
        const haystack = screenLabels.map((l) => l.toLocaleLowerCase("tr"));
        c.expectedQuestionLabels.forEach((label, i) => {
          const prompt = c.expectedQuestionPrompts[i] ?? "";
          const found =
            haystack.includes(label.toLocaleLowerCase("tr")) ||
            (prompt
              ? haystack.some((l) => l === prompt.toLocaleLowerCase("tr"))
              : false);
          expect(found, `motor "${label}" / "${prompt}" soruyor ama ekranda yok`).toBe(
            true,
          );
        });
      }

      // 3. Yatay tasma yok (ozellikle 390px).
      expect(overflow, "sayfa yatay tasiyor").toBeLessThanOrEqual(1);

      // 4. DB disi konsol/ag hatasi yok.
      const realNetFailures = probe.netFailures.filter((f) => !f.dbBlocked);
      expect(realNetFailures, "DB disi 4xx/5xx istek").toEqual([]);
    });
  }
});
