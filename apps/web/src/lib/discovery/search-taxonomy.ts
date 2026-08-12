/**
 * Taxonomy search for Professional workspace — alias/searchTerms only, no AI parser.
 */

import {
  ensureTaxonomyLoaded,
  listAllTaxonomyNodes,
  resolveTaxonomyAlias,
  type TaxonomyNode,
} from "@/lib/taxonomy";

export type TaxonomySearchHit = {
  id: string;
  label: string;
  categoryId: string;
  nodeType: string;
  matchedAlias: string;
  depth: number;
};

function fold(s: string): string {
  return s.toLocaleLowerCase("tr-TR").trim();
}

/**
 * Suggest taxonomy nodes for a query string (bounded).
 */
export function searchTaxonomyNodes(
  query: string,
  options?: { limit?: number; categoryId?: string },
): TaxonomySearchHit[] {
  ensureTaxonomyLoaded();
  const q = fold(query);
  if (q.length < 2) return [];
  const limit = options?.limit ?? 12;

  const aliasHit = resolveTaxonomyAlias(query, options?.categoryId);
  const hits: TaxonomySearchHit[] = [];
  const seen = new Set<string>();

  const push = (node: TaxonomyNode, matchedAlias: string) => {
    if (seen.has(node.id)) return;
    if (options?.categoryId && node.categoryId !== options.categoryId) return;
    if (node.status === "deprecated") return;
    seen.add(node.id);
    hits.push({
      id: node.id,
      label: node.canonicalName,
      categoryId: node.categoryId,
      nodeType: node.nodeType,
      matchedAlias,
      depth: node.depth,
    });
  };

  if (aliasHit) push(aliasHit.node, aliasHit.matchedAlias);

  for (const node of listAllTaxonomyNodes()) {
    if (hits.length >= limit) break;
    if (options?.categoryId && node.categoryId !== options.categoryId) continue;
    const terms = [
      node.canonicalName,
      ...node.aliases,
      ...(node.searchTerms ?? []),
    ];
    const matched = terms.find((t) => {
      const f = fold(t);
      return f === q || f.includes(q) || q.includes(f);
    });
    if (matched) push(node, matched);
  }

  hits.sort((a, b) => b.depth - a.depth || a.label.localeCompare(b.label, "tr"));
  return hits.slice(0, limit);
}
