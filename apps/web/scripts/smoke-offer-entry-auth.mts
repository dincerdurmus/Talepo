/**
 * Authenticated offer entry smoke — detail CTA → offer form (no submit).
 *
 * Usage:
 *   OFFER_ENTRY_REQUEST_ID=cmt0af3u3000a28uyrtnk8c2w npx tsx scripts/smoke-offer-entry-auth.mts
 *
 * Prefers Chrome CDP on 127.0.0.1:9222; falls back to storage state.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const OUT = join("C:", "Users", "HP", "AppData", "Local", "Temp", "talepo-offer-entry-404-fix");
const BASE = process.env.OFFER_ENTRY_URL ?? "http://localhost:3000";
const REQUEST_ID =
  process.env.OFFER_ENTRY_REQUEST_ID ?? "cmt0af3u3000a28uyrtnk8c2w";
const CDP = process.env.OFFER_ENTRY_CDP ?? "http://127.0.0.1:9222";
const STORAGE =
  process.env.OFFER_ENTRY_STORAGE_STATE ??
  join(homedir(), ".talepo", "offer-entry-storage.json");

type NetworkRow = {
  url: string;
  status: number;
  resourceType: string;
};

async function main() {
  mkdirSync(OUT, { recursive: true });

  const { chromium } = await import("playwright");
  const network: NetworkRow[] = [];
  const { existsSync } = await import("node:fs");

  let browser;
  let context;
  let ownsBrowser = false;
  let page;

  async function connectExistingChrome() {
    try {
      browser = await chromium.connectOverCDP(CDP, { timeout: 10_000 });
      console.log("Connected via CDP HTTP");
      return true;
    } catch {
      const version = (await fetch(`${CDP}/json/version`).then((r) =>
        r.json(),
      )) as { webSocketDebuggerUrl?: string };
      if (!version.webSocketDebuggerUrl) return false;
      browser = await chromium.connect(version.webSocketDebuggerUrl, {
        timeout: 10_000,
      });
      console.log("Connected via CDP websocket");
      return true;
    }
  }

  if (await connectExistingChrome()) {
    const contexts = browser.contexts();
    context =
      contexts.find((c) =>
        c.pages().some((p) => p.url().includes("localhost:3000")),
      ) ?? contexts[0];
    if (!context) {
      context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        locale: "tr-TR",
      });
    }
    page =
      context.pages().find((p) => p.url().includes("localhost:3000")) ??
      (await context.newPage());
  } else if (existsSync(STORAGE)) {
    browser = await chromium.launch({ headless: true });
    ownsBrowser = true;
    context = await browser.newContext({
      storageState: STORAGE,
      viewport: { width: 1280, height: 900 },
      locale: "tr-TR",
    });
    page = await context.newPage();
    console.log(`Using storage state: ${STORAGE}`);
  } else {
    browser = await chromium.launch({ headless: false });
    ownsBrowser = true;
    context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      locale: "tr-TR",
    });
    page = await context.newPage();
    console.log("Headed login window — sign in at /giris (90s)…");
    await page.goto(`${BASE}/giris`, { waitUntil: "domcontentloaded" });
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      await page.waitForTimeout(2000);
      await page.goto(`${BASE}/panel`, { waitUntil: "domcontentloaded" });
      if (!page.url().includes("/giris")) break;
    }
  }
  page.on("response", (res) => {
    const url = res.url();
    if (url.includes("/panel/talepler/") || url.includes("/api/auth/")) {
      network.push({
        url,
        status: res.status(),
        resourceType: res.request().resourceType(),
      });
    }
  });

  const detailUrl = `${BASE}/panel/talepler/${REQUEST_ID}`;
  const detailRes = await page.goto(detailUrl, { waitUntil: "domcontentloaded" });
  await page.screenshot({ path: join(OUT, "02-request-detail.png"), fullPage: true });

  const checks: { name: string; ok: boolean; detail?: string }[] = [];
  const check = (name: string, ok: boolean, detail?: string) => {
    checks.push({ name, ok, detail });
    console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? `: ${detail}` : ""}`);
  };

  check("detail not framework 404", (detailRes?.status() ?? 0) !== 404, `status=${detailRes?.status()}`);
  check("detail URL stable", page.url().includes(`/panel/talepler/${REQUEST_ID}`));

  const cta = page.getByRole("button", { name: /Bu talebe teklif ver/i });
  const ctaVisible = await cta.isVisible().catch(() => false);
  check("offer CTA visible on eligible request", ctaVisible);

  if (!ctaVisible) {
    writeFileSync(join(OUT, "network-report.json"), JSON.stringify({ network, checks }, null, 2));
    if (ownsBrowser) await browser.close();
    process.exit(1);
  }

  await cta.click();
  await page.waitForURL(/\/teklif/, { timeout: 20_000 });
  await page.waitForLoadState("domcontentloaded");

  const finalUrl = page.url();
  const docStatus = network.find(
    (n) => n.resourceType === "document" && n.url.includes("/teklif"),
  )?.status;

  check("navigated to offer form path", /\/panel\/talepler\/[^/]+\/teklif/.test(finalUrl), finalUrl);
  check("offer form document not 404", docStatus !== 404, `status=${docStatus ?? "unknown"}`);
  check(
    "offer form heading visible",
    await page.getByRole("heading", { name: /Teklifini yaz|Teklif notunu güncelle/i }).isVisible().catch(() => false),
  );

  await page.screenshot({ path: join(OUT, "03-offer-form-200.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: join(OUT, "04-offer-form-mobile-390.png"), fullPage: true });

  writeFileSync(
    join(OUT, "network-report.json"),
    JSON.stringify(
      {
        detailUrl,
        finalUrl,
        docStatus,
        network,
        checks,
      },
      null,
      2,
    ),
  );

  const failed = checks.filter((c) => !c.ok);
  if (ownsBrowser) {
    mkdirSync(join(homedir(), ".talepo"), { recursive: true });
    await context.storageState({ path: STORAGE });
    await browser.close();
  }
  console.log(`\nScreenshots: ${OUT}`);
  console.log(`Checks: ${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
