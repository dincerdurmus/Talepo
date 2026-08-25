/**
 * Master Taxonomy Registry — indexes + traversal APIs.
 */

import { foldLabel } from "@/lib/knowledge/slug";

import { loadAllTaxonomyNodes } from "./loader";
import type { AliasHit, TaxonomyNode } from "./types";

const LEAF_TYPES = new Set([
  "PRODUCT_TYPE",
  "PART_TYPE",
  "SERVICE_TYPE",
  "COMMODITY_TYPE",
  "TECHNICAL_TYPE",
]);

type RegistryState = {
  byId: Map<string, TaxonomyNode>;
  byParent: Map<string | null, TaxonomyNode[]>;
  byCategory: Map<string, TaxonomyNode[]>;
  aliasIndex: Map<string, string[]>;
  loaded: boolean;
};

const state: RegistryState = {
  byId: new Map(),
  byParent: new Map(),
  byCategory: new Map(),
  aliasIndex: new Map(),
  loaded: false,
};

/**
 * Kategorinin yüzü olan ürünler: bulunduğu kolonun başında görünürler.
 * Kullanıcı listeyi taramadan aradığını görsün diye (kurucu, 2026-08-23).
 */
const FLAGSHIP_PRODUCTS = new Set(
  [
    "televizyon",
    "cep telefonu",
    "dizüstü bilgisayar",
    "masaüstü bilgisayar",
    "tablet",
    "monitör",
    "yazıcı",
    "modem",
    "akıllı saat",
    "fotoğraf makinesi",
    "oyun konsolu",
    "buzdolabı",
    "çamaşır makinesi",
    "bulaşık makinesi",
    "klima",
    "kombi",
    "fırın",
    "bebek arabası",
    "oto koltuğu",
    "koltuk takımı",
    "yatak odası takımı",
    "ofis sandalyesi",
  ].map((s) => s.toLocaleLowerCase("tr-TR")),
);

function columnRank(n: TaxonomyNode): number {
  if (FLAGSHIP_PRODUCTS.has(n.canonicalName.toLocaleLowerCase("tr-TR"))) return 0;
  return n.provenance?.source === "google-product-taxonomy-tr" ? 2 : 1;
}

function pushChild(parentId: string | null, node: TaxonomyNode) {
  const key = parentId;
  const list = state.byParent.get(key) ?? [];
  list.push(node);
  state.byParent.set(key, list);
}

function indexAlias(term: string, nodeId: string) {
  const key = foldLabel(term);
  if (!key) return;
  const list = state.aliasIndex.get(key) ?? [];
  if (!list.includes(nodeId)) list.push(nodeId);
  state.aliasIndex.set(key, list);
}

export function resetTaxonomyRegistry() {
  state.byId.clear();
  state.byParent.clear();
  state.byCategory.clear();
  state.aliasIndex.clear();
  state.loaded = false;
}

export function ensureTaxonomyLoaded(nodes?: TaxonomyNode[]): void {
  if (state.loaded && !nodes) return;
  resetTaxonomyRegistry();
  const list = nodes ?? loadAllTaxonomyNodes();
  for (const node of list) {
    state.byId.set(node.id, node);
    pushChild(node.parentId, node);
    const catList = state.byCategory.get(node.categoryId) ?? [];
    catList.push(node);
    state.byCategory.set(node.categoryId, catList);

    indexAlias(node.canonicalName, node.id);
    for (const a of node.aliases) indexAlias(a, node.id);
    for (const t of node.searchTerms) indexAlias(t, node.id);
    for (const a of node.ambiguousAliases ?? []) indexAlias(a, node.id);
  }
  // Kolon sıralaması (kurucu, 2026-08-23):
  //  1) grubun amiral ürünü başta ("TV ve görüntü" → Televizyon),
  //  2) sonra Türk pazarından kürasyonlu ürünler,
  //  3) en sonda Google'ın uzun kuyruğu.
  // Her kademe kendi içinde Türkçe alfabetik.
  for (const [k, children] of state.byParent) {
    children.sort(
      (a, b) =>
        columnRank(a) - columnRank(b) ||
        a.canonicalName.localeCompare(b.canonicalName, "tr"),
    );
    state.byParent.set(k, children);
  }
  state.loaded = true;
}

export function getTaxonomyNode(id: string): TaxonomyNode | undefined {
  ensureTaxonomyLoaded();
  return state.byId.get(id);
}

/** Walk parentId chain from node → root (node first). */
export function getTaxonomyAncestorIds(nodeId: string): string[] {
  ensureTaxonomyLoaded();
  const ids: string[] = [];
  let cur = state.byId.get(nodeId);
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    ids.push(cur.id);
    cur = cur.parentId ? state.byId.get(cur.parentId) : undefined;
  }
  return ids;
}

/** BFS descendants including the node itself. */
export function getTaxonomyDescendantIds(nodeId: string): string[] {
  ensureTaxonomyLoaded();
  if (!state.byId.has(nodeId)) return [];
  const out: string[] = [];
  const queue = [nodeId];
  const seen = new Set<string>();
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    for (const child of state.byParent.get(id) ?? []) {
      queue.push(child.id);
    }
  }
  return out;
}

export function getRootTaxonomyNodes(): TaxonomyNode[] {
  ensureTaxonomyLoaded();
  return (state.byParent.get(null) ?? []).filter((n) => n.nodeType === "CATEGORY");
}

export function getTaxonomyChildren(parentId: string): TaxonomyNode[] {
  ensureTaxonomyLoaded();
  return state.byParent.get(parentId) ?? [];
}

export function getTaxonomyNodesByCategory(categoryId: string): TaxonomyNode[] {
  ensureTaxonomyLoaded();
  return state.byCategory.get(categoryId) ?? [];
}

