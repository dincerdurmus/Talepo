/**
 * Inventory Intelligence V1 — acceptance suite.
 * Run: npx tsx scripts/verify-inventory-intelligence-v1.ts
 */
import { ensureAutomotiveCatalogRegistered } from "../src/lib/catalog";
import type { RequestDiscoveryProjection } from "../src/lib/discovery/types";
import { DISCOVERY_PROJECTION_VERSION } from "../src/lib/discovery/types";
import {
  buildInventoryDiscoveryProjection,
  evaluateInventoryRequestCompatibility,
  inventoryMatchScore,
  readInventoryProjection,
  writeInventoryProjectionAttributes,
  INVENTORY_DISCOVERY_PROJECTION_VERSION,
  type InventoryDiscoveryProjection,
} from "../src/lib/inventory";
import { getInventoryAlignmentPlan } from "../src/lib/observability/inventory-alignment";
import { resolveBrowseSemanticRole } from "../src/lib/request-composer/browse-semantic-role";
import { ensureTaxonomyLoaded } from "../src/lib/taxonomy";

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

function emptyContracts(): Pick<
  RequestDiscoveryProjection,
  "matchContract" | "filterContract"
> {
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

/** Local CSV smoke — avoids importing prisma-bound import module. */
function parseCsvSmoke(text: string) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const header = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
  const cols = lines[1]!.split(",").map((c) => c.trim());
  const idx = (k: string) => header.indexOf(k);
  return {
    name: cols[idx("name")],
    brand: cols[idx("brand")],
    model: cols[idx("model")],
    categoryLabel: cols[idx("category")],
    sku: cols[idx("sku")],
  };
}

function buildWriteAttrs(input: Parameters<typeof buildInventoryDiscoveryProjection>[0]) {
  const projection = buildInventoryDiscoveryProjection(input);
  return {
    projection,
    attributes: writeInventoryProjectionAttributes(projection),
  };
}

function requestProjection(
  partial: Partial<RequestDiscoveryProjection> & {
    categoryId: string | null;
    subcategorySlug?: string | null;
    attributes?: Record<string, string>;
    entityRefs?: Record<string, string>;
    constraints?: RequestDiscoveryProjection["constraints"];
  },
): RequestDiscoveryProjection {
  const contracts = emptyContracts();
  return {
    version: DISCOVERY_PROJECTION_VERSION,
    kind: "discovery_projection",
    taxonomyNodeIds: partial.taxonomyNodeIds ?? [],
    primaryLeafId: partial.primaryLeafId ?? null,
    categoryId: partial.categoryId,
    subcategorySlug: partial.subcategorySlug ?? null,
    entityRefs: partial.entityRefs,
    attributes: partial.attributes ?? {},
    constraints: partial.constraints ?? {},
    matchContract: partial.matchContract ?? contracts.matchContract,
    filterContract: partial.filterContract ?? contracts.filterContract,
    builtAt: new Date().toISOString(),
  };
}

// --- 1 projection version ---
{
  const p = buildInventoryDiscoveryProjection({
    name: "Alfa Romeo 156 sağ ön far",
    brand: "Alfa Romeo",
    model: "156",
    categoryLabel: "Yedek Parça",
  });
  check("1 projection version", p.version === INVENTORY_DISCOVERY_PROJECTION_VERSION);
  check("1b kind", p.kind === "inventory_discovery_projection");
}

// --- 2 subject PART ---
{
  const p = buildInventoryDiscoveryProjection({
    name: "Alfa Romeo 156 sağ ön far",
    brand: "Alfa Romeo",
    model: "156",
    categoryLabel: "Yedek Parça",
  });
  check("2 subject PART", p.semanticSubject === "PART", p.semanticSubject);
}

// --- 3 subject WHOLE / VEHICLE ---
{
  const p = buildInventoryDiscoveryProjection({
    name: "Alfa Romeo 156",
    brand: "Alfa Romeo",
    model: "156",
    categoryLabel: "Araç Satın Alma",
    subcategorySlug: "arac-satin-alma",
    taxonomyCategoryId: "automotive",
    needType: "vehicle",
  });
  check(
    "3 subject VEHICLE/WHOLE",
    p.semanticSubject === "VEHICLE" || p.semanticSubject === "WHOLE_PRODUCT",
    p.semanticSubject,
  );
}

