/**
 * Universal Master Taxonomy Full Category Coverage V1 — verification.
 * Run from apps/web: npx tsx scripts/verify-master-taxonomy-v1.ts
 */
import { REQUEST_CATEGORIES } from "../src/lib/request-category-engine";
import { subcategorySlug } from "../src/lib/knowledge/slug";
import {
  ensureAutomotiveCatalogRegistered,
  getAutomotiveIndexes,
} from "../src/lib/catalog";
import {
  getBrowseChildren,
  resolveRequestSchema,
} from "../src/lib/knowledge";
import {
  auditTaxonomyCoverage,
  ensureTaxonomyLoaded,
  getRootTaxonomyNodes,
  getSubcategoryTaxonomyNode,
  getTaxonomyChildren,
  getTaxonomyNode,
  getRequestSchemaForNode,
  listAllTaxonomyNodes,
  resolveTaxonomyAlias,
  resetTaxonomyRegistry,
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

resetTaxonomyRegistry();
ensureTaxonomyLoaded();
ensureAutomotiveCatalogRegistered();

const roots = getRootTaxonomyNodes();
const all = listAllTaxonomyNodes();
const report = auditTaxonomyCoverage();

console.log("\n=== Coverage report ===");
console.log(
  JSON.stringify(
    {
      nodeCount: report.nodeCount,
      leafCount: report.leafCount,
      maxDepth: report.maxDepth,
      avgDepth: report.avgDepth,
      aliasCount: report.aliasCount,
      requestSchemaCoverage: report.requestSchemaCoverage,
      emptyParents: report.emptyParents.length,
      orphans: report.orphans.length,
      cycles: report.cycles.length,
      duplicateCanonical: report.duplicateCanonical.length,
      aliasCollisions: report.aliasCollisions.length,
      shallowBranches: report.shallowBranches.length,
      scores: report.scores,
      perDomain: report.perDomain,
    },
    null,
    2,
  ),
);

// §31 — 11 roots
check("11 taxonomy category roots", roots.length === 11, String(roots.length));
check(
  "roots match REQUEST_CATEGORIES ids",
  REQUEST_CATEGORIES.every((c) => roots.some((r) => r.categoryId === c.id)),
);

const expectedSubcats = REQUEST_CATEGORIES.reduce(
  (n, cat) => n + cat.subcategories.length,
  0,
);
let subOk = 0;
for (const cat of REQUEST_CATEGORIES) {
  for (const label of cat.subcategories) {
    const slug = subcategorySlug(label);
    const node = getSubcategoryTaxonomyNode(cat.id, slug);
    if (node && getTaxonomyChildren(node.id).length > 0) subOk += 1;
  }
}
check(
  "every engine subcategory has taxonomy children",
  subOk === expectedSubcats,
  `${subOk}/${expectedSubcats}`,
);

check("no orphans", report.orphans.length === 0, report.orphans.slice(0, 5).join(","));
check("no cycles", report.cycles.length === 0, report.cycles.slice(0, 5).join(","));
check(
  "no empty parents",
  report.emptyParents.length === 0,
  report.emptyParents.slice(0, 8).join(","),
);
check(
  "no duplicate canonical under same parent",
  report.duplicateCanonical.length === 0,
  JSON.stringify(report.duplicateCanonical.slice(0, 3)),
);

check("substantial node count (>= 800)", report.nodeCount >= 800, String(report.nodeCount));
check("substantial leaf count (>= 400)", report.leafCount >= 400, String(report.leafCount));
check("alias count (> 100)", report.aliasCount > 100, String(report.aliasCount));
check(
  "schema coverage > 0.8",
  report.requestSchemaCoverage >= 0.8,
  String(report.requestSchemaCoverage),
);

// Per-domain presence
for (const cat of REQUEST_CATEGORIES) {
  const d = report.perDomain[cat.id];
  check(
    `domain ${cat.id} has nodes`,
    Boolean(d && d.nodeCount > 5),
    d ? String(d.nodeCount) : "missing",
  );
  check(
    `domain ${cat.id} subcategory coverage 1.0`,
    Boolean(d && d.subcategoryCoverage === 1),
    d ? String(d.subcategoryCoverage) : "missing",
  );
}

// Automotive spare deep
const spare = getSubcategoryTaxonomyNode("automotive", "yedek-parca");
const spareLeaves = all.filter(
  (n) =>
    n.categoryId === "automotive" &&
    n.subcategoryId === "yedek-parca" &&
    getTaxonomyChildren(n.id).length === 0,
);
check("automotive spare subcategory exists", Boolean(spare));
check(
  "automotive spare leaves deep (>= 200)",
  spareLeaves.length >= 200,
  String(spareLeaves.length),
);

// Catalog system id alignment
const idx = getAutomotiveIndexes();
const systemIds = new Set(idx.parts.map((p) => p.systemId));
const taxSystems = all.filter(
  (n) =>
    n.categoryId === "automotive" &&
    n.catalogSystemId &&
    n.nodeType === "GROUP" &&
    n.depth === 2,
);
const aligned = taxSystems.filter((n) => systemIds.has(n.catalogSystemId!));
check(
  "taxonomy part systems align with catalog",
  aligned.length >= Math.min(systemIds.size, 10),
  `aligned=${aligned.length} catalogSystems=${systemIds.size}`,
);

// Alias samples (free-text)
const aliasSamples: Array<{ term: string; categoryId?: string; expect?: string }> = [
  { term: "mikro oluklu kutu", categoryId: "printing" },
  { term: "CNC torna", categoryId: "machinery" },
  { term: "split klima", categoryId: "appliances" },
  { term: "akıllı telefon", categoryId: "technology" },
  { term: "evden eve nakliyat", categoryId: "services" },
  { term: "eviye", categoryId: "home-kitchen" },
  { term: "ön far", categoryId: "automotive" },
  { term: "nitrile glove", categoryId: "health" },
  { term: "travel system", categoryId: "baby" },
  { term: "forklift", categoryId: "machinery" },
];
for (const s of aliasSamples) {
  const hit = resolveTaxonomyAlias(s.term, s.categoryId);
  check(
    `alias resolve "${s.term}"`,
    Boolean(hit?.node),
    hit ? hit.node.canonicalName : "no hit",
  );
}

// Browse integration — non-entity
const printKids = getBrowseChildren("printing/karton-kutu", {
  categoryId: "printing",
  subcategorySlug: "karton-kutu",
});
check(
  "browse printing/karton-kutu has taxonomy children",
  printKids.length >= 2,
  String(printKids.length),
);
if (printKids[0]) {
  const deeper = getBrowseChildren(printKids[0]!.id, {
    categoryId: "printing",
    subcategorySlug: "karton-kutu",
  });
  check(
    "browse taxonomy group has children",
    deeper.length >= 1,
    String(deeper.length),
  );
}

const furnKids = getBrowseChildren("furniture/ofis-sandalyesi", {
  categoryId: "furniture",
  subcategorySlug: "ofis-sandalyesi",
});
check("browse furniture taxonomy", furnKids.length >= 1, String(furnKids.length));

const svcKids = getBrowseChildren("services/nakliye", {
  categoryId: "services",
  subcategorySlug: "nakliye",
});
check("browse services taxonomy", svcKids.length >= 1, String(svcKids.length));

const machKids = getBrowseChildren("machinery/uretim-makinesi", {
  categoryId: "machinery",
  subcategorySlug: "uretim-makinesi",
});
check("browse machinery taxonomy fallback", machKids.length >= 1, String(machKids.length));

// Automotive browse brands still work (ENTITY path)
const brandKids = getBrowseChildren("automotive/yedek-parca", {
  categoryId: "automotive",
  subcategorySlug: "yedek-parca",
});
check(
  "automotive spare still browses brands",
  brandKids.length > 10 && brandKids.every((b) => b.kind === "brand"),
  `count=${brandKids.length} kind0=${brandKids[0]?.kind}`,
);

// Schema bridge
const leaf = spareLeaves[0];
if (leaf) {
  const schema = getRequestSchemaForNode(leaf.id);
  check(
    "getRequestSchemaForNode on spare leaf",
    Boolean(schema && schema.fields.length > 0),
    schema ? String(schema.fields.length) : "null",
  );
}

const boxSchema = resolveRequestSchema({
  categoryId: "printing",
  subcategorySlug: "karton-kutu",
});
check(
  "printing/karton-kutu schema has boxType or productType",
  boxSchema.fields.some((f) => f.key === "boxType" || f.key === "productType" || f.key === "dimensions"),
  boxSchema.fields.map((f) => f.key).slice(0, 8).join(","),
);

// Diğer is a residual bucket after pillar expansion — a single catch-all leaf is valid.
for (const dep of report.otherDependency) {
  check(
    `${dep.categoryId} Diğer residual bucket reachable`,
    dep.leafCount >= 1,
    String(dep.leafCount),
  );
}

// Pillar expansion must not drop former appliances-Diğer dump products.
for (const term of ["derin dondurucu", "su sebili", "şofben"]) {
  const hit = resolveTaxonomyAlias(term, "appliances");
  check(
    `appliances still resolves ${term}`,
    Boolean(hit?.node && hit.node.categoryId === "appliances"),
    hit?.node?.id ?? "missing",
  );
}

// Kitchen/bath mapping note — eviye under home-kitchen
const eviye = resolveTaxonomyAlias("eviye", "home-kitchen");
check(
  "kitchen/bath eviye under home-kitchen",
  Boolean(eviye && eviye.node.categoryId === "home-kitchen"),
);

// Scores not fake 100%
check("structural score < 1", report.scores.structural < 1);
check("leaf score <= 0.95", report.scores.leaf <= 0.95);

console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
if (fail > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
