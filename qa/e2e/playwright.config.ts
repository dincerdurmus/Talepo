import { defineConfig, devices } from "@playwright/test";

/**
 * Talepo A'dan Z'ye tarayici testleri.
 *
 * Sunucu BU KONFIG TARAFINDAN BASLATILMAZ: kabul sunucusu 3187'yi kimin
 * tuttuguna karisilmaz (kurucu kurali). Sunucu disaridan ayaga kaldirilir,
 * test yalnizca baglanir.
 */
const BASE_URL = process.env.TALEPO_E2E_BASE_URL ?? "http://localhost:3187";

export default defineConfig({
  testDir: "./tests",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "../../reports/e2e-a-z-2026-09-23/playwright-sonuc.json" }]],
  outputDir: "./.artifacts",
  use: {
    baseURL: BASE_URL,
    trace: "off",
    video: "off",
    screenshot: "off",
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
  },
  projects: [
    {
      name: "masaustu",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobil390",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: false },
    },
  ],
});
