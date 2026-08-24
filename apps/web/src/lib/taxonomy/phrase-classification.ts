/**
 * Kanonik taksonomiden türetilen İFADE SINIFLANDIRMASI (KB-12 / 1B).
 *
 * Bu modül yeni bir ürün sözlüğü KURMAZ. `data/taxonomy` altındaki 2151
 * düğümlük kanonik ağaç tek yetkilidir; buradaki işlevler yalnız o ağacı
 * `resolveTaxonomyAlias` üzerinden sorgular. Böylece taksonomiye eklenen her
 * yeni ürün, hiçbir liste güncellemesi gerekmeden bu katmanda da tanınır.
 *
 * Neden ayrı bir modül: aynı soruyu iki farklı katman soruyor —
 * `product-identity/identity-candidates.ts` ("bu ifade bir model mi, yoksa
 * ürün TÜRÜ mü?") ve `request-understanding/semantic-subject.ts` ("bağlacın
 * solunda gerçek bir üst ürün var mı?"). Kural iki yere kopyalanmasın diye
 * tek tanım burada durur ve türetildiği yetkinin (taxonomy) yanında yaşar.
 */
import { listTaxonomyAliasCandidates, resolveTaxonomyAlias } from "./registry";
import type { TaxonomyNode, TaxonomyNodeType } from "./types";

/** Kanonik yetkinlik adları — bkz. KnowledgeCapability ve
 *  data/taxonomy-sources/part-bearing-capability.json. */
const PART_BEARING = "PART_BEARING";
const NOT_PART_BEARING = "NOT_PART_BEARING";

/**
 * ÜÇ DURUM — "kayıt yok" bir RET DEĞİLDİR (1D).
 *
 * `BEARING`  kanonik olarak bildirildi: parça taşır.
 * `EXCLUDED` kanonik olarak bildirilmiş RET (emlak varlığı, hizmet).
 * `UNKNOWN`  henüz kürasyon yapılmadı ya da adaylar çelişiyor. Talep bu
 *            durumda kesinleştirilmez ama REDDEDİLMEZ de; belirsizlik
 *            korunur ve gerekçesi kaydedilir.
 */
export type PartBearingVerdict = "BEARING" | "EXCLUDED" | "UNKNOWN";

/**
 * BÜTÜN ürün adlandıran düğüm türleri. Bir parça talebinin HEDEFİ bunlardan
 * biri olamaz: "televizyon" bir parça değil, ürünün kendisidir.
 */
const WHOLE_PRODUCT_TYPES: ReadonlySet<TaxonomyNodeType> = new Set([
  "CATEGORY",
  "SUBCATEGORY",
  "GROUP",
  "PRODUCT_TYPE",
  "COMMODITY_TYPE",
]);

/** Kelime sayısı — n-gram taraması için. */
function words(phrase: string): string[] {
  return phrase.trim().split(/\s+/).filter(Boolean);
}

/** İfadenin TAMAMI taksonomide hangi düğüm türüne çözülüyor? */
export function classifyTaxonomyPhrase(phrase: string): TaxonomyNode | null {
  const t = phrase?.trim();
  if (!t) return null;
  return resolveTaxonomyAlias(t)?.node ?? null;
}

/** İfadenin TAMAMI kanonik bir ürün TÜRÜ mü? ("fırın", "ankastre fırın") */
export function isCanonicalProductTypePhrase(phrase: string): boolean {
  return classifyTaxonomyPhrase(phrase)?.nodeType === "PRODUCT_TYPE";
}

/**
 * İfadenin TAMAMI bütün bir ürünü mü adlandırıyor?
 * PART_TYPE / SERVICE_TYPE / TECHNICAL_TYPE bilerek dışarıdadır: parça ve
 * hizmet adları burada "bütün ürün" sayılmaz.
 */
export function isCanonicalWholeProductPhrase(phrase: string): boolean {
  const node = classifyTaxonomyPhrase(phrase);
  return Boolean(node && WHOLE_PRODUCT_TYPES.has(node.nodeType));
}

