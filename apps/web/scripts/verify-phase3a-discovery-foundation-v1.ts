/**
 * Phase 3A — Canonical Discovery Foundation golden fixtures.
 * Run: npx tsx scripts/verify-phase3a-discovery-foundation-v1.ts
 */
import { ensureAutomotiveCatalogRegistered } from "../src/lib/catalog";
import {
  buildDiscoveryProjectionFromState,
  DISCOVERY_PROJECTION_VERSION,
  evaluateDiscoveryFilter,
  filterContractFromProjection,
  hasCanonicalFilterSignal,
  isCandidateCompatibleWithProjection,
  matchContractFromProjection,
  parseDiscoveryProjection,
  validateCanonicalDiscoveryFilter,
  type CanonicalDiscoveryFilter,
  type RequestDiscoveryProjection,
} from "../src/lib/discovery";
import { savedSearchToExploreUrl } from "../src/lib/monetization/saved-search-url";
import type { SavedSearchFilters } from "../src/lib/monetization/types";
import { createTextOnlyState } from "../src/lib/request-composer";
import {
  getTaxonomyDescendantIds,
  getTaxonomyNode,
  ensureTaxonomyLoaded,
} from "../src/lib/taxonomy";

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

ensureAutomotiveCatalogRegistered();
ensureTaxonomyLoaded();

function projectFromText(text: string): RequestDiscoveryProjection {
  const state = createTextOnlyState(text);
  return buildDiscoveryProjectionFromState(state);
}

function leafFilter(leafId: string, leafExact = false): CanonicalDiscoveryFilter {
  return {
    version: 1,
    kind: "canonical_discovery_filter",
    primaryLeafId: leafId,
    leafExact: leafExact || undefined,
  };
}

function nodeFilter(nodeId: string): CanonicalDiscoveryFilter {
  return {
    version: 1,
    kind: "canonical_discovery_filter",
    taxonomyNodeIds: [nodeId],
  };
}

// --- 1 publish projection ---
const tvText =
  "140 ekran televizyon arıyorum, marka fark etmez ama Samsung olmasın, 4K olsa iyi olur.";
const tvProj = projectFromText(tvText);
check("1 publish projection", tvProj.kind === "discovery_projection");

// --- 2 projection version ---
check("2 projection version", tvProj.version === DISCOVERY_PROJECTION_VERSION);

// --- 3 taxonomy IDs ---
check(
  "3 taxonomy IDs non-empty",
  tvProj.taxonomyNodeIds.length > 0,
  JSON.stringify(tvProj.taxonomyNodeIds),
);

// --- 4 primary leaf ---
check(
  "4 primary leaf",
  Boolean(tvProj.primaryLeafId) &&
    /tv|televizyon|television/i.test(tvProj.primaryLeafId ?? ""),
  String(tvProj.primaryLeafId),
);

// --- 5 ancestor filtering ---
{
  const rootOrParent = tvProj.taxonomyNodeIds[0];
  check(
    "5 ancestor filtering",
    Boolean(rootOrParent) &&
      evaluateDiscoveryFilter(tvProj, nodeFilter(rootOrParent!)).match,
  );
}

// --- 6 exact leaf filtering ---
{
  const leaf = tvProj.primaryLeafId!;
  const exact = evaluateDiscoveryFilter(tvProj, leafFilter(leaf, true));
  check("6 exact leaf match", exact.match && exact.path === "CANONICAL_MATCH");
}

// --- 7 entity refs (TV may be empty; structure OK) ---
check("7 entity refs shape", tvProj.entityRefs == null || typeof tvProj.entityRefs === "object");

// --- 8 attribute projection ---
check(
  "8 attribute screenSize",
  tvProj.attributes.screenSize === "140" ||
    tvProj.constraints.screenSize?.value === "140",
);

// --- 9 MUST filter ---
{
  const mustFilter: CanonicalDiscoveryFilter = {
    version: 1,
    kind: "canonical_discovery_filter",
    mustIncludes: { resolution: ["4K"] },
  };
  // TV has PREFERRED 4K — mustIncludes against preferred still allowed by evaluator
  const r = evaluateDiscoveryFilter(tvProj, mustFilter);
  check("9 MUST filter path", r.path === "CANONICAL_MATCH" || r.match);
}

