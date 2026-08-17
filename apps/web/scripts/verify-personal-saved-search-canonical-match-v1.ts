/**
 * Personal saved-search canonical match + opportunity reason surface.
 * Run: npx tsx scripts/verify-personal-saved-search-canonical-match-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  evaluateDiscoveryFilter,
  hasCanonicalFilterSignal,
  validateCanonicalDiscoveryFilter,
  type CanonicalDiscoveryFilter,
  type RequestDiscoveryProjection,
} from "../src/lib/discovery";
import { canonicalFilterFromSavedSearchFilters } from "../src/lib/monetization/saved-search-canonical";
import { exploreFiltersToSavedSearch } from "../src/lib/monetization/saved-search-url";
import type { SavedSearchFilters } from "../src/lib/monetization/types";
import { ensureTaxonomyLoaded, getTaxonomyNode } from "../src/lib/taxonomy";

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
const FURNITURE_SIBLING =
  "tax:furniture:ofis-sandalyesi:sandalye-tipleri:operasyon-koltugu";
const FURNITURE_PATH = [
  "tax:furniture",
  "tax:furniture:ofis-sandalyesi",
  "tax:furniture:ofis-sandalyesi:sandalye-tipleri",
  FURNITURE_LEAF,
];

function emptyContracts() {
  return {
    matchContract: {
      must: [],
      preferred: [],
      excluded: [],
      anyFields: [],
      ranges: [],
    },
    filterContract: {
      include: {},
      exclude: {},
      preferred: {},
      range: {},
      any: [],
    },
  };
}

function furnitureLeafProjection(): RequestDiscoveryProjection {
  return {
    version: 1,
    kind: "discovery_projection",
    taxonomyNodeIds: FURNITURE_PATH,
    primaryLeafId: FURNITURE_LEAF,
    categoryId: "furniture",
    subcategorySlug: "ofis-sandalyesi",
    attributes: {},
    constraints: {},
    ...emptyContracts(),
    builtAt: "2026-08-16T00:00:00.000Z",
  };
}

function nodeFilter(nodeId: string): CanonicalDiscoveryFilter {
  return {
    version: 1,
    kind: "canonical_discovery_filter",
    taxonomyNodeIds: [nodeId],
  };
}

const projection = furnitureLeafProjection();

// A — write path lifts category focus
{
  const saved = exploreFiltersToSavedSearch({ categorySlug: "furniture" });
  check(
    "A exploreFiltersToSavedSearch furniture → tax:furniture",
    saved.canonical?.taxonomyNodeIds?.includes("tax:furniture") === true &&
      saved.canonical?.leafExact !== true,
    JSON.stringify(saved.canonical),
  );
}

// B — ancestor furniture matches yönetici koltuğu leaf
{
  const result = evaluateDiscoveryFilter(projection, nodeFilter("tax:furniture"));
  check(
    "B tax:furniture vs yönetici-koltugu MATCH",
    result.match === true,
    JSON.stringify(result),
  );
}

// C — automotive does not match furniture leaf
{
  const result = evaluateDiscoveryFilter(
    projection,
    nodeFilter("tax:automotive"),
  );
  check(
    "C tax:automotive vs furniture leaf NO_MATCH",
    result.match === false,
    JSON.stringify(result),
  );
}

// D — legacy categorySlug-only saved search
{
  const legacy: SavedSearchFilters = { version: 1, categorySlug: "furniture" };
  check("D legacy has no stored canonical", legacy.canonical == null);
  const resolved = canonicalFilterFromSavedSearchFilters(legacy);
  const canonical = validateCanonicalDiscoveryFilter(resolved);
  const signal =
    canonical.ok && hasCanonicalFilterSignal(canonical.filter);
  const result =
    canonical.ok && signal
      ? evaluateDiscoveryFilter(projection, canonical.filter)
      : { match: false };
  check(
    "D helper lifts furniture → tax:furniture",
    resolved?.taxonomyNodeIds?.includes("tax:furniture") === true &&
      resolved?.leafExact !== true,
    JSON.stringify(resolved),
  );
  check(
    "D personal match path MATCH",
    signal && result.match === true,
    JSON.stringify(result),
  );
}

// E — invalid slug is not match-all
{
  const resolved = canonicalFilterFromSavedSearchFilters({
    version: 1,
    categorySlug: "invalid-category",
  });
  const canonical = validateCanonicalDiscoveryFilter(resolved);
  const signal =
    canonical.ok && hasCanonicalFilterSignal(canonical.filter);
  check("E invalid slug → no canonical", resolved == null);
  check("E invalid slug → no match signal", signal === false);
  check(
    "E evaluateDiscoveryFilter without signal is match-all (must skip)",
    evaluateDiscoveryFilter(projection, null).match === true &&
      evaluateDiscoveryFilter(projection, null).reasons.includes(
        "no-canonical-filter",
      ),
  );
}

// F — reason format used by personal-matching (pure; matcher itself needs prisma)
{
  const searchName = "[E2E TEST] Mobilya ve Ofis";
  const reason = `Kayıtlı aramanızla eşleşiyor: ${searchName}`;
  const matcher = read("src/server/monetization/personal-matching-core.ts");
  check(
    "F reason contains Kayıtlı aramanızla eşleşiyor:",
    reason.includes("Kayıtlı aramanızla eşleşiyor:") &&
      reason.includes(searchName),
    reason,
  );
  check(
    "F personal matcher uses the same reason format",
    matcher.includes("formatPersonalSavedSearchMatchReason") &&
      matcher.includes("Kayıtlı aramanızla eşleşiyor:"),
  );
}

// G — opportunity card source
{
  const hub = read("src/components/panel/OpportunitiesHub.tsx");
  check(
    "G card renders matchReasons",
    hub.includes("item.matchReasons") && hub.includes("matchReasonList"),
  );
  check(
    "G card does not dump opportunityReasons as a second list",
    !hub.includes("Fırsat neden ilginç") &&
      !hub.includes("Neden sana uygun") &&
      hub.includes("fitReasons.map"),
  );
  check(
    "G no fake match reason when absent",
    !hub.includes("Güçlü talep eşleşmesi") &&
      !/fitReasons\.length === 0[\s\S]*Kayıtlı aramanızla/.test(hub),
  );
}

// H — no company inventory / specialization in personal helper/matcher
{
  const helper = read("src/lib/monetization/saved-search-canonical.ts");
  const matcher = read("src/server/monetization/personal-matching.ts");
  check(
    "H helper has no inventory/specialization",
    !/inventory|specialization/i.test(helper),
  );
  check(
    "H personal matcher has no inventory/specialization",
    !/inventory|specialization/i.test(matcher),
  );
}

// I — leafExact excludes sibling leaves
{
  const exactSibling = evaluateDiscoveryFilter(projection, {
    version: 1,
    kind: "canonical_discovery_filter",
    primaryLeafId: FURNITURE_SIBLING,
    leafExact: true,
  });
  const exactSelf = evaluateDiscoveryFilter(projection, {
    version: 1,
    kind: "canonical_discovery_filter",
    primaryLeafId: FURNITURE_LEAF,
    leafExact: true,
  });
  check(
    "I leafExact sibling excluded",
    exactSibling.match === false,
    JSON.stringify(exactSibling),
  );
  check(
    "I leafExact self still matches",
    exactSelf.match === true,
    JSON.stringify(exactSelf),
  );
}

// Taxonomy authority + existing canonical preserved
{
  check(
    "taxonomy furniture node exists",
    getTaxonomyNode("tax:furniture")?.id === "tax:furniture",
  );
  const existing: SavedSearchFilters = {
    version: 1,
    categorySlug: "automotive",
    canonical: {
      version: 1,
      kind: "canonical_discovery_filter",
      taxonomyNodeIds: ["tax:furniture"],
      leafExact: true,
      primaryLeafId: FURNITURE_LEAF,
    },
  };
  const resolved = canonicalFilterFromSavedSearchFilters(existing);
  check(
    "existing canonical not overwritten by weaker categorySlug",
    resolved?.taxonomyNodeIds?.includes("tax:furniture") === true &&
      resolved?.primaryLeafId === FURNITURE_LEAF &&
      resolved?.leafExact === true,
    JSON.stringify(resolved),
  );
}

const personalMatching = read("src/server/monetization/personal-matching.ts");
check(
  "personal matcher uses shared helper",
  personalMatching.includes("criteriaFromAlertRule") &&
    personalMatching.includes("normalizePreferenceCriteria"),
);
check(
  "personal matcher does not string-compare Request.category.slug",
  !personalMatching.includes("request.category") &&
    !/Request\.category/.test(personalMatching) &&
    !personalMatching.includes("categorySlug ==="),
);

const writePath = read("src/lib/monetization/saved-search-url.ts");
check(
  "write path uses shared helper",
  writePath.includes("canonicalFilterFromSavedSearchFilters"),
);

const saveButton = read("src/components/panel/SaveExploreSearchButton.tsx");
check(
  "SaveExploreSearchButton does not construct taxonomy IDs",
  saveButton.includes("exploreFiltersToSavedSearch") &&
    saveButton.includes("taxonomyLeaf") &&
    !saveButton.includes("tax:"),
);

console.log(`\nPersonal saved-search canonical match: ${pass} PASS / ${fail} FAIL`);
if (fail > 0) {
  for (const err of errors) console.error(`  • ${err}`);
  process.exit(1);
}
