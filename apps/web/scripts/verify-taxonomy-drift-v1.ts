/**
 * Taxonomy / REQUEST_CATEGORIES drift detector (Phase 1).
 * Does not mutate categories — fails when counts or parent refs diverge.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { REQUEST_CATEGORIES } from "../src/lib/request-category-engine";
import { subcategorySlug } from "../src/lib/knowledge/slug";
import {
  getTaxonomyNode,
  listAllTaxonomyNodes,
} from "../src/lib/taxonomy";

type Check = { name: string; pass: boolean; detail?: string };

const checks: Check[] = [];

function check(name: string, pass: boolean, detail?: string) {
  checks.push({ name, pass, detail });
  const mark = pass ? "PASS" : "FAIL";
  console.log(`${mark} — ${name}${detail ? ` (${detail})` : ""}`);
}

const roots = REQUEST_CATEGORIES.length;
const subcats = REQUEST_CATEGORIES.reduce(
  (n, c) => n + c.subcategories.length,
  0,
);

check("REQUEST_CATEGORIES root count is 11", roots === 11, `got ${roots}`);
check(
  "REQUEST_CATEGORIES subcategory count is 58",
  subcats === 58,
  `got ${subcats}`,
);

const rootIds = REQUEST_CATEGORIES.map((c) => c.id);
check(
  "root category slugs unique",
  new Set(rootIds).size === rootIds.length,
);

const diggerParents: string[] = [];
for (const cat of REQUEST_CATEGORIES) {
  const slugs = cat.subcategories.map((label) => subcategorySlug(label));
  const unique = new Set(slugs);
  check(
    `subcategory slugs unique under ${cat.id}`,
    unique.size === slugs.length,
    `${slugs.length} labels / ${unique.size} unique`,
  );
  if (slugs.includes("diger")) diggerParents.push(cat.id);
}
check(
  "Diğer (diger) appears under multiple parents (documented collision risk)",
  diggerParents.length === REQUEST_CATEGORIES.length,
  `parents=${diggerParents.length}`,
);

const manifestPath = path.resolve(
  process.cwd(),
  "../../data/taxonomy/manifest.json",
);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
  domains: Array<{ id: string }>;
  notes?: string[];
};
const domainIds = manifest.domains.map((d) => d.id).sort();
const engineIds = [...rootIds].sort();
check(
  "manifest domains match REQUEST_CATEGORIES ids",
  JSON.stringify(domainIds) === JSON.stringify(engineIds),
  `manifest=${domainIds.length} engine=${engineIds.length}`,
);
check(
  "manifest notes do not claim 11/59",
  !(manifest.notes ?? []).some((n) => /11\/59/.test(n)),
);

const nodes = listAllTaxonomyNodes();
check("taxonomy has nodes", nodes.length > 0, `count=${nodes.length}`);

let orphanParents = 0;
let missingDomain = 0;
for (const node of nodes) {
  if (node.depth === 0) continue;
  if (node.parentId && !getTaxonomyNode(node.parentId)) orphanParents += 1;
  if (
    node.categoryId &&
    !REQUEST_CATEGORIES.some((c) => c.id === node.categoryId)
  ) {
    missingDomain += 1;
  }
}
check("no orphan taxonomy parents", orphanParents === 0, `orphans=${orphanParents}`);
check(
  "taxonomy categoryId maps to engine roots",
  missingDomain === 0,
  `mismatches=${missingDomain}`,
);

const failed = checks.filter((c) => !c.pass);
console.log(`\nTaxonomy drift: ${checks.length - failed.length}/${checks.length} PASS`);
if (failed.length) {
  process.exitCode = 1;
}