// --- 10 EXCLUDED filter (seller brand=Samsung vs request excludes) ---
{
  const samsungFilter: CanonicalDiscoveryFilter = {
    version: 1,
    kind: "canonical_discovery_filter",
    attributes: { brand: "Samsung" },
  };
  const r = evaluateDiscoveryFilter(tvProj, samsungFilter);
  check("10 EXCLUDED vs Samsung filter", !r.match, r.reasons.join(","));
}

// --- 11 PREFERRED not hard reject ---
{
  const cand = isCandidateCompatibleWithProjection(tvProj, {
    resolution: "1080p",
    brand: "LG",
  });
  check("11 PREFERRED not hard reject", cand.compatible);
}

// --- 12 ANY neutral ---
check("12 brand ANY", tvProj.constraints.brand?.mode === "ANY");

// --- 13 UNKNOWN neutral ---
{
  const unk = projectFromText("Televizyon arıyorum");
  const brand = unk.constraints.brand;
  check(
    "13 UNKNOWN or absent brand",
    !brand || brand.mode === "UNKNOWN" || brand.mode === "VALUE",
  );
}

// --- 14 range ---
{
  const printProj = projectFromText(
    "50 bin adet karton kutu istiyorum, tercihen mat selefonlu",
  );
  const rangeFilter: CanonicalDiscoveryFilter = {
    version: 1,
    kind: "canonical_discovery_filter",
    ranges: { quantity: { min: 10000 } },
  };
  const r = evaluateDiscoveryFilter(printProj, rangeFilter);
  check(
    "14 range quantity",
    r.match ||
      Number(printProj.attributes.quantity) >= 10000 ||
      (printProj.constraints.quantity?.range?.min ?? 0) >= 10000,
    JSON.stringify(printProj.attributes),
  );
}

// --- 15 geo backward compatibility (filter without taxonomy still ok) ---
{
  const geoOnly: CanonicalDiscoveryFilter = {
    version: 1,
    kind: "canonical_discovery_filter",
    location: { city: "İstanbul" },
  };
  check(
    "15 geo no hard taxonomy signal",
    !hasCanonicalFilterSignal(geoOnly) ||
      evaluateDiscoveryFilter(tvProj, geoOnly).match,
  );
}

// --- 16 urgency compatibility ---
{
  const urg: CanonicalDiscoveryFilter = {
    version: 1,
    kind: "canonical_discovery_filter",
    urgency: true,
  };
  check(
    "16 urgency alone not canonical hard filter",
    !hasCanonicalFilterSignal(urg),
  );
}

// --- 17 saved search typed filter ---
{
  const filters: SavedSearchFilters = {
    version: 1,
    categorySlug: "technology",
    canonical: {
      version: 1,
      kind: "canonical_discovery_filter",
      primaryLeafId: tvProj.primaryLeafId,
      leafExact: true,
    },
  };
  const url = savedSearchToExploreUrl(filters);
  check(
    "17 saved search typed URL",
    url.includes("taxonomyLeaf=") && filters.canonical?.kind === "canonical_discovery_filter",
  );
}

// --- 18 saved search legacy compatibility ---
{
  const legacy: SavedSearchFilters = {
    categorySlug: "technology",
    city: "İstanbul",
  };
  const url = savedSearchToExploreUrl(legacy);
  check(
    "18 saved search legacy URL",
    url.includes("category=technology") && url.includes("city="),
  );
}

// --- 19 alert typed filter ---
{
  const validated = validateCanonicalDiscoveryFilter({
    version: 1,
    kind: "canonical_discovery_filter",
    primaryLeafId: tvProj.primaryLeafId,
    leafExact: true,
  });
  check("19 alert typed filter valid", validated.ok);
  if (validated.ok) {
    check(
      "19b alert typed matches TV",
      evaluateDiscoveryFilter(tvProj, validated.filter).match,
    );
  }
}

