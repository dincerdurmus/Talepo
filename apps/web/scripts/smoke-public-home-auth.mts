/**
 * Authenticated public homepage smoke (optional storage state).
 *
 * Usage:
 *   PUBLIC_HOME_STORAGE_STATE=/path/to/storage.json npx tsx scripts/smoke-public-home-auth.mts
 *
 * Or headed manual login (90s window):
 *   PUBLIC_HOME_AUTH_HEADED=1 npx tsx scripts/smoke-public-home-auth.mts
 */
import { mkdirSync, existsSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const OUT = join(tmpdir(), "talepo-public-home-qa-final");
const BASE = process.env.PUBLIC_HOME_URL ?? "http://localhost:3000";
const STORAGE =
  process.env.PUBLIC_HOME_STORAGE_STATE ??
  join(homedir(), ".talepo", "public-home-storage.json");
const HEADED = process.env.PUBLIC_HOME_AUTH_HEADED === "1";

async function main() {
  mkdirSync(OUT, { recursive: true });

  const { chromium } = await import("playwright");
  const headed = HEADED || !existsSync(STORAGE);
  const browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1024 },
    locale: "tr-TR",
    ...(existsSync(STORAGE) ? { storageState: STORAGE } : {}),
  });
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  const checks: { name: string; ok: boolean; detail?: string }[] = [];
  const check = (name: string, ok: boolean, detail?: string) => {
    checks.push({ name, ok, detail });
    console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? `: ${detail}` : ""}`);
  };

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

  let authed = await page.getByRole("button", { name: /Hesap menüsü/i }).isVisible().catch(() => false);
  if (!authed && headed && !existsSync(STORAGE)) {
    console.log("\nNo storage state — open /giris and sign in (90s)…");
    await page.goto(`${BASE}/giris`, { waitUntil: "networkidle" });
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      await page.waitForTimeout(2000);
      await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      authed = await page.getByRole("button", { name: /Hesap menüsü/i }).isVisible().catch(() => false);
      if (authed) break;
    }
  }

  check("authenticated session", authed, authed ? undefined : `Set PUBLIC_HOME_STORAGE_STATE or PUBLIC_HOME_AUTH_HEADED=1`);
  if (!authed) {
    await browser.close();
    process.exit(1);
  }

  check("no login CTA", !(await page.getByRole("link", { name: /^Giriş yap$/i }).isVisible().catch(() => false)));
  check("no register CTA", !(await page.getByRole("link", { name: /^Kayıt ol$/i }).isVisible().catch(() => false)));
  check("talep CTA visible", await page.getByRole("link", { name: /Talep oluştur/i }).isVisible());

  const headerText = await page.locator("header").innerText();
  check("email not in header chrome", !/\S+@\S+\.\S+/.test(headerText));

  const accountBtn = page.getByRole("button", { name: /Hesap menüsü/i });
  await accountBtn.hover();
  check("menu opens on hover", await page.getByRole("menu").isVisible());

  await page.keyboard.press("Escape");
  await accountBtn.focus();
  check("menu opens on focus", await page.getByRole("menu").isVisible());

  const menuBox = await page.getByRole("menu").boundingBox();
  const vp = page.viewportSize();
  check(
    "menu in viewport",
    Boolean(menuBox && vp && menuBox.x >= 0 && menuBox.x + menuBox.width <= vp.width),
  );

  check("panel link present", await page.getByRole("menuitem", { name: /Sayfam/i }).isVisible());
  check("profile link present", await page.getByRole("menuitem", { name: /Profilim/i }).isVisible());
  check("logout present", await page.getByRole("menuitem", { name: /Çıkış yap/i }).isVisible());

  const panelHref = await page.getByRole("menuitem", { name: /Sayfam/i }).getAttribute("href");
  check("panel href /panel", panelHref === "/panel");

  const profHref = await page.getByRole("menuitem", { name: /Profilim/i }).getAttribute("href");
  check("profile href /panel/profil", profHref === "/panel/profil");

  await page.screenshot({ path: join(OUT, "authenticated-account-menu.png") });

  const textarea = page.locator('textarea[name="query"]');
  await textarea.fill("2+1 kiralık daire, Bağcılar");
  await Promise.all([
    page.waitForURL(/\/talep\?query=/),
    page.getByRole("button", { name: /Devam/i }).click(),
  ]);
  check("composer handoff authed", page.url().includes("/talep?query="));

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.reload({ waitUntil: "networkidle" });
  check("header after refresh", await accountBtn.isVisible());

  await page.screenshot({ path: join(OUT, "authenticated-desktop-1440.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.screenshot({ path: join(OUT, "authenticated-mobile-390.png"), fullPage: true });

  check("no hydration console errors", consoleErrors.filter((e) => /hydration|did not match/i.test(e)).length === 0);

  if (headed && !existsSync(STORAGE)) {
    mkdirSync(join(homedir(), ".talepo"), { recursive: true });
    await context.storageState({ path: STORAGE });
    console.log(`\nSaved storage state: ${STORAGE}`);
  }

  const failed = checks.filter((c) => !c.ok);
  await browser.close();
  console.log(`\nScreenshots: ${OUT}`);
  console.log(`Checks: ${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
