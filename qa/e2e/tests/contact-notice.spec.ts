/**
 * D-0031 — TALEPTE İLETİŞİM BİLGİSİ: TARAYICIDA İKİ DAL.
 *
 * NEDEN TARAYICIDA. Sunucu kapısı `verify-request-contact-notice-v1` ile
 * zaten yeşil; ama bir doğrulayıcının yeşili, kartın EKRANDA çıktığını ve
 * düğmelerin gerçekten çalıştığını kanıtlamaz. Kart hiç render edilmese de
 * o kapı yeşil kalırdı.
 *
 * ÖLÇÜLEN:
 *   1. Telefon yazınca uyarı kartı görünür ve yayın yolu KAPANMAZ.
 *   2. "Kaldır" metinden numarayı çıkarır, geri kalanı korur, kart kapanır.
 *   3. "Kalsın" metni olduğu gibi bırakır ve kart kapanır.
 *   4. Temiz metinde kart hiç çıkmaz.
 */
import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const REPORT_DIR = resolve(__dirname, "../../../reports/e2e-a-z-2026-09-23");
const SHOT_DIR = resolve(REPORT_DIR, "ekran");
const PHONE_TEXT =
  "Ofis sandalyesi arıyorum İstanbul Kadıköy bütçem 5000 TL beni 0532 111 22 33 numarasından arayın";

const findings: Array<{ step: string; outcome: string; detail: string }> = [];
function record(step: string, outcome: string, detail: string): void {
  findings.push({ step, outcome, detail });
}

/**
 * Sessiz besteciden form yoluna geç.
 *
 * Uyarı kartı BİLEREK bu kapının ARDINDADIR: `/talep` girişi kurucu kararıyla
 * sessiz bir yazma anıdır ("Daha fazla bilgi ekle" kapısı) ve yayın yolu da
 * aynı kapının ardındadır. Yani kullanıcı uyarıyı görmeden yayınlayamaz;
 * kartı kapının önüne almak, girişin sessizliğini bozardı.
 */
async function openComposer(page: Page, text: string): Promise<void> {
  await page.goto("/talep", { waitUntil: "domcontentloaded" });
  const textarea = page.locator("textarea").first();
  await textarea.waitFor({ state: "visible" });
  await textarea.click();
  await textarea.pressSequentially(text, { delay: 3 });
  const intro = page.locator('[data-testid="composer-intro-continue"]');
  await expect(intro).toBeEnabled({ timeout: 15_000 });
  await page.waitForTimeout(2500);
  await intro.click();
  const formButton = page.getByRole("button", { name: /Formla devam/i });
  await formButton.waitFor({ state: "visible", timeout: 15_000 });
  await formButton.click();
  await page.waitForTimeout(1500);
}

test.describe("D-0031 iletişim bilgisi uyarısı", () => {
  test("telefon yazınca uyarı çıkar, yayın yolu kapanmaz", async ({ page }) => {
    await openComposer(page, PHONE_TEXT);
    const notice = page.getByTestId("composer-contact-notice");
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("anonim olmaktan");
    const outOfScope = page.getByTestId("composer-out-of-scope");
    const blocked = await outOfScope.count();
    record("1. uyarı görünür", "PASS", "kart ekranda");
    record(
      "1b. yayın yolu kapanmadı",
      blocked === 0 ? "PASS" : "FAIL",
      `kapsam dışı kartı=${blocked}`,
    );
    expect(blocked).toBe(0);
    mkdirSync(SHOT_DIR, { recursive: true });
    await page.screenshot({ path: resolve(SHOT_DIR, "d0031__uyari-karti.png"), fullPage: false });
  });

  test("Kaldır dalı: numara çıkar, cümle kalır", async ({ page }) => {
    await openComposer(page, PHONE_TEXT);
    await page.getByTestId("composer-contact-remove").click();
    await page.waitForTimeout(1200);
    const value = await page.locator("textarea").first().inputValue();
    const hasPhone = /0\s?5\d{2}\s?\d{3}\s?\d{2}\s?\d{2}/.test(value);
    const keptRest = value.includes("Ofis sandalyesi arıyorum");
    record(
      "2. Kaldır dalı",
      !hasPhone && keptRest ? "PASS" : "FAIL",
      `numara=${hasPhone} kalan="${value.slice(0, 60)}"`,
    );
    expect(hasPhone).toBe(false);
    expect(keptRest).toBe(true);
    await expect(page.getByTestId("composer-contact-notice")).toHaveCount(0);
    await page.screenshot({ path: resolve(SHOT_DIR, "d0031__kaldir-sonrasi.png") });
  });

  test("Kalsın dalı: metin olduğu gibi kalır", async ({ page }) => {
    await openComposer(page, PHONE_TEXT);
    await page.getByTestId("composer-contact-keep").click();
    await page.waitForTimeout(800);
    const value = await page.locator("textarea").first().inputValue();
    const hasPhone = /0\s?5\d{2}\s?\d{3}\s?\d{2}\s?\d{2}/.test(value);
    record("3. Kalsın dalı", hasPhone ? "PASS" : "FAIL", `numara korundu=${hasPhone}`);
    expect(hasPhone).toBe(true);
    await expect(page.getByTestId("composer-contact-notice")).toHaveCount(0);
    await page.screenshot({ path: resolve(SHOT_DIR, "d0031__kalsin-sonrasi.png") });
  });

  test("temiz metinde kart çıkmaz", async ({ page }) => {
    await openComposer(page, "Ofis sandalyesi arıyorum İstanbul Kadıköy bütçem 5000 TL");
    const count = await page.getByTestId("composer-contact-notice").count();
    record("4. temiz metin", count === 0 ? "PASS" : "FAIL", `kart=${count}`);
    expect(count).toBe(0);
  });

  test.afterAll(() => {
    mkdirSync(REPORT_DIR, { recursive: true });
    writeFileSync(
      resolve(REPORT_DIR, "d0031-iletisim-uyarisi.jsonl"),
      findings.map((f) => JSON.stringify(f)).join("\n") + "\n",
      "utf8",
    );
  });
});