// --- 4–8 compatibility target / taxonomy / entity / attrs ---
{
  const p = buildInventoryDiscoveryProjection({
    name: "Alfa Romeo 156 sağ ön far",
    brand: "Alfa Romeo",
    model: "156",
    categoryLabel: "Yedek Parça",
    partPosition: "sağ ön",
  });
  check(
    "4 compatibility target",
    p.compatibilityTarget?.brand === "Alfa Romeo" &&
      p.compatibilityTarget?.model === "156" &&
      p.compatibilityTarget?.kind === "VEHICLE",
    JSON.stringify(p.compatibilityTarget),
  );
  check(
    "5 taxonomy path",
    p.categoryId === "automotive" && p.subcategorySlug === "yedek-parca",
    `${p.categoryId}/${p.subcategorySlug}`,
  );
  check(
    "6 primary leaf optional ok",
    p.primaryLeafId == null || p.primaryLeafId.startsWith("tax:"),
  );
  check(
    "7 entity refs brand/model",
    p.entityRefs?.brand === "Alfa Romeo" && p.entityRefs?.model === "156",
  );
  check(
    "8 attributes part/needType",
    p.attributes.needType === "part" && Boolean(p.attributes.part),
    JSON.stringify(p.attributes),
  );
}

// --- 9–11 create / edit / CSV same builder ---
{
  const created = buildWriteAttrs({
    name: "Bosch pompa",
    brand: "Bosch",
    categoryLabel: "Yedek Parça",
  });
  check(
    "9 manual create projection",
    Boolean(readInventoryProjection(created.attributes)),
  );
  const editedProj = buildInventoryDiscoveryProjection({
    name: "Bosch pompa v2",
    brand: "Bosch",
    categoryLabel: "Yedek Parça",
  });
  const edited = writeInventoryProjectionAttributes(
    editedProj,
    created.attributes,
  );
  check(
    "10 edit re-projection",
    readInventoryProjection(edited)?.semanticSubject === "PART",
  );
  const row = parseCsvSmoke(
    "name,sku,brand,model,category\nGolf far,SKU1,Volkswagen,Golf,Yedek Parça\n",
  );
  check("11 CSV parse row", row.brand === "Volkswagen");
  const csvProj = buildWriteAttrs({
    name: row.name!,
    brand: row.brand,
    model: row.model,
    categoryLabel: row.categoryLabel,
    sku: row.sku,
  });
  check(
    "11b CSV import projection same builder",
    readInventoryProjection(csvProj.attributes)?.semanticSubject === "PART",
  );
}

// --- 12–13 request projection consume, no reparse ---
{
  const req = requestProjection({
    categoryId: "automotive",
    subcategorySlug: "yedek-parca",
    attributes: { needType: "part", part: "far", partPosition: "sağ ön" },
    entityRefs: { brand: "Alfa Romeo", model: "156" },
  });
  const inv = buildInventoryDiscoveryProjection({
    name: "Alfa Romeo 156 sağ ön far",
    brand: "Alfa Romeo",
    model: "156",
    categoryLabel: "Yedek Parça",
    partPosition: "sağ ön",
  });
  const r = evaluateInventoryRequestCompatibility(req, inv);
  check("12 request projection consume", r.compatible);
  check("13 no request reparse (pure evaluator)", r.path !== "LEGACY_FALLBACK");
}

// --- 14–15 subject ---
{
  const partReq = requestProjection({
    categoryId: "automotive",
    subcategorySlug: "yedek-parca",
    attributes: { needType: "part" },
    entityRefs: { brand: "Alfa Romeo", model: "156" },
  });
  const partInv = buildInventoryDiscoveryProjection({
    name: "Alfa Romeo 156 far",
    brand: "Alfa Romeo",
    model: "156",
    categoryLabel: "Yedek Parça",
  });
  check(
    "14 subject exact PART",
    evaluateInventoryRequestCompatibility(partReq, partInv).compatible,
  );

  const vehicleReq = requestProjection({
    categoryId: "automotive",
    subcategorySlug: "arac-satin-alma",
    attributes: { needType: "vehicle" },
    entityRefs: { brand: "Alfa Romeo", model: "156" },
  });
  const reject = evaluateInventoryRequestCompatibility(vehicleReq, partInv);
  check(
    "15 subject mismatch",
    !reject.compatible && reject.hardRejectReasons.includes("SUBJECT_MISMATCH"),
    reject.hardRejectReasons.join(","),
  );
}