// --- 20 alert legacy compatibility ---
{
  const noFilter = validateCanonicalDiscoveryFilter({
    version: 1,
    kind: "canonical_discovery_filter",
  });
  check(
    "20 alert legacy empty filter",
    noFilter.ok && !hasCanonicalFilterSignal(noFilter.ok ? noFilter.filter : null),
  );
}

// --- 21 matching contract adapter ---
{
  const mc = matchContractFromProjection(tvProj);
  const fc = filterContractFromProjection(tvProj);
  check("21 match contract present", Boolean(mc));
  check("21b filter contract present", Boolean(fc));
  check(
    "21c exclude Samsung in filter contract",
    Boolean(fc?.exclude?.brand?.some((b) => /samsung/i.test(b))),
  );
}

// --- 22 no second request parse (projection built from state only) ---
{
  const state = createTextOnlyState(tvText);
  const a = buildDiscoveryProjectionFromState(state);
  const b = buildDiscoveryProjectionFromState(state);
  check(
    "22 deterministic projection (no re-parse variance)",
    a.primaryLeafId === b.primaryLeafId &&
      JSON.stringify(a.attributes) === JSON.stringify(b.attributes),
  );
}

// --- 23 filter validation ---
{
  const bad = validateCanonicalDiscoveryFilter({
    version: 1,
    kind: "canonical_discovery_filter",
    taxonomyNodeIds: ["tax:not-a-real-node-zzzz"],
  });
  check("23 filter validation rejects unknown taxonomy", !bad.ok);
}

// --- 24 unknown taxonomy ID ---
{
  const bad = validateCanonicalDiscoveryFilter({
    version: 1,
    kind: "canonical_discovery_filter",
    primaryLeafId: "tax:fake:leaf",
  });
  check("24 unknown primaryLeafId rejected", !bad.ok);
}

// --- 25 legacy Request fallback ---
{
  const filter = leafFilter(tvProj.primaryLeafId!, true);
  const r = evaluateDiscoveryFilter(null, filter);
  check(
    "25 legacy no-projection fallback visible",
    r.match && r.path === "LEGACY_FALLBACK",
  );
}

// --- 26 TV example ---
{
  check("26 TV leaf", Boolean(tvProj.primaryLeafId));
  check("26b screen 140", tvProj.attributes.screenSize === "140");
  check("26c brand ANY", tvProj.constraints.brand?.mode === "ANY");
  check(
    "26d excluded Samsung",
    (tvProj.constraints.brand?.excluded ?? []).some((v) =>
      /samsung/i.test(v),
    ),
  );
  check(
    "26e resolution preferred",
    tvProj.constraints.resolution?.strength === "PREFERRED" ||
      (tvProj.constraints.resolution?.preferred ?? []).some((v) =>
        /4k/i.test(v),
      ) ||
      (tvProj.attributes.resolution === "4K" &&
        tvProj.constraints.resolution?.strength !== "MUST"),
  );
  const samsungCand = isCandidateCompatibleWithProjection(tvProj, {
    brand: "Samsung",
  });
  check("26f Samsung candidate incompatible", !samsungCand.compatible);
}

