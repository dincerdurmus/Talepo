/**
 * TALEP KARAR SÖZLEŞMELERİ — karar katmanının tek kapısı (2026-09-20).
 *
 * NEDEN VAR. Single Brain (understand-request) bugüne kadar karar motorlarını
 * doğrudan import ediyordu: kategori kapısı, kanonik varlık çözücü, ürün
 * kimliği kurucusu. Motorlar doğru; sınır yoktu. Sınır olmayınca iki şey
 * yapılamıyordu: (1) bir kararın KİMİN verdiği tek yerden okunamıyordu,
 * (2) ileride ikinci bir karar sağlayıcısı (ör. bir model tabanlı servis)
 * geldiğinde beynin içi değişmeden takas yapılamıyordu.
 *
 * KURALLAR (kurucu onaylı görev tanımından, 2026-09-19):
 *   - Sözleşme TALEPO'NUN DİLİNDEDİR: kategori kararı, kanonik varlık,
 *     ürün kimliği. classify()/choose()/score() gibi sağlayıcı jargonu
 *     domain'in üstüne giydirilmez.
 *   - TEK DEVASA DecisionEngine YOKTUR. Her yetenek kendi küçük
 *     sözleşmesini taşır; sağlayıcı bunları BİRLEŞTİREBİLİR ama tüketici
 *     yalnız ihtiyacı olan yeteneğe bağımlıdır.
 *   - DÖNÜŞ TİPLERİ mevcut karar biçimleridir (UnderstandingDecision,
 *     DomainEntityResolution, ProductIdentity). Bu biçimler güven, kanıt ve
 *     alternatif taşır; ileride iki sağlayıcıyı karşılaştırmak için gereken
 *     temizlik zaten buradadır. İkinci bir zarf tipi uydurulmadı.
 *   - Feature flag, capability registry, cache ve gölge sağlayıcı YOKTUR.
 *     Sağlayıcı seçimi get-provider.ts'te KOD olarak yaşar; yeni sağlayıcı
 *     bir yapılandırma değil bir kod değişikliğidir ve kendi kararıyla gelir.
 *
 * Deterministik kalan yollar (soru zamanlayıcısı, ANY semantiği, zorunlu
 * alanlar) bu katmana TAŞINMAZ; karar katmanı "her karar modele sorulur"
 * demek değildir.
 */
import type { RequestIntent, UnderstandingDecision } from "@/lib/request-understanding/types";
import type { DomainEntityResolution } from "@/lib/catalog/domain-entity-resolver";
import type { BuildIdentityInput } from "@/lib/product-identity/identity-builder";
import type { ProductIdentity } from "@/lib/product-identity/types";

/** Kategori kararının girdisi: metin bir alt-span olabilir ("X için Y"nin
 * sağ hedefi), bu yüzden alan adı rawInput değil text'tir. */
export type CategoryDecisionInput = {
  text: string;
  intent: RequestIntent;
};

/** Talebin hangi kategoriye ait olduğuna karar verme yeteneği. */
export type CategoryDecision = {
  decideRequestCategory(
    input: CategoryDecisionInput,
  ): UnderstandingDecision<string>;
};

export type CanonicalEntityDecisionInput = {
  text: string;
};

/** Metindeki tipli kanonik varlığı (platform, yazılım ailesi, makine türü)
 * çözme yeteneği. Karar biçimi katalog cephesinin kendi sözleşmesidir. */
export type CanonicalEntityDecision = {
  resolveCanonicalEntity(
    input: CanonicalEntityDecisionInput,
  ): DomainEntityResolution;
};

/** Ürün kimliğini (marka/model/seri/ürün türü/parmak izi) kurma yeteneği.
 * Girdi ve çıktı tipleri mevcut kimlik kurucusunun kendi sözleşmesidir. */
export type ProductIdentityDecision = {
  buildProductIdentity(input: BuildIdentityInput): ProductIdentity;
};

/**
 * Bir karar sağlayıcısı: üç yeteneğin bileşimi + ad. Ad, eval çıktısında
 * "bu kararı kim verdi" sorusunun cevabıdır ve boş olamaz.
 */
export type RequestDecisionProvider = {
  name: string;
} & CategoryDecision &
  CanonicalEntityDecision &
  ProductIdentityDecision;
