/**
 * Monetization V2 security smoke checks (static + optional live DB).
 * Run: node scripts/verify-monetization-security.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "src");

function read(rel) {
  return fs.readFileSync(path.join(src, rel), "utf8");
}

// Legacy cookie alert API must be removed
assert.equal(
  fs.existsSync(path.join(src, "app/api/alert-rules/route.ts")),
  false,
  "Legacy /api/alert-rules should be removed",
);

assert.equal(
  fs.existsSync(path.join(src, "lib/alerts/alert-rules-store.ts")),
  false,
  "Cookie alert-rules-store should be removed",
);

// Monetization APIs must scope by companyId from requireCompanyFeature
for (const route of [
  "app/api/monetization/alerts/route.ts",
  "app/api/monetization/saved-searches/route.ts",
  "app/api/monetization/watchlist/route.ts",
]) {
  const code = read(route);
  assert.match(code, /requireCompanyFeature/, `${route} must use requireCompanyFeature`);
  assert.match(code, /companyId: ctx\.companyId/, `${route} must scope queries`);
}

// Watchlist mutations must not accept foreign companyId in body
const watchlist = read("app/api/monetization/watchlist/route.ts");
assert.doesNotMatch(
  watchlist,
  /body\.companyId/,
  "Watchlist must not trust client companyId",
);

// Alert notifications service exists
assert.match(
  read("server/monetization/alert-notifications.ts"),
  /deliverAlertRuleNotifications/,
);

console.log("verify-monetization-security: PASS");
