/**
 * YERLEŞİK KARAR SAĞLAYICISI — mevcut Talepo motorları sözleşmenin arkasında
 * (2026-09-20; devir belgesindeki adıyla "ExistingDecisionProvider", ad repo
 * geleneğine göre seçildi: billing'de sağlayıcı kararı KİMİN verdiğiyle
 * adlandırılır — iyzico, mock; burada karar veren Talepo'nun kendi
 * deterministik kural motorlarıdır).
 *
 * MEVCUT MANTIK KOPYALANMAZ, SARILIR. Bu dosyada karar mantığı YOKTUR ve
 * OLAMAZ: her yetenek, bugüne kadar aynı kararı veren tek yetkiliye delege
 * eder. Buraya bir if bile eklendiği gün sağlayıcı ikinci bir beyin olmaya
 * başlar; doğrulayıcı (verify-decision-layer-boundary-v1) sağlayıcı çıktısını
 * sarılan motorun çıktısıyla birebir karşılaştırarak bunu kırmızıya bağlar.
 *
 *   kategori kararı   → gateCategory (request-understanding/category-gate)
 *   kanonik varlık    → resolveDomainEntity (catalog cephesi)
 *   ürün kimliği      → buildProductIdentity (product-identity)
 */
import { gateCategory } from "@/lib/request-understanding/category-gate";
import { resolveDomainEntity } from "@/lib/catalog";
import { buildProductIdentity } from "@/lib/product-identity/identity-builder";

import type { RequestDecisionProvider } from "./contract";

export function createBuiltinDecisionProvider(): RequestDecisionProvider {
  return {
    name: "talepo-builtin",
    decideRequestCategory(input) {
      return gateCategory(input.text, input.intent);
    },
    resolveCanonicalEntity(input) {
      return resolveDomainEntity(input.text);
    },
    buildProductIdentity(input) {
      return buildProductIdentity(input);
    },
  };
}
