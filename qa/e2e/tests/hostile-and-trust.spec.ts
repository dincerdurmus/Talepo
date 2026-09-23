/**
 * FAZ 2 (kotu niyetli girdi) + FAZ 4 (kenar ve guven) — 2026-09-23
 *
 * Kabul veritabani ULASILAMAZ oldugu icin oturum acan dallar (baskasinin
 * teklif detayina URL ile girme, iki sekmede yaris, kota) BU DOSYADA
 * KOSULMAZ ve raporda BLOCKED olarak sayilir. Burada yalnizca oturumsuz
 * olculebilen guven davranislari olculur.
 */
import { test, expect, type Page } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const REPORT_DIR = resolve(__dirname, "../../../reports/e2e-a-z-2026-09-23");
const SHOT_DIR = resolve(REPORT_DIR, "ekran");
const LOG = resolve(REPORT_DIR, "faz2-faz4-kenar.jsonl");

mkdirSync(SHOT_DIR, { recursive: true });

function log(row: unknown) {
  writeFileSync(LOG, JSON.stringify(row) + "\n", { flag: "a", encoding: "utf8" });
}

async function openComposer(page: Page, text: string) {
  await page.goto("/talep", { waitUntil: "domcontentloaded" });
  const ta = page.locator("textarea").first();
  await ta.waitFor({ state: "visible" });
  await ta.click();
  await ta.fill(text);
  await page.waitForTimeout(2500);
}

async function enterForm(page: Page) {
  const intro = page.locator('[data-testid="composer-intro-continue"]');
  if (!(await intro.isEnabled())) return false;
  await intro.click();
  const formButton = page.getByRole("button", { name: /Formla devam/i });
  await formButton.waitFor({ state: "visible", timeout: 15_000 });
  await formButton.click();
  await page.waitForTimeout(1500);
  return true;
}

test.describe("FAZ 2 — kotu niyetli ve zorlayici girdi", () => {
  test("bos gonderim ilerlemeyi acmaz", async ({ page }, info) => {
    await page.goto("/talep", { waitUntil: "domcontentloaded" });
    const intro = page.locator('[data-testid="composer-intro-continue"]');
    await intro.waitFor({ state: "visible" });
    const enabledEmpty = await intro.isEnabled();
    log({ senaryo: "bos-gonderim", project: info.project.name, enabledEmpty });
    expect(enabledEmpty, "bos metinle ilerleme butonu acik olmamali").toBe(false);
  });

  test("script iceren metin calistirilmaz", async ({ page }, info) => {
    let dialogSeen = false;
    page.on("dialog", async (d) => {
      dialogSeen = true;
      await d.dismiss();
    });
    const payload = '<script>window.__TALEPO_XSS__=1;alert("xss")</script> buzdolabi ariyorum';
    await openComposer(page, payload);
    await enterForm(page);
    const flagged = await page.evaluate(
      () => (window as unknown as { __TALEPO_XSS__?: number }).__TALEPO_XSS__ ?? null,
    );
    const shot = resolve(SHOT_DIR, `${info.project.name}__hostile-script.png`);
    await page.screenshot({ path: shot, fullPage: true });
    log({ senaryo: "script-enjeksiyonu", project: info.project.name, dialogSeen, flagged, shot });
    expect(dialogSeen, "script diyalog acti").toBe(false);
    expect(flagged, "script calisti").toBeNull();
  });

  test("2000+ karakter metin uygulamayi kirmaz", async ({ page }, info) => {
    const consoleErrors: string[] = [];
    page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text().slice(0, 160)));
    const long =
      "Ofis icin ergonomik calisma sandalyesi ariyorum, file sirtli olsun. ".repeat(35) +
      " Butcem 50.000 TL, Istanbul Sisli.";
    expect(long.length).toBeGreaterThan(2000);
    const started = Date.now();
    await openComposer(page, long);
    const entered = await enterForm(page);
    const elapsed = Date.now() - started;
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    const shot = resolve(SHOT_DIR, `${info.project.name}__hostile-uzun-metin.png`);
    await page.screenshot({ path: shot, fullPage: true });
    log({
      senaryo: "2000-karakter",
      project: info.project.name,
      length: long.length,
      entered,
      elapsedMs: elapsed,
      overflow,
      consoleErrors,
      shot,
    });
    expect(overflow, "uzun metin yatay tasma yapti").toBeLessThanOrEqual(1);
    expect(consoleErrors.filter((e) => !/status of 5\d\d/.test(e))).toEqual([]);
  });

  test("emoji iceren metin islenir", async ({ page }, info) => {
    await openComposer(page, "🔥 Acil 🚚 evden eve nakliyat ariyorum 📦 Bursa Nilufer");
    const entered = await enterForm(page);
    const shot = resolve(SHOT_DIR, `${info.project.name}__hostile-emoji.png`);
    await page.screenshot({ path: shot, fullPage: true });
    log({ senaryo: "emoji", project: info.project.name, entered, shot });
    expect(entered, "emoji iceren metinle ilerleme acilmadi").toBe(true);
  });

  test("talep metnindeki telefon/e-posta — filtre davranisi OLCULUR", async ({ page }, info) => {
    const phone = "0532 111 22 33";
    const mail = "alici@ornek.test";
    await openComposer(page, `Buzdolabi ariyorum, bana ${phone} numarasindan ya da ${mail} adresinden ulasin.`);
    await enterForm(page);
    const body = await page.locator("body").innerText();
    const phoneVisible = body.includes(phone);
    const mailVisible = body.includes(mail);
    const warningVisible = /iletisim|ileti[sş]im bilgisi|payla[sş]ma/i.test(body);
    const shot = resolve(SHOT_DIR, `${info.project.name}__hostile-iletisim.png`);
    await page.screenshot({ path: shot, fullPage: true });
    /**
     * OLCUM, IDDIA DEGIL. Talepte iletisim filtresi UYGULANMIYOR: filtre
     * (`lib/membership/contact-filter`) yalnizca teklif ve degerlendirme
     * yolunda cagriliyor. Bunun dogru olup olmadigi kurucu kararidir;
     * test yalnizca gozlemi kayda gecirir.
     */
    log({
      senaryo: "iletisim-bilgisi",
      project: info.project.name,
      phoneVisible,
      mailVisible,
      warningVisible,
      not: "talep yolunda contact-filter cagrilmiyor (yalniz offer/deal-review)",
      shot,
    });
    expect(typeof phoneVisible).toBe("boolean");
  });
});

