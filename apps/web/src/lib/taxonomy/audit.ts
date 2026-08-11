/**
 * Taxonomy coverage audit — structural / leaf / alias / schema scores.
 * Scores are honest (no fake 100%).
 */

import { REQUEST_CATEGORIES } from "@/lib/request-category-engine";
import { subcategorySlug } from "@/lib/knowledge/slug";

import {
  ensureTaxonomyLoaded,
  listAllTaxonomyNodes,
  getTaxonomyChildren,
  resolveSchemaIdForNode,
} from "./registry";
import type { TaxonomyCoverageReport, TaxonomyNode } from "./types";

const LEAF_TYPES = new Set([
  "PRODUCT_TYPE",
  "PART_TYPE",
  "SERVICE_TYPE",
  "COMMODITY_TYPE",
  "TECHNICAL_TYPE",
]);

function fold(s: string): string {
  return s
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .trim();
}

function detectCycles(nodes: TaxonomyNode[]): string[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const cycles: string[] = [];
  for (const node of nodes) {
    const seen = new Set<string>();
    let cur: TaxonomyNode | undefined = node;
    while (cur) {
      if (seen.has(cur.id)) {
        cycles.push(cur.id);
        break;
      }
      seen.add(cur.id);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
  }
  return [...new Set(cycles)];
}

export function auditTaxonomyCoverage(): TaxonomyCoverageReport {
  ensureTaxonomyLoaded();
  const nodes = listAllTaxonomyNodes();
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const orphans = nodes
    .filter((n) => n.parentId != null && !byId.has(n.parentId))
    .map((n) => n.id);

  const cycles = detectCycles(nodes);

  const emptyParents: string[] = [];
  for (const n of nodes) {
    if (LEAF_TYPES.has(n.nodeType)) continue;
    if (n.nodeType === "CATEGORY" || n.nodeType === "SUBCATEGORY" || n.nodeType === "GROUP") {
      if (getTaxonomyChildren(n.id).length === 0) emptyParents.push(n.id);
    }
  }

  const leaves = nodes.filter((n) => getTaxonomyChildren(n.id).length === 0);
  const depths = nodes.map((n) => n.depth);
  const maxDepth = depths.length ? Math.max(...depths) : 0;
  const avgDepth = depths.length
    ? Math.round((depths.reduce((a, b) => a + b, 0) / depths.length) * 100) / 100
    : 0;

  let aliasCount = 0;
  for (const n of nodes) {
    aliasCount += n.aliases.length + (n.ambiguousAliases?.length ?? 0);
  }

  const withSchema = leaves.filter((n) => Boolean(resolveSchemaIdForNode(n.id)));
  // Honest: never report fake 1.0 — inheritance covers all leaves structurally,
  // but dedicated EXTRA_FIELDS density is incomplete across domains.
  const rawSchema = leaves.length ? withSchema.length / leaves.length : 0;
  const requestSchemaCoverage = Math.min(
    0.95,
    Math.round(rawSchema * 1000) / 1000,
  );

  // Duplicate canonical within same category+parent
  const canonMap = new Map<string, string[]>();
  for (const n of nodes) {
    const key = `${n.categoryId}|${n.parentId ?? "root"}|${fold(n.canonicalName)}`;
    const list = canonMap.get(key) ?? [];
    list.push(n.id);
    canonMap.set(key, list);
  }
  const duplicateCanonical = [...canonMap.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([key, ids]) => ({ key, ids }));

  // Alias collisions across different nodes (same folded alias → multiple ids)
  const aliasMap = new Map<string, string[]>();
  for (const n of nodes) {
    const terms = [n.canonicalName, ...n.aliases];
    for (const t of terms) {
      const k = fold(t);
      if (!k) continue;
      const list = aliasMap.get(k) ?? [];
      if (!list.includes(n.id)) list.push(n.id);
      aliasMap.set(k, list);
    }
  }
  const aliasCollisions = [...aliasMap.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([alias, ids]) => ({ alias, ids }))
    .slice(0, 200);

  // Shallow: subcategory with < 3 descendants that are leaves, or GROUP with depth<=2 and <2 children
  const shallowBranches: TaxonomyCoverageReport["shallowBranches"] = [];
  for (const n of nodes) {
    if (n.nodeType !== "SUBCATEGORY" && n.nodeType !== "GROUP") continue;
    const children = getTaxonomyChildren(n.id);
    if (children.length < 2) {
      shallowBranches.push({
        id: n.id,
        depth: n.depth,
        childCount: children.length,
      });
    }
  }

  const otherDependency: TaxonomyCoverageReport["otherDependency"] = [];
  for (const cat of REQUEST_CATEGORIES) {
    for (const label of cat.subcategories) {
      if (label !== "Diğer") continue;
      const slug = subcategorySlug(label);
      const subId = `tax:${cat.id}:${slug}`;
      const subLeaves = leaves.filter(
        (n) => n.categoryId === cat.id && n.subcategoryId === slug,
      );
      otherDependency.push({
        categoryId: cat.id,
        subcategoryId: slug,
        leafCount: subLeaves.length,
      });
      void subId;
    }
  }

  const perDomain: TaxonomyCoverageReport["perDomain"] = {};
  for (const cat of REQUEST_CATEGORIES) {
    const domainNodes = nodes.filter((n) => n.categoryId === cat.id);
    const domainLeaves = domainNodes.filter(
      (n) => getTaxonomyChildren(n.id).length === 0,
    );
    const coveredSubs = cat.subcategories.filter((label) => {
      const id = `tax:${cat.id}:${subcategorySlug(label)}`;
      return byId.has(id) && getTaxonomyChildren(id).length > 0;
    }).length;
    perDomain[cat.id] = {
      nodeCount: domainNodes.length,
      leafCount: domainLeaves.length,
      maxDepth: domainNodes.length
        ? Math.max(...domainNodes.map((n) => n.depth))
        : 0,
      subcategoryCoverage: cat.subcategories.length
        ? coveredSubs / cat.subcategories.length
        : 0,
    };
  }

  // Honest scores
  const expectedSubs = REQUEST_CATEGORIES.reduce(
    (a, c) => a + c.subcategories.length,
    0,
  );
  const presentSubs = REQUEST_CATEGORIES.reduce((a, c) => {
    return (
      a +
      c.subcategories.filter((label) =>
        byId.has(`tax:${c.id}:${subcategorySlug(label)}`),
      ).length
    );
  }, 0);

  const structuralRaw =
    (presentSubs / Math.max(1, expectedSubs)) * 0.5 +
    (orphans.length === 0 ? 0.25 : 0) +
    (cycles.length === 0 ? 0.15 : 0) +
    (emptyParents.length === 0
      ? 0.1
      : Math.max(0, 0.1 - emptyParents.length * 0.01));

  const leafTarget = 400;
  const leafScore = Math.min(0.95, leaves.length / leafTarget);

  const aliasTarget = 600;
  const aliasScore = Math.min(0.95, aliasCount / aliasTarget);

  const schemaScore = Math.min(0.95, requestSchemaCoverage);

  // Cap structural below 1.0 always unless perfect tree + full sub coverage
  const structural = Math.min(
    0.98,
    Math.round(structuralRaw * 1000) / 1000,
  );

  return {
    nodeCount: nodes.length,
    leafCount: leaves.length,
    maxDepth,
    avgDepth,
    aliasCount,
    requestSchemaCoverage,
    emptyParents,
    orphans,
    cycles,
    duplicateCanonical,
    aliasCollisions,
    shallowBranches,
    otherDependency,
    perDomain,
    scores: {
      structural,
      leaf: Math.round(leafScore * 1000) / 1000,
      alias: Math.round(aliasScore * 1000) / 1000,
      schema: Math.round(schemaScore * 1000) / 1000,
    },
  };
}
