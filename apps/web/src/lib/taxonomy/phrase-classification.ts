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
import { resolveTaxonomyAlias } from "./registry";
import type { TaxonomyNode } from "./types";

export function classifyTaxonomyPhrase(phrase: string): TaxonomyNode | null {
  const t = phrase?.trim();
  if (!t) return null;
  return resolveTaxonomyAlias(t)?.node ?? null;
}

/** İfadenin TAMAMI kanonik bir ürün TÜRÜ mü? ("fırın", "ankastre fırın") */
export function isCanonicalProductTypePhrase(phrase: string): boolean {
  return classifyTaxonomyPhrase(phrase)?.nodeType === "PRODUCT_TYPE";
}