export function getSubcategoryTaxonomyNode(
  categoryId: string,
  subcategorySlug: string,
): TaxonomyNode | undefined {
  ensureTaxonomyLoaded();
  const id = `tax:${categoryId}:${subcategorySlug}`;
  return state.byId.get(id);
}

/** Find PRODUCT_TYPE (or similar leaf) under a subcategory by name/alias. */
export function findTaxonomyTypeUnderSubcategory(
  categoryId: string,
  subcategorySlug: string,
  typeToken: string,
): TaxonomyNode | null {
  ensureTaxonomyLoaded();
  const key = foldLabel(typeToken);
  if (!key) return null;
  const nodes = (state.byCategory.get(categoryId) ?? []).filter(
    (n) =>
      n.subcategoryId === subcategorySlug &&
      (n.nodeType === "PRODUCT_TYPE" ||
        n.nodeType === "SERVICE_TYPE" ||
        n.nodeType === "COMMODITY_TYPE"),
  );
  const hit = nodes.find((n) => {
    const terms = [
      n.canonicalName,
      ...n.aliases,
      ...(n.searchTerms ?? []),
    ];
    return terms.some((t) => {
      const f = foldLabel(t);
      return f === key || f.includes(key) || key.includes(f);
    });
  });
  return hit ?? null;
}

export function isTaxonomyLeaf(node: TaxonomyNode): boolean {
  ensureTaxonomyLoaded();
  const children = state.byParent.get(node.id) ?? [];
  return children.length === 0 || LEAF_TYPES.has(node.nodeType);
}

/**
 * Bir ifadeye karşılık gelen BÜTÜN düğümler + eşleşmenin gücü.
 *
 * `resolveTaxonomyAlias` yalnız en derin adayı döndürür ve geri kalanını
 * `ambiguous` bayrağına indirger; bir kararın "adaylar aynı şeyi mi
 * söylüyor?" diye sorabilmesi için ham aday kümesi gerekir. İndeks aynı
 * indekstir — ikinci bir sözlük kurulmaz.
 *
 * `canonical`: ifade en az bir düğümün KANONİK adıyla birebir eşleşiyor.
 * Kanonik eşleşme alias eşleşmesinden güçlü kanıttır ("Klima" düğüm adıdır,
 * "EV" yalnız bir kısaltmadır).
 */
export function listTaxonomyAliasCandidates(term: string): {
  nodes: TaxonomyNode[];
  canonical: boolean;
} {
  ensureTaxonomyLoaded();
  const key = foldLabel(term);
  if (!key) return { nodes: [], canonical: false };
  const nodes = (state.aliasIndex.get(key) ?? [])
    .map((id) => state.byId.get(id))
    .filter((n): n is TaxonomyNode => Boolean(n));
  return {
    nodes,
    canonical: nodes.some((n) => foldLabel(n.canonicalName) === key),
  };
}

export function resolveTaxonomyAlias(
  term: string,
  categoryId?: string,
): AliasHit | null {
  ensureTaxonomyLoaded();
  const key = foldLabel(term);
  if (!key) return null;
  const ids = state.aliasIndex.get(key) ?? [];
  if (!ids.length) return null;

  let candidates = ids
    .map((id) => state.byId.get(id))
    .filter((n): n is TaxonomyNode => Boolean(n));

  if (categoryId) {
    const scoped = candidates.filter((n) => n.categoryId === categoryId);
    if (scoped.length) candidates = scoped;
  }

  if (!candidates.length) return null;

  // Prefer longer / more specific canonical match, then deeper nodes
  candidates.sort((a, b) => b.depth - a.depth || a.id.localeCompare(b.id));
  const node = candidates[0]!;
  const ambiguous =
    (node.ambiguousAliases ?? []).some((a) => foldLabel(a) === key) ||
    candidates.length > 1;

  const matchedAlias =
    [node.canonicalName, ...node.aliases, ...(node.ambiguousAliases ?? [])].find(
      (a) => foldLabel(a) === key,
    ) ?? term;

  /**
   * Adaylar farklı düğümler olsa bile HEPSİ aynı kanonik adı taşıyorsa ürün
   * türü adı belirsiz değildir (bkz. AliasHit.canonicalNameUnambiguous).
   * Alias'ın kendisi `ambiguousAliases` ile açıkça belirsiz işaretlenmişse bu
   * kapı çalışmaz — o işaret kürasyon kararıdır ve ezilmez.
   */
  const explicitlyAmbiguousAlias = (node.ambiguousAliases ?? []).some(
    (a) => foldLabel(a) === key,
  );
  const canonicalNameUnambiguous =
    !explicitlyAmbiguousAlias &&
    candidates.every(
      (c) => foldLabel(c.canonicalName) === foldLabel(node.canonicalName),
    );

  return { node, matchedAlias, ambiguous, canonicalNameUnambiguous };
}

/** Nearest requestSchemaId for a node (walks ancestors). */
export function resolveSchemaIdForNode(nodeId: string): string | null {
  ensureTaxonomyLoaded();
  const node = state.byId.get(nodeId);
  if (!node) return null;

  let cur: TaxonomyNode | undefined = node;
  while (cur) {
    if (cur.requestSchemaId) return cur.requestSchemaId;
    cur = cur.parentId ? state.byId.get(cur.parentId) : undefined;
  }
  return node.subcategoryId
    ? `${node.categoryId}/${node.subcategoryId}`
    : node.categoryId;
}

export function listAllTaxonomyNodes(): TaxonomyNode[] {
  ensureTaxonomyLoaded();
  return [...state.byId.values()];
}

export function taxonomyNodeHasChildren(id: string): boolean {
  ensureTaxonomyLoaded();
  return (state.byParent.get(id) ?? []).length > 0;
}
