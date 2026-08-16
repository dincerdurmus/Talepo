import { readFileSync } from "node:fs";

const matcher = readFileSync("src/server/monetization/personal-matching.ts", "utf8");
const feed = readFileSync("src/server/monetization/opportunities-feed.ts", "utf8");
const plan = readFileSync("src/components/panel/PlanManager.tsx", "utf8");
const helper = readFileSync("src/lib/monetization/saved-search-canonical.ts", "utf8");
const hub = readFileSync("src/components/panel/OpportunitiesHub.tsx", "utf8");

const checks: Array<[string, boolean]> = [
  ["personal authority exists", matcher.includes("matchPersonalToRequest")],
  ["USER-owned filters only", matcher.includes('ownerType: "USER"')],
  ["unknown is preserved", matcher.includes("score: null")],
  ["company matcher remains separate", feed.includes("matchCompanyToRequest")],
  ["personal matcher is routed", feed.includes("matchPersonalToRequest")],
  ["personal inventory is not used", !matcher.includes("inventory")],
  ["contextual plan education exists", plan.includes("kişisel eşleşme sinyalleri")],
  ["legacy categorySlug uses shared helper", matcher.includes("canonicalFilterFromSavedSearchFilters")],
  ["helper resolves via getTaxonomyNode", helper.includes("getTaxonomyNode")],
  ["card surfaces matchReasons", hub.includes("item.matchReasons") && hub.includes("Neden sana uygun")],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [label, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"}: ${label}`);
if (failed.length > 0) process.exit(1);
console.log("Personal opportunity matching foundation verifier passed.");
