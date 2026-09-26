/**
 * Master Taxonomy Registry — indexes + traversal APIs.
 */

import { foldLabel } from "@/lib/knowledge/slug";
import { withinOneEdit } from "@/lib/text/within-one-edit";

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
  /**
   * Tek sözcüklü alias anahtarları, UZUNLUĞA göre kovalanmış. Yazım hatası
   * araması yalnız bu kovalarda dolaşır; tüm indeksi taramaz.
   */
  singleWordKeysByLength: Map<number, string[]>;
  /** Devredilmiş kimlik → yerine geçen düğüm kimliği (bkz. `resolveTaxonomyNodeId`). */
  redirects: Map<string, string>;
  loaded: boolean;
};

const state: RegistryState = {
  byId: new Map(),
  byParent: new Map(),
  byCategory: new Map(),
  aliasIndex: new Map(),
  singleWordKeysByLength: new Map(),
  redirects: new Map(),
  loaded: false,
};

/**
 * Yazım hatası araması yalnız YETERİNCE UZUN tek sözcükler için açılır.
 * `withinOneEdit` altı harften kısa kökte silme/ekleme kabul etmez; buna ek
 * olarak kısa sözcüklerde tek harf değişimi Türkçede çok sık başka bir
 * sözcük üretir ("kasa"/"masa"). Eşik, o ölçütün kendi eşiğidir.
 */
const FUZZY_MIN_LENGTH = 6;

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
  state.singleWordKeysByLength.clear();
  state.redirects.clear();
  state.loaded = false;
}