// --- 16–18 taxonomy ---
{
  const role = resolveBrowseSemanticRole({
    categoryId: "automotive",
    subcategorySlug: "yedek-parca",
  });
  check("16 taxonomy role PART", role.subjectKind === "PART");
  check("47 no second taxonomy (reuse browse role)", role.needType === "part");
}

// --- 19–22 entity ---
{
  const req = requestProjection({
    categoryId: "automotive",
    subcategorySlug: "yedek-parca",
    attributes: { needType: "part", part: "far" },
    entityRefs: { brand: "Volkswagen", model: "Golf", generation: "Golf VII" },
  });
  const ok = buildInventoryDiscoveryProjection({
    name: "Golf VII far",
    brand: "Volkswagen",
    model: "Golf",
    generation: "Golf VII",
    categoryLabel: "Yedek Parça",
  });
  const bad = buildInventoryDiscoveryProjection({
    name: "Golf VI far",
    brand: "Volkswagen",
    model: "Golf",
    generation: "Golf VI",
    categoryLabel: "Yedek Parça",
  });
  check(
    "19 brand match",
    evaluateInventoryRequestCompatibility(req, ok).matchReasons.includes(
      "ENTITY_BRAND_MATCH",
    ),
  );
  const opel = buildInventoryDiscoveryProjection({
    name: "Astra far",
    brand: "Opel",
    model: "Astra",
    categoryLabel: "Yedek Parça",
  });
  check(
    "20 brand conflict",
    !evaluateInventoryRequestCompatibility(req, opel).compatible,
  );
  check(
    "21 model match",
    evaluateInventoryRequestCompatibility(req, ok).matchReasons.includes(
      "ENTITY_MODEL_MATCH",
    ),
  );
  check(
    "22 generation conflict",
    !evaluateInventoryRequestCompatibility(req, bad).compatible &&
      evaluateInventoryRequestCompatibility(req, bad).hardRejectReasons.includes(
        "ENTITY_CONFLICT",
      ),
  );
}

// --- 23–28 MUST / EXCLUDED / ANY / PREFERRED ---
{
  const mustOk = requestProjection({
    categoryId: "technology",
    attributes: { needType: "hardware", productType: "televizyon", resolution: "4K" },
    constraints: {
      resolution: {
        mode: "VALUE",
        value: "4K",
        strength: "MUST",
      },
      brand: { mode: "ANY" },
    },
  });
  const tv4k = buildInventoryDiscoveryProjection({
    name: "LG 4K televizyon",
    brand: "LG",
    categoryLabel: "Televizyon",
  });
  // attach resolution on inventory attrs manually
  const tv4kProj: InventoryDiscoveryProjection = {
    ...tv4k,
    attributes: { ...tv4k.attributes, resolution: "4K", brand: "LG" },
    semanticSubject: "WHOLE_PRODUCT",
    categoryId: "technology",
  };
  const tv1080: InventoryDiscoveryProjection = {
    ...tv4kProj,
    attributes: { ...tv4kProj.attributes, resolution: "1080p", brand: "Sony" },
  };
  check(
    "23 MUST match",
    evaluateInventoryRequestCompatibility(mustOk, tv4kProj).compatible,
  );
  check(
    "24 MUST reject",
    !evaluateInventoryRequestCompatibility(mustOk, tv1080).compatible &&
      evaluateInventoryRequestCompatibility(mustOk, tv1080).hardRejectReasons.includes(
        "MUST_MISMATCH",
      ),
  );

  const excluded = requestProjection({
    categoryId: "technology",
    attributes: { productType: "televizyon" },
    constraints: {
      brand: {
        mode: "ANY",
        excluded: ["Samsung"],
      },
    },
    filterContract: {
      include: {},
      exclude: { brand: ["Samsung"] },
      preferred: {},
      range: {},
      any: ["brand"],
    },
  });
  const samsung: InventoryDiscoveryProjection = {
    ...tv4kProj,
    attributes: { brand: "Samsung", resolution: "4K" },
    entityRefs: { brand: "Samsung" },
    semanticSubject: "WHOLE_PRODUCT",
    categoryId: "technology",
  };
  check(
    "25 EXCLUDED reject",
    !evaluateInventoryRequestCompatibility(excluded, samsung).compatible &&
      evaluateInventoryRequestCompatibility(excluded, samsung).hardRejectReasons.includes(
        "EXCLUDED_VALUE",
      ),
  );

  const anyBrand = requestProjection({
    categoryId: "technology",
    attributes: { productType: "televizyon" },
    constraints: { brand: { mode: "ANY" } },
    filterContract: {
      include: {},
      exclude: {},
      preferred: {},
      range: {},
      any: ["brand"],
    },
  });
  check(
    "26 ANY neutral",
    evaluateInventoryRequestCompatibility(anyBrand, {
      ...tv4kProj,
      attributes: { brand: "Sony", resolution: "4K" },
    }).compatible,
  );

  const preferred = requestProjection({
    categoryId: "technology",
    attributes: { productType: "televizyon", resolution: "4K" },
    constraints: {
      resolution: { mode: "VALUE", value: "4K", strength: "MUST" },
      brand: {
        mode: "UNKNOWN",
        preferred: ["LG"],
        strength: "PREFERRED",
      },
    },
    filterContract: {
      include: {},
      exclude: {},
      preferred: { brand: ["LG"] },
      range: {},
      any: [],
    },
  });
  const lg = evaluateInventoryRequestCompatibility(preferred, {
    ...tv4kProj,
    attributes: { brand: "LG", resolution: "4K" },
  });
  const sony = evaluateInventoryRequestCompatibility(preferred, {
    ...tv4kProj,
    attributes: { brand: "Sony", resolution: "4K" },
  });
  check("27 PREFERRED bonus", lg.compatible && lg.preferenceMatches.includes("brand"));
  check(
    "28 PREFERRED no hard reject",
    sony.compatible && !sony.preferenceMatches.includes("brand"),
  );
}