/**
 * TEK BİR İFADE parça taşıyabilen bir ürünü mü adlandırıyor?
 *
 * Karar kanonik veriden okunur (`PART_BEARING`), koddaki bir kategori
 * listesinden değil. Belirsizlik yok sayılmaz; üç kademede çözülür:
 *
 *   1) Kanonik ad eşleşmesi varsa YALNIZ o adaylar dikkate alınır. Kanonik
 *      etiket ("Klima") bir kısaltmadan ("EV") güçlü kanıttır.
 *   2) Yalnız PRODUCT_TYPE adaylar sayılır: bütün bir ürünü adlandıran tek
 *      düğüm türü odur. Otomotiv "Klima" GRUBU bir parça grubudur, ürün değil.
 *   3) Kalan adaylar parça taşıyıcılığı konusunda ÇELİŞİYORSA karar
 *      verilmez. "ev" hem emlak "Daire"nin hem otomotiv "Elektrikli
 *      araç"ın alias'ıdır — biri taşır, diğeri taşımaz; bu ifade yüksek
 *      güvenli üst ürün kanıtı üretemez.
 *
 * Kısa alias'lar KÖRLEMESİNE yasaklanmaz: "TV" tek bir PRODUCT_TYPE'a
 * çözülür, çelişki yoktur ve çalışmaya devam eder.
 */
function partBearingVerdict(
  phrase: string,
): { verdict: PartBearingVerdict; node: TaxonomyNode | null } {
  const { nodes, canonical } = listTaxonomyAliasCandidates(phrase);
  if (!nodes.length) return { verdict: "UNKNOWN", node: null };
  const scoped = canonical
    ? nodes.filter((n) => foldSameCanonical(n, phrase))
    : nodes;
  const products = scoped.filter((n) => n.nodeType === "PRODUCT_TYPE");
  if (!products.length) return { verdict: "UNKNOWN", node: null };
  const bearing = products.filter((n) =>
    n.applicableCapabilities.includes(PART_BEARING),
  );
  if (bearing.length === products.length) {
    return { verdict: "BEARING", node: bearing[0] ?? null };
  }
  const excluded = products.filter((n) =>
    n.applicableCapabilities.includes(NOT_PART_BEARING),
  );
  if (excluded.length === products.length) {
    return { verdict: "EXCLUDED", node: excluded[0] ?? null };
  }
  // Adaylar çelişiyor ("ev" → emlak Daire ile otomotiv Elektrikli araç) ya da
  // hiç kürasyon yok. İkisi de KARAR DEĞİL, belirsizliktir.
  return { verdict: "UNKNOWN", node: null };
}

function foldSameCanonical(node: TaxonomyNode, phrase: string): boolean {
  return (
    node.canonicalName.trim().toLocaleLowerCase("tr-TR") ===
    phrase.trim().toLocaleLowerCase("tr-TR")
  );
}

/**
 * İFADENİN İÇİNDE parça taşıyabilen bir üst ürün geçiyor mu?
 *
 * En uzun n-gram önce denenir ki "bulaşık makinesi" bulunsun, "bulaşık"
 * değil. Marka adları taksonomide düğüm DEĞİLDİR; yalın bir marka ("Bosch")
 * ya da marka + rastgele kelime ("Bosch kampanya") burada kanıt üretemez.
 */
export function findPartBearingParentSpan(
  phrase: string,
): { node: TaxonomyNode; text: string } | null {
  const hit = readParentProductVerdict(phrase);
  return hit.verdict === "BEARING" && hit.node && hit.text
    ? { node: hit.node, text: hit.text }
    : null;
}

/**
 * İFADENİN İÇİNDEKİ üst ürün adayının ÜÇ DURUMLU okuması.
 *
 * En uzun n-gram önce denenir ki "bulaşık makinesi" bulunsun, "bulaşık"
 * değil. `BEARING` bulunursa hemen döner; yoksa bulunan en uzun `EXCLUDED`
 * span'i döner ("Ofis" → emlak varlığı, bildirilmiş ret). Hiçbiri yoksa
 * `UNKNOWN` — kürasyon yapılmamış demektir, "taşımaz" demek DEĞİLDİR.
 */
export function readParentProductVerdict(phrase: string): {
  verdict: PartBearingVerdict;
  node: TaxonomyNode | null;
  text: string | null;
} {
  const parts = words(phrase);
  if (!parts.length) return { verdict: "UNKNOWN", node: null, text: null };
  let excluded: { node: TaxonomyNode | null; text: string } | null = null;
  for (let size = parts.length; size >= 1; size--) {
    for (let start = 0; start + size <= parts.length; start++) {
      const text = parts.slice(start, start + size).join(" ");
      const hit = partBearingVerdict(text);
      if (hit.verdict === "BEARING") {
        return { verdict: "BEARING", node: hit.node, text };
      }
      if (hit.verdict === "EXCLUDED" && !excluded) {
        excluded = { node: hit.node, text };
      }
    }
  }
  return excluded
    ? { verdict: "EXCLUDED", node: excluded.node, text: excluded.text }
    : { verdict: "UNKNOWN", node: null, text: null };
}
