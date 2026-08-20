/**
 * Opportunity card Kaydet = individual watchlist, not Saved Search.
 * Run: npx tsx scripts/verify-opportunity-card-save-action-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { isOpportunitySaveSupported } from "../src/lib/panel/opportunity-save-support";

let pass = 0;
let fail = 0;
const errors: string[] = [];

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass += 1;
    console.log(`PASS — ${name}`);
  } else {
    fail += 1;
    const msg = detail ? `${name}: ${detail}` : name;
    errors.push(msg);
    console.log(`FAIL — ${msg}`);
  }
}

const root = join(__dirname, "..");
function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

const schema = read("prisma/schema.prisma");
const watchlistModel =
  schema.match(/model OpportunityWatchlistItem[\s\S]*?\n}/)?.[0] ?? "";
const savedSearchModel = schema.match(/model SavedSearch[\s\S]*?\n}/)?.[0] ?? "";
const hub = read("src/components/panel/OpportunitiesHub.tsx");
const workspace = read(
  "src/components/panel/discovery/ProfessionalDiscoveryWorkspace.tsx",
);
const page = read("src/app/panel/firsatlar/page.tsx");
const route = read("src/app/api/monetization/watchlist/route.ts");
const feed = read("src/server/monetization/opportunities-feed.ts");
const helper = read("src/lib/panel/opportunity-save-support.ts");
const savedSearchRoute = read("src/app/api/monetization/saved-searches/route.ts");
const featureScope = read("src/lib/membership/feature-scope.ts");
const requestDetail = read("src/app/panel/talepler/[id]/page.tsx");

console.log("\n=== UNIT — SAVE SUPPORT ===\n");
check(
  "A workspace + entitled → save supported",
  isOpportunitySaveSupported({ context: "WORKSPACE", canWatchlist: true }),
);
check(
  "A workspace without entitlement → not supported",
  !isOpportunitySaveSupported({ context: "WORKSPACE", canWatchlist: false }),
);
check(
  "D personal + entitled → not supported (no user-owned model)",
  !isOpportunitySaveSupported({ context: "PERSONAL", canWatchlist: true }),
);
check(
  "D personal without entitlement → not supported",
  !isOpportunitySaveSupported({ context: "PERSONAL", canWatchlist: false }),
);

console.log("\n=== A — SUPPORTED CONTEXT WIRES PERSIST ===\n");
check(
  "A hub calls company watchlist API",
  hub.includes('fetch("/api/monetization/watchlist"') &&
    hub.includes('action: add ? "add" : "remove"') &&
    hub.includes("requestId"),
);
check(
  "A success sets Kaydedildi state",
  hub.includes("isWatchlisted: add") &&
    hub.includes('item.isWatchlisted ? "Kaydedildi" : "Kaydet"'),
);
check(
  "A button only when canSave",
  hub.includes("{canSave ? (") &&
    hub.includes("isOpportunitySaveSupported") &&
    hub.includes("canWatchlist"),
);
check(
  "A loading disables only that card button",
  hub.includes("disabled={busy === item.requestId}") &&
    hub.includes("LoaderCircle"),
);
check(
  "A failure is truthful, not silent",
  hub.includes('data.message ?? "Kaydedilemedi."') &&
    hub.includes("Bağlantı hatası.") &&
    hub.includes("saveError"),
);

console.log("\n=== B — REFRESH PRESERVED ===\n");
check(
  "B feed reads OpportunityWatchlistItem by companyId",
  feed.includes("prisma.opportunityWatchlistItem.findMany") &&
    feed.includes("where: companyId ? { companyId }") &&
    feed.includes("isWatchlisted: watchlistIds.has(req.id)"),
);
check(
  "B GET watchlist is company-scoped",
  route.includes("export async function GET") &&
    route.includes("where: { companyId: ctx.companyId }"),
);
check(
  "B personal feed does not load company watchlist",
  feed.includes('id: "__personal_watchlist_deferred__"'),
);

console.log("\n=== C — DUPLICATE PREVENTION ===\n");
check(
  "C unique companyId+requestId",
  watchlistModel.includes("@@unique([companyId, requestId])"),
);
check(
  "C add uses upsert (no duplicate row)",
  route.includes("opportunityWatchlistItem.upsert") &&
    route.includes("companyId_requestId") &&
    route.includes("update: {}"),
);

console.log("\n=== D — PERSONAL NOT FALSELY ACTIONABLE ===\n");
check(
  "D page requires company workspace for canWatchlist",
  page.includes("Boolean(companyId) && hasFeature(entitlements.features, \"watchlist\")"),
);
check(
  "D hub hides Kaydet when unsupported",
  hub.includes("isOpportunitySaveSupported") &&
    hub.includes("{canSave ? (") &&
    !hub.includes("Yakında"),
);
check(
  "D personal saved section hidden without watchlist",
  hub.includes("showSavedSection = canWatchlist") &&
    hub.includes("{showSavedSection ? ("),
);
check(
  "D workspace hides Kaydettiklerim tab without watchlist",
  workspace.includes('tab.id !== "saved" || canWatchlist') ||
    workspace.includes('tab.id === "saved" && !canWatchlist'),
);
check(
  "D no localStorage fake persist",
  !hub.includes("localStorage") && !workspace.includes("localStorage"),
);
check(
  "D helper documents personal gap",
  helper.includes("Personal has no user-owned watchlist row") &&
    helper.includes("do not fake persistence"),
);

console.log("\n=== E — WORKSPACE SAVE PRESERVED ===\n");
check(
  "E API still requireCompanyFeature watchlist",
  route.includes('requireCompanyFeature(user.id, "watchlist")') &&
    route.includes("ctx.companyId"),
);
check(
  "E workspace toggle still posts watchlist",
  workspace.includes('fetch("/api/monetization/watchlist"') &&
    workspace.includes("canWatchlist ? toggleBookmark"),
);
check(
  "E request detail watchlist remains company-gated",
  requestDetail.includes("{companyId ? (") &&
    requestDetail.includes("WatchlistToggle") &&
    requestDetail.includes("companyId_requestId"),
);

console.log("\n=== F — OWNERSHIP ===\n");
check(
  "F API ignores client owner ids",
  route.includes("Client owner ids are ignored") &&
    route.includes("const companyId = ctx.companyId") &&
    !route.includes("body.companyId") &&
    !route.includes("body.userId"),
);
check(
  "F model is company-owned only",
  /companyId\s+String/.test(watchlistModel) &&
    !/\buserId\b/.test(watchlistModel) &&
    !/ownerType/.test(watchlistModel),
);
check(
  "F no RequestWatchlist model",
  !schema.includes("model RequestWatchlist"),
);
check(
  "F watchlist is company-owned resource feature",
  featureScope.includes('"watchlist"') &&
    featureScope.includes("COMPANY_OWNED_RESOURCE_FEATURES"),
);

console.log("\n=== G — SAVED SEARCH UNAFFECTED ===\n");
check(
  "G Kaydet does not call saved-searches",
  !hub.includes("/api/monetization/saved-searches") &&
    !workspace.includes("/api/monetization/saved-searches"),
);
check(
  "G SavedSearch model still ownerType USER|COMPANY",
  savedSearchModel.includes("ownerType ResourceOwnerType") &&
    savedSearchModel.includes("userId") &&
    savedSearchModel.includes("companyId"),
);
check(
  "G saved-searches route unchanged resource-owner gate",
  savedSearchRoute.includes("requireResourceOwnerFeature"),
);
check(
  "G naming: Kaydet != kayıtlı arama",
  hub.includes("kayıtlı aramalardan ayrıdır") &&
    workspace.includes('label: "Kaydettiklerim"'),
);

console.log("\n=== SCHEMA LOCK ===\n");
check(
  "schema has no personal watchlist owner",
  !/\buserId\b/.test(watchlistModel),
);

console.log(`\nOpportunity card save action: ${pass}/${pass + fail} PASS`);
if (fail > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("Opportunity card save action verifier passed.");
