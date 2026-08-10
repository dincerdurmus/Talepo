/**
 * Completion sprint static checks.
 * Run: node scripts/verify-completion-sprint.mjs
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

// Smart match on detail page
assert.match(read("app/panel/talepler/[id]/page.tsx"), /SmartMatchPanel/);
assert.match(read("app/panel/talepler/[id]/page.tsx"), /matchCompanyToRequest/);

// Smart match all tabs (not matched-only)
const talepler = read("app/panel/talepler/page.tsx");
assert.match(talepler, /hasSmartMatching \? \(request\.matchScore/);

// District in explore parser
assert.match(read("lib/explore/category-filters.ts"), /district:/);

// Alert attributes validation
assert.match(read("lib/monetization/alert-rule-attributes.ts"), /validateAlertRuleAttributes/);
assert.match(read("app/api/monetization/alerts/route.ts"), /attributes/);

// Alert in-app notifications wired to distribute
assert.match(
  read("server/request/distribute-request.ts"),
  /deliverAlertRuleNotifications/,
);

// Watchlist on detail
assert.match(read("app/panel/talepler/[id]/page.tsx"), /WatchlistToggle/);

// Analytics metric rename
assert.match(read("lib/monetization/types.ts"), /watchlistAddsInPeriod/);
assert.match(read("lib/monetization/types.ts"), /activeWatchedRequests/);

// High budget passive state
assert.match(read("components/panel/OpportunitiesHub.tsx"), /Yeterli anonim piyasa verisi/);

console.log("verify-completion-sprint: PASS");