test.describe("FAZ 4 — kenar ve guven (oturumsuz olculebilen)", () => {
  test("/admin MFA olmadan 404", async ({ page }, info) => {
    const res = await page.goto("/admin", { waitUntil: "domcontentloaded" });
    const status = res?.status() ?? 0;
    log({ senaryo: "admin-404", project: info.project.name, status, url: page.url() });
    expect(status, "/admin oturumsuz 404 donmeli").toBe(404);
  });

  for (const path of ["/panel/firsatlar", "/panel/talepler", "/panel/gelen-teklifler"]) {
    test(`cikis yapmisken korumali sayfa: ${path}`, async ({ page }, info) => {
      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1200);
      const status = res?.status() ?? 0;
      const finalUrl = page.url();
      const body = (await page.locator("body").innerText()).slice(0, 400);
      const asksLogin = /giri[sş]|oturum|hesab[ıi]n[ıi]za/i.test(body) || /\/giris/.test(finalUrl);
      const shot = resolve(
        SHOT_DIR,
        `${info.project.name}__guard${path.replace(/\//g, "_")}.png`,
      );
      await page.screenshot({ path: shot, fullPage: false });
      log({ senaryo: "korumali-sayfa", project: info.project.name, path, status, finalUrl, asksLogin, shot });
      expect(asksLogin, `${path} oturumsuz kullaniciya panel icerigi gostermemeli`).toBe(true);
    });
  }

  test("soru akisinin ortasinda sayfa yenileme — taslak korunuyor mu", async ({ page }, info) => {
    const text = "Samsung 55 inc 4K televizyon ariyorum, duvara montaj dahil olsun.";
    await openComposer(page, text);
    await enterForm(page);
    const beforeQuestions = (await page.locator('[data-testid="composer-questions"]').count()) > 0;
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    const ta = page.locator("textarea").first();
    const restored = (await ta.count()) ? await ta.inputValue() : "";
    const questionsAfter = (await page.locator('[data-testid="composer-questions"]').count()) > 0;
    const shot = resolve(SHOT_DIR, `${info.project.name}__yenileme-taslak.png`);
    await page.screenshot({ path: shot, fullPage: true });
    const preserved = restored.trim().length > 0;
    log({
      senaryo: "yenileme-taslak",
      project: info.project.name,
      beforeQuestions,
      restoredLength: restored.length,
      preserved,
      questionsAfter,
      shot,
    });
    // OLCUM: taslak korunuyor mu sorusuna cevap kayda gecer; urun karari
    // degistirilmeden once iddiaya cevrilmez.
    expect(typeof preserved).toBe("boolean");
  });
});
