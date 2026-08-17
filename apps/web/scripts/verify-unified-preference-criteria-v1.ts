/**
 * Unified SavedSearch / Alert / Opportunity criteria authority.
 * Run: npx tsx scripts/verify-unified-preference-criteria-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { RequestDiscoveryProjection } from "../src/lib/discovery";
import {
  budgetOverlaps,
  criteriaFromAlertRule,
  evaluatePreferenceCriteria,
  keywordMatches,
  locationMatches,
  normalizePreferenceCriteria,
  preferenceCriteriaFingerprint,
  validateBudgetRange,
} from "../src/lib/monetization/preference-criteria";
import { exploreFiltersToSavedSearch, savedSearchToExploreUrl } from "../src/lib/monetization/saved-search-url";
import { ensureTaxonomyLoaded } from "../src/lib/taxonomy";
import { matchPersonalAgainstPreferences } from "../src/server/monetization/personal-matching-core";

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

ensureTaxonomyLoaded();
const root = join(__dirname, "..");
function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

const FURNITURE_LEAF =
  "tax:furniture:ofis-sandalyesi:sandalye-tipleri:yonetici-koltugu";
const FURNITURE_PATH = [
  "tax:furniture",
  "tax:furniture:ofis-sandalyesi",
  "tax:furniture:ofis-sandalyesi:sandalye-tipleri",
  FURNITURE_LEAF,
];

function furnitureProjection(): RequestDiscoveryProjection {
  return {
    version: 1,
    kind: "discovery_projection",
    taxonomyNodeIds: FURNITURE_PATH,
    primaryLeafId: FURNITURE_LEAF,
    categoryId: "furniture",
    subcategorySlug: "ofis-sandalyesi",
    attributes: {},
    constraints: {},
    matchContract: { must: [], preferred: [], excluded: [], anyFields: [], ranges: [] },
    filterContract: { include: {}, exclude: {}, preferred: {}, range: {}, any: [] },
    builtAt: "2026-08-16T00:00:00.000Z",
  };
}

const istanbulFurniture = {
  version: 1 as const,
  categorySlug: "furniture",
  city: "İstanbul",
  budgetMin: 10000,
  budgetMax: 50000,
};

console.log("\n=== SHARED SEMANTICS ===\n");
check("min > max rejected", validateBudgetRange(50, 10).ok === false);
check("min <= max accepted", validateBudgetRange(10, 50).ok === true);
check(
  "budget overlap 20k in 10-50k",
  budgetOverlaps({
    requestMin: 20000,
    requestMax: 20000,
    filterMin: 10000,
    filterMax: 50000,
  }),
);
check(
  "budget null vs ranged filter is NO",
  budgetOverlaps({
    requestMin: null,
    requestMax: null,
    filterMin: 10000,
    filterMax: 50000,
  }) === false,
);
check(
  "location istanbul matches istanbul",
  locationMatches("İstanbul", null, "istanbul", null),
);
check(
  "location ankara does not match istanbul",
  locationMatches("Ankara", null, "İstanbul", null) === false,
);
check("keyword phrase contains", keywordMatches("Yönetici koltuğu ofis", "yönetici koltuğu"));
check("keyword comma OR", keywordMatches("ofis baskı işi", "yazılım, baskı"));
check("keyword miss", keywordMatches("Ankara mobilya", "iphone") === false);

const saved = exploreFiltersToSavedSearch({
  categorySlug: "furniture",
  city: "İstanbul",
  budgetMin: 10000,
  budgetMax: 50000,
  taxonomyLeaf: FURNITURE_LEAF,
  taxonomyNode: "tax:furniture:ofis-sandalyesi",
  leafExact: true,
});
const runUrl = savedSearchToExploreUrl(saved);
check("1 save/run goes to /panel/talepler", runUrl.startsWith("/panel/talepler?"));
check("1 round-trip city+budget", runUrl.includes("city=") && runUrl.includes("budgetMin=10000") && runUrl.includes("budgetMax=50000"));
check("2 taxonomy leaf survives save", saved.canonical?.primaryLeafId === FURNITURE_LEAF);
check("2 taxonomy leaf survives run URL", runUrl.includes(`taxonomyLeaf=${encodeURIComponent(FURNITURE_LEAF)}`) || runUrl.includes("taxonomyLeaf=tax%3Afurniture"));
check("2 leafExact survives", saved.canonical?.leafExact === true && runUrl.includes("leafExact=1"));

const normalized = normalizePreferenceCriteria(istanbulFurniture);
check("normalize furniture+istanbul lifts canonical", normalized.ok && Boolean(normalized.ok && normalized.filters.canonical));

const istanbul20k = evaluatePreferenceCriteria({
  projection: furnitureProjection(),
  facts: {
    title: "Yönetici koltuğu",
    city: "İstanbul",
    budgetMin: 20000,
    budgetMax: 20000,
  },
  criteria: istanbulFurniture,
});
const ankara20k = evaluatePreferenceCriteria({
  projection: furnitureProjection(),
  facts: {
    title: "Yönetici koltuğu",
    city: "Ankara",
    budgetMin: 20000,
    budgetMax: 20000,
  },
  criteria: istanbulFurniture,
});
const istanbulNullBudget = evaluatePreferenceCriteria({
  projection: furnitureProjection(),
  facts: {
    title: "Yönetici koltuğu",
    city: "İstanbul",
    budgetMin: null,
    budgetMax: null,
  },
  criteria: istanbulFurniture,
});
const ownRequest = evaluatePreferenceCriteria({
  projection: furnitureProjection(),
  facts: {
    title: "Yönetici koltuğu",
    city: "İstanbul",
    budgetMin: 20000,
    budgetMax: 20000,
    createdById: "user-1",
  },
  criteria: istanbulFurniture,
  viewer: { userId: "user-1" },
});

check("4 istanbul 20k MATCH", istanbul20k.match);
check("5 ankara 20k NO", ankara20k.match === false);
check("6 istanbul budget null NO", istanbulNullBudget.match === false);
check("8 own request NO", ownRequest.match === false);

const prefs = [
  { kind: "saved_search" as const, name: "İstanbul mobilya", criteria: istanbulFurniture },
];
const ocHit = matchPersonalAgainstPreferences(furnitureProjection(), prefs, {
  title: "Koltuk",
  city: "İstanbul",
  budgetMin: 20000,
  budgetMax: 20000,
});
const ocMiss = matchPersonalAgainstPreferences(furnitureProjection(), prefs, {
  title: "Koltuk",
  city: "Ankara",
  budgetMin: 20000,
  budgetMax: 20000,
});
check("7 OC reason only on full match", ocHit.reasons.some((r) => /Kayıtlı aramanızla/.test(r)));
check("3 Ankara furniture does not produce İstanbul reason", ocMiss.reasons.length === 0);

const legacyAlert = criteriaFromAlertRule({
  categorySlug: "furniture",
  city: "İstanbul",
  minBudget: 10000,
  maxBudget: 50000,
  keywords: null,
});
const legacyHit = evaluatePreferenceCriteria({
  projection: furnitureProjection(),
  facts: { title: "Koltuk", city: "İstanbul", budgetMin: 20000, budgetMax: 20000 },
  criteria: legacyAlert,
});
check("11 legacy AlertRule lifts and matches", legacyHit.match);

const fpA = preferenceCriteriaFingerprint(istanbulFurniture);
const fpB = preferenceCriteriaFingerprint({ ...istanbulFurniture, city: "Ankara" });
const fpDup = preferenceCriteriaFingerprint({ ...istanbulFurniture, keyword: undefined });
check("10 fingerprint distinguishes location", fpA !== fpB);
check("10 same criteria same fingerprint", fpA === fpDup);

console.log("\n=== SOURCE CONTRACT ===\n");
const manager = read("src/components/panel/SavedSearchesManager.tsx");
const saveBtn = read("src/components/panel/SaveExploreSearchButton.tsx");
const alerts = read("src/server/monetization/alert-matching.ts");
const notify = read("src/server/monetization/alert-notifications.ts");
const alertRoute = read("src/app/api/monetization/alerts/route.ts");
const uyarilar = read("src/app/panel/uyarilar/page.tsx");
const feed = read("src/server/monetization/opportunities-feed.ts");
const click = read("src/app/panel/bildirimler/r/[id]/page.tsx");

check("run URL is Explore not Opportunity", manager.includes("savedSearchToExploreUrl") && !manager.includes("firsatlar") && !manager.includes("discoveryFilterToWorkspaceUrl"));
check("Bildirim aç action", manager.includes("Bildirim aç") && manager.includes("createFromSavedSearch"));
check("save path passes taxonomyLeaf", saveBtn.includes("taxonomyLeaf"));
check("alert matcher uses shared evaluator", alerts.includes("evaluatePreferenceCriteria") && !alerts.includes("includesKeyword"));
check("own-request skipped in notify", notify.includes("createdById"));
check("dedupe uses alertRuleId actionUrl", notify.includes("alertNotificationActionUrl") || notify.includes("alertRule="));
check("alert create writes canonical envelope", alertRoute.includes("normalizePreferenceCriteria") && alertRoute.includes("createFromSavedSearch"));
check("duplicate active alert blocked", alertRoute.includes("alreadyExists"));
check("alert page does not promise leaf picker", !uyarilar.includes("taxonomy leaf"));
check("OC feed passes full facts", feed.includes("district:") && feed.includes("createdById: req.createdById"));
check("15 notification click still redirects actionUrl", click.includes("notification.actionUrl") && click.includes("redirect"));

console.log(`\n=== SUMMARY pass=${pass} fail=${fail} ===\n`);
if (errors.length) {
  for (const e of errors) console.log(" -", e);
  process.exit(1);
}
console.log("Unified preference criteria verifier passed.");
process.exit(0);
