import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { join } from "node:path";
import { config as loadDotenv } from "dotenv";
import { expect, test } from "playwright/test";
import { Client } from "pg";

loadDotenv({ path: join(__dirname, "..", ".env") });
loadDotenv({ path: join(__dirname, "..", ".env.local"), override: true });

const baseURL = process.env.CATEGORY_BROWSER_QA_URL ?? "http://localhost:3199";
const nonce = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const password = `QaBrowser!${nonce}`;
const email = `qa-category-browser-${nonce}@talepo.test`;
const cancelName = `QA Browser Cancel ${nonce}`;
const deleteName = `QA Browser Delete ${nonce}`;

let userId = "";
let cancelCategoryId = "";
let deleteCategoryId = "";

test.use({ baseURL, channel: "chrome", headless: true });
test.setTimeout(60_000);

test.beforeAll(async () => {
  const connectionString = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("Browser QA database URL is unavailable");
  const db = new Client({ connectionString });
  await db.connect();

  userId = randomUUID();
  cancelCategoryId = randomUUID();
  deleteCategoryId = randomUUID();
  const salt = randomBytes(16).toString("hex");
  const passwordHash = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
  try {
    await db.query("BEGIN");
    await db.query(
      `INSERT INTO "User" ("id", "email", "name", "membershipNumber", "passwordHash", "platformRole", "status", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, 'SUPER_ADMIN', 'ACTIVE', NOW(), NOW())`,
      [userId, email, "QA Browser Super Admin", `QA-BR-${nonce}`, passwordHash],
    );
    await db.query(
      `INSERT INTO "Category" ("id", "name", "slug", "sortOrder", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 999992, TRUE, NOW(), NOW()), ($4, $5, $6, 999993, TRUE, NOW(), NOW())`,
      [cancelCategoryId, cancelName, `qa-browser-cancel-${nonce}`, deleteCategoryId, deleteName, `qa-browser-delete-${nonce}`],
    );
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    await db.end();
  }
});

test.afterAll(async () => {
  const connectionString = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!connectionString) return;
  const db = new Client({ connectionString });
  await db.connect();
  try {
    await db.query(`DELETE FROM "Category" WHERE "id" = ANY($1::text[])`, [[cancelCategoryId, deleteCategoryId].filter(Boolean)]);
    if (userId) {
      await db.query(`DELETE FROM "AdminAuditLog" WHERE "actorId" = $1`, [userId]);
      await db.query(`DELETE FROM "User" WHERE "id" = $1`, [userId]);
    }
    const categoryCount = await db.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM "Category" WHERE "slug" = ANY($1::text[])`, [[`qa-browser-cancel-${nonce}`, `qa-browser-delete-${nonce}`]]);
    const userCount = await db.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM "User" WHERE "email" = $1`, [email]);
    expect(Number(categoryCount.rows[0].count)).toBe(0);
    expect(Number(userCount.rows[0].count)).toBe(0);
  } finally {
    await db.end();
  }
});

test("delete button cancellation and successful list update", async ({ page }) => {
  const healthStatuses: number[] = [];
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.pathname === "/api/admin/health" && url.searchParams.get("days") === "30") {
      healthStatuses.push(response.status());
    }
  });
  await page.goto(`/giris?callbackUrl=${encodeURIComponent("/admin")}`);
  await page.getByLabel("E-posta adresi").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "E-posta ile giriş yap" }).click();
  await page.waitForURL("**/admin");

  await page.getByRole("button", { name: "Şimdilik bypass et" }).click();
  await page.getByRole("heading", { name: "Admin Panel" }).waitFor();

  const cancelRow = page.locator(`[data-category-id="${cancelCategoryId}"]`);
  await expect(cancelRow.getByRole("button", { name: "Kalıcı sil" })).toBeVisible();
  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("prompt");
    await dialog.dismiss();
  });
  await cancelRow.getByRole("button", { name: "Kalıcı sil" }).click();
  await expect(cancelRow).toBeVisible();

  const deleteRow = page.locator(`[data-category-id="${deleteCategoryId}"]`);
  let promptIndex = 0;
  page.on("dialog", async (dialog) => {
    promptIndex += 1;
    if (promptIndex === 1) await dialog.accept(deleteName);
    else if (promptIndex === 2) await dialog.accept("Kontrollü tarayıcı silme QA");
    else await dialog.dismiss();
  });
  await deleteRow.getByRole("button", { name: "Kalıcı sil" }).click();
  await expect(page.getByRole("status")).toContainText("Kategori kalıcı olarak silindi.", { timeout: 15_000 });
  await expect(deleteRow).toHaveCount(0, { timeout: 15_000 });
  expect(promptIndex).toBe(2);
  await expect.poll(() => healthStatuses.length, { timeout: 20_000 }).toBeGreaterThan(0);
  expect(healthStatuses).toEqual([200]);
  deleteCategoryId = "";
});