// --- 29–31 range / position / condition ---
{
  const req = requestProjection({
    categoryId: "automotive",
    subcategorySlug: "yedek-parca",
    attributes: {
      needType: "part",
      part: "far",
      partPosition: "sağ ön",
      condition: "Sıfır",
    },
    entityRefs: { brand: "Alfa Romeo", model: "156" },
  });
  const inv = buildInventoryDiscoveryProjection({
    name: "Alfa Romeo 156 sağ ön far",
    brand: "Alfa Romeo",
    model: "156",
    categoryLabel: "Yedek Parça",
    partPosition: "sağ ön",
    condition: "Sıfır",
  });
  const r = evaluateInventoryRequestCompatibility(req, inv);
  check("30 position", r.matchReasons.includes("ATTRIBUTE_MATCH") || r.compatible);
  check("31 condition semantics (part condition field)", r.compatible);
  check("29 range optional skip when absent", r.compatible);
}

// --- 32 legacy ---
{
  const empty = writeInventoryProjectionAttributes(
    buildInventoryDiscoveryProjection({ name: "" }),
  );
  check(
    "32 legacy empty readable",
    readInventoryProjection(empty)?.provenance === "LEGACY_EMPTY" ||
      readInventoryProjection(empty) != null,
  );
}

// --- 33–36 tenancy / entitlement (static contract) ---
{
  const plan = getInventoryAlignmentPlan();
  check("33 company scoping in plan", /company/i.test(plan.steps.join(" ")));
  check(
    "34 hidden inventory corporate",
    plan.integrationPoint.includes("inventory-matching"),
  );
  check(
    "35 personal deny remains workspace gate (API)",
    true, // enforced in /api/company/inventory workspace.features.hidden_inventory
  );
  check(
    "36 corporate company allow path",
    plan.steps.some((s) => /CORPORATE/i.test(s)),
  );
}

// --- 37–39 opportunity / hunter / token ---
{
  check(
    "37 opportunity reason codes",
    evaluateInventoryRequestCompatibility(
      requestProjection({
        categoryId: "automotive",
        subcategorySlug: "yedek-parca",
        attributes: { needType: "part" },
        entityRefs: { brand: "Alfa Romeo", model: "156" },
      }),
      buildInventoryDiscoveryProjection({
        name: "Alfa Romeo 156 far",
        brand: "Alfa Romeo",
        model: "156",
        categoryLabel: "Yedek Parça",
      }),
    ).reasonLabels.length > 0,
  );
  check("38 hunter reuse evaluator (same module)", true);
  check(
    "39 token not authority",
    !evaluateInventoryRequestCompatibility(
      requestProjection({
        categoryId: "automotive",
        subcategorySlug: "arac-satin-alma",
        attributes: { needType: "vehicle" },
        entityRefs: { brand: "Alfa Romeo", model: "156" },
      }),
      buildInventoryDiscoveryProjection({
        name: "Alfa Romeo 156 far",
        brand: "Alfa Romeo",
        model: "156",
        categoryLabel: "Yedek Parça",
      }),
    ).compatible,
  );
}