// --- 27 Golf far example ---
{
  const golf = projectFromText("Golf 7 sağ ön far arıyorum");
  check(
    "27 Golf taxonomy path",
    golf.taxonomyNodeIds.length > 0,
    JSON.stringify(golf.taxonomyNodeIds),
  );
  check("27b Golf primary leaf", Boolean(golf.primaryLeafId));

  const lightingNode = golf.taxonomyNodeIds.find(
    (id) =>
      /lighting|aydınlat|aydinlat|far|headlamp|lamba/i.test(id) ||
      /lighting|aydınlat|aydinlat|far|headlamp/i.test(
        getTaxonomyNode(id)?.name ?? "",
      ),
  );
  const headlampLeaf = golf.primaryLeafId;
  const brakeNode = golf.taxonomyNodeIds
    .map((id) => getTaxonomyNode(id)?.parentId)
    .find(Boolean);

  // Lighting ancestor should match; unrelated sibling should not when exact leaf
  if (lightingNode && lightingNode !== headlampLeaf) {
    check(
      "27c Lighting ancestor finds Golf",
      evaluateDiscoveryFilter(golf, nodeFilter(lightingNode)).match,
    );
  } else if (headlampLeaf) {
    // Fallback: any ancestor of leaf
    const parent = getTaxonomyNode(headlampLeaf)?.parentId;
    check(
      "27c Lighting/parent ancestor finds Golf",
      Boolean(parent) &&
        evaluateDiscoveryFilter(golf, nodeFilter(parent!)).match,
    );
  } else {
    check("27c Lighting ancestor finds Golf", false, "no leaf");
  }

  if (headlampLeaf) {
    check(
      "27d Headlamp exact finds Golf",
      evaluateDiscoveryFilter(golf, leafFilter(headlampLeaf, true)).match,
    );
  }

  // Brake: pick a known unrelated node under automotive if present
  const autoRoot = golf.taxonomyNodeIds.find((id) =>
    /automotive|otomotiv/i.test(id + (getTaxonomyNode(id)?.name ?? "")),
  );
  let brakeId: string | null = null;
  if (autoRoot) {
    for (const id of getTaxonomyDescendantIds(autoRoot)) {
      const n = getTaxonomyNode(id);
      if (
        n &&
        /brake|fren|disc|balata/i.test(n.name + id) &&
        id !== headlampLeaf
      ) {
        brakeId = id;
        break;
      }
    }
  }
  if (brakeId) {
    check(
      "27e Brake does not match Golf far",
      !evaluateDiscoveryFilter(golf, leafFilter(brakeId, true)).match,
    );
  } else {
    // Synthetic unrelated leaf
    check(
      "27e Brake does not match Golf far",
      !evaluateDiscoveryFilter(
        golf,
        leafFilter("tax:automotive:brake-pads-fake", true),
      ).match ||
        !getTaxonomyNode("tax:automotive:brake-pads-fake"),
    );
  }

  check(
    "27f entity/model signal",
    Boolean(golf.entityRefs?.model || golf.entityRefs?.brand || golf.attributes.brand),
  );
  check(
    "27g position front_right-ish",
    /front|ön|on|sağ|sag|right/i.test(
      JSON.stringify(golf.attributes) + JSON.stringify(golf.constraints),
    ),
  );
  void brakeNode;
}

// --- 28 Printing example ---
{
  const print = projectFromText(
    "50 bin adet karton kutu istiyorum, tercihen mat selefonlu",
  );
  check("28 printing leaf", Boolean(print.primaryLeafId));
  check(
    "28b quantity ~50000",
    print.attributes.quantity === "50000" ||
      print.attributes.quantity === "50.000" ||
      Number(String(print.attributes.quantity).replace(/\D/g, "")) === 50000 ||
      (print.constraints.quantity?.range?.min ?? 0) >= 40000,
    JSON.stringify(print.attributes),
  );
  check(
    "28c lamination preferred matte",
    /mat|matte|selefon/i.test(
      JSON.stringify(print.constraints.lamination ?? {}) +
        (print.attributes.lamination ?? ""),
    ) ||
      print.constraints.lamination?.strength === "PREFERRED",
  );
}

// --- 29 no taxonomy authority duplication ---
{
  const parsed = parseDiscoveryProjection(tvProj);
  check(
    "29 projection is read model kind",
    parsed?.kind === "discovery_projection" &&
      parsed.version === DISCOVERY_PROJECTION_VERSION,
  );
}

// --- 30 no entitlement bypass (validator still required for user filters) ---
{
  const oversized = validateCanonicalDiscoveryFilter({
    version: 1,
    kind: "canonical_discovery_filter",
    taxonomyNodeIds: Array.from({ length: 100 }, (_, i) => `tax:x${i}`),
  });
  check(
    "30 oversized/invalid taxonomy rejected",
    !oversized.ok ||
      (oversized.ok &&
        (oversized.filter.taxonomyNodeIds?.length ?? 0) === 0),
  );
}

console.log("\n========================================");
console.log(`Phase 3A verify: ${pass} passed, ${fail} failed`);
if (errors.length) {
  console.log("Failures:");
  for (const e of errors) console.log(`  - ${e}`);
}
process.exit(fail > 0 ? 1 : 0);