export function ensureTaxonomyLoaded(nodes?: TaxonomyNode[]): void {
  if (state.loaded && !nodes) return;
  resetTaxonomyRegistry();
  const raw = nodes ?? loadAllTaxonomyNodes();

  /**
   * DEVREDİLMİŞ DÜĞÜM AĞACIN İÇİNDE DURMAZ (D-0041).
   *
   * Kayıt dosyada kalır — hangi kimliğin nereye taşındığı provenance'tır ve
   * silinmez — ama indekslere girmez. Girseydi eski ve yeni düğüm aynı
   * alias'ı paylaşır, `resolveTaxonomyAlias` iki adayı da görür ve eşit
   * derinlikte kimlik alfabetik sıraya düşerdi: kurucunun taşıdığı ürün
   * sessizce eski yerinden çözülmeye devam ederdi.
   */
  const list = raw.filter((node) => {
    if (node.status !== "superseded") return true;
    if (node.supersededBy) state.redirects.set(node.id, node.supersededBy);
    return false;
  });

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
  for (const key of state.aliasIndex.keys()) {
    if (key.length < FUZZY_MIN_LENGTH || key.includes(" ")) continue;
    const bucket = state.singleWordKeysByLength.get(key.length) ?? [];
    bucket.push(key);
    state.singleWordKeysByLength.set(key.length, bucket);
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

/**
 * Bir kimliği ağacın BUGÜNKÜ karşılığına çevirir.
 *
 * Kayıtlı taleplerde, envanter izdüşümlerinde ve eşleşme kayıtlarında eski
 * kimlikler yaşamaya devam eder; okuma katmanı onları buradan çözer, veriye
 * hiçbir şey yazılmaz. Zincir takip edilir (A→B→C) ve döngüye karşı korumalı.
 */
export function resolveTaxonomyNodeId(id: string): string {
  ensureTaxonomyLoaded();
  let cur = id;
  const seen = new Set<string>([id]);
  for (;;) {
    const next = state.redirects.get(cur);
    if (!next || seen.has(next)) return cur;
    seen.add(next);
    cur = next;
  }
}

export function getTaxonomyNode(id: string): TaxonomyNode | undefined {
  ensureTaxonomyLoaded();
  return state.byId.get(resolveTaxonomyNodeId(id));
}

/** Walk parentId chain from node → root (node first). */
export function getTaxonomyAncestorIds(nodeId: string): string[] {
  ensureTaxonomyLoaded();
  const ids: string[] = [];
  let cur = state.byId.get(resolveTaxonomyNodeId(nodeId));
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
  const rootId = resolveTaxonomyNodeId(nodeId);
  if (!state.byId.has(rootId)) return [];
  const out: string[] = [];
  const queue = [rootId];
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

/**
 * Kategori kendi kanonik hizmet yapraklarına sahip mi? (98+ Faz I, 2026-09-01)
 *
 * "Servis niyeti Hizmetler'e yönlendirir" kuralının istisnası ada özel
 * ("automotive") yazılmıştı; oysa istisnanın gerçek gerekçesi kategorinin
 * hizmeti KENDİ taksonomisinde adlandırmasıdır (technology'de "Bakım /
 * destek sözleşmesi" SERVICE_TYPE yaprağı gibi). Kural artık kanonik
 * veriden türetilir; sonuç kategori başına önbelleğe alınır.
 */
const serviceLeafOwnership = new Map<string, boolean>();
export function categoryOwnsServiceLeaves(categoryId: string): boolean {
  const cached = serviceLeafOwnership.get(categoryId);
  if (cached !== undefined) return cached;
  const owns = getTaxonomyNodesByCategory(categoryId).some(
    (n) => n.nodeType === "SERVICE_TYPE",
  );
  serviceLeafOwnership.set(categoryId, owns);
  return owns;
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
  const matchesExact = (n: TaxonomyNode) => {
    const terms = [
      n.canonicalName,
      ...n.aliases,
      ...(n.searchTerms ?? []),
    ];
    return terms.some((t) => foldLabel(t) === key);
  };
  const exact = nodes.find(matchesExact);
  if (exact) return exact;

  // Kısmî eşleşme yalnız tam kanonik/alias eşleşmesi yoksa devreye girer.
  // Aksi halde "Yalı Dairesi" içinde geçen "Daire" ilk düğüme bağlanır ve
  // daha özel ürün ailesi kaybolur.
  const partial = nodes.find((n) => {
    const terms = [
      n.canonicalName,
      ...n.aliases,
      ...(n.searchTerms ?? []),
    ];
    return terms.some((t) => {
      const f = foldLabel(t);
      return f.includes(key) || key.includes(f);
    });
  });
  return partial ?? null;
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

/**
 * YAZIM HATASI İKİNCİ ŞANSTIR, BİRİNCİ DEĞİL.
 *
 * Yalnız birebir eşleşme BULUNAMADIĞINDA çalışır ve yalnız TEK bir alias
 * anahtarı bir harf uzaklıktaysa sonuç döner. İki anahtar birden yakınsa
 * hangisinin kastedildiği gerçekten bilinmez: sessizce birini seçmek,
 * kullanıcının yazmadığı bir ürünü onun adına beyan etmek olurdu.
 *
 * Ölçüt kopyalanmadı; `withinOneEdit` Talepo'nun tek yazım hatası tanımıdır.
 */
function nearMissAliasIds(key: string): string[] {
  if (key.length < FUZZY_MIN_LENGTH || key.includes(" ")) return [];
  let matchedKey: string | null = null;
  for (let len = key.length - 1; len <= key.length + 1; len += 1) {
    for (const candidateKey of state.singleWordKeysByLength.get(len) ?? []) {
      if (!withinOneEdit(key, candidateKey)) continue;
      if (matchedKey && matchedKey !== candidateKey) return [];
      matchedKey = candidateKey;
    }
  }
  return matchedKey ? (state.aliasIndex.get(matchedKey) ?? []) : [];
}

export function resolveTaxonomyAlias(
  term: string,
  categoryId?: string,
): AliasHit | null {
  ensureTaxonomyLoaded();
  const key = foldLabel(term);
  if (!key) return null;
  const ids = state.aliasIndex.get(key) ?? nearMissAliasIds(key);
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

  /**
   * ATA ADAY BELİRSİZLİK ÜRETMEZ.
   *
   * Belirsizlik KARDEŞ adaylar arasındadır: aynı ifade iki ayrı dalda iki
   * ayrı şeyi gösterdiğinde hangisi olduğu gerçekten bilinmez. Bir aday
   * diğerinin ATASIYSA ortada iki şey yoktur — aynı şeyin iki ayrıntı
   * düzeyi vardır ve en derin olan en özel olandır. Ölçüldü (D-0041): bir
   * alt kategori kendi ürün düğümüyle aynı adı taşıdığında ("Kartvizit"
   * hem alt kategori hem ürün türü) bu kapı ifadeyi tamamen atıyor,
   * kullanıcı ürünü yazdığı hâlde talep alt kategorisiz kalıyordu.
   */
  const ancestorIds = new Set(getTaxonomyAncestorIds(node.id));
  const rivals = candidates.filter(
    (c) => c.id !== node.id && !ancestorIds.has(c.id),
  );
  const ambiguous =
    (node.ambiguousAliases ?? []).some((a) => foldLabel(a) === key) ||
    rivals.length > 0;

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
  const node = state.byId.get(resolveTaxonomyNodeId(nodeId));
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