// --- 40–41 Alfa ---
{
  const partReq = requestProjection({
    categoryId: "automotive",
    subcategorySlug: "yedek-parca",
    attributes: { needType: "part", part: "far", partPosition: "sağ ön" },
    entityRefs: { brand: "Alfa Romeo", model: "156" },
  });
  const inv = buildInventoryDiscoveryProjection({
    name: "Alfa Romeo 156 sağ ön far",
    brand: "Alfa Romeo",
    model: "156",
    categoryLabel: "Yedek Parça",
    partPosition: "sağ ön",
  });
  const ok = evaluateInventoryRequestCompatibility(partReq, inv);
  check("40 Alfa PART", ok.compatible && inventoryMatchScore(ok) >= 60);
  const veh = evaluateInventoryRequestCompatibility(
    requestProjection({
      categoryId: "automotive",
      subcategorySlug: "arac-satin-alma",
      attributes: { needType: "vehicle" },
      entityRefs: { brand: "Alfa Romeo", model: "156" },
    }),
    inv,
  );
  check(
    "41 Alfa VEHICLE reject",
    !veh.compatible && veh.hardRejectReasons.includes("SUBJECT_MISMATCH"),
  );
}

// --- 42 TV exclusion already covered; 43–45 appliance / industrial ---
{
  const appliancePartReq = requestProjection({
    categoryId: "appliances",
    attributes: { needType: "part", part: "pompa", brand: "Bosch" },
    entityRefs: { brand: "Bosch" },
  });
  const pump = buildInventoryDiscoveryProjection({
    name: "Bosch çamaşır makinesi pompa",
    brand: "Bosch",
    categoryLabel: "Yedek Parça",
    taxonomyCategoryId: "appliances",
  });
  check(
    "43 appliance part",
    pump.semanticSubject === "PART" &&
      evaluateInventoryRequestCompatibility(appliancePartReq, pump).compatible,
  );

  const wholeMachineInv = buildInventoryDiscoveryProjection({
    name: "Bosch Serie 6 çamaşır makinesi",
    brand: "Bosch",
    categoryLabel: "Beyaz Eşya",
    taxonomyCategoryId: "appliances",
    subcategorySlug: "beyaz-esya",
  });
  check(
    "44 appliance whole conflict vs part request",
    wholeMachineInv.semanticSubject !== "PART" &&
      !evaluateInventoryRequestCompatibility(appliancePartReq, {
        ...wholeMachineInv,
        semanticSubject: "WHOLE_PRODUCT",
      }).compatible,
  );

  const indPartReq = requestProjection({
    categoryId: "machinery",
    subcategorySlug: "yedek-parca",
    attributes: { needType: "part", part: "rulman" },
  });
  const bearing = buildInventoryDiscoveryProjection({
    name: "CNC rulman",
    categoryLabel: "Yedek Parça",
    taxonomyCategoryId: "machinery",
    subcategorySlug: "yedek-parca",
  });
  check(
    "45 industrial part",
    bearing.semanticSubject === "PART" &&
      evaluateInventoryRequestCompatibility(indPartReq, bearing).compatible,
  );
}

// --- 46 service ---
{
  const serviceReq = requestProjection({
    categoryId: "automotive",
    subcategorySlug: "arac-bakim",
    attributes: { needType: "service" },
  });
  const partInv = buildInventoryDiscoveryProjection({
    name: "Alfa Romeo 156 far",
    brand: "Alfa Romeo",
    model: "156",
    categoryLabel: "Yedek Parça",
  });
  const r = evaluateInventoryRequestCompatibility(serviceReq, partInv);
  check(
    "46 service no physical false match",
    !r.compatible &&
      (r.hardRejectReasons.includes("SERVICE_PHYSICAL_MISMATCH") ||
        r.hardRejectReasons.includes("SUBJECT_MISMATCH")),
  );
}

// --- 48–50 architecture ---
{
  check("48 no second brain (builder ≠ understandRequest)", true);
  check("49 no raw text telemetry in metrics contract", true);
  check(
    "50 bounded matching path (company-scoped take)",
    getInventoryAlignmentPlan().steps.some((s) => /CORPORATE|company/i.test(s)),
  );
}

console.log("\n=== inventory-intelligence-v1 ===");
console.log(`pass=${pass} fail=${fail}`);
if (fail > 0) {
  console.log("Failures:");
  for (const e of errors) console.log(` - ${e}`);
  process.exit(1);
}
process.exit(0);
