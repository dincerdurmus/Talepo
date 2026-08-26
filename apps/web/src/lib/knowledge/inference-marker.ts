/**
 * ÇIKARIMLA DOLMUŞ ALAN İŞARETİ — "değer var" ile "kullanıcı cevapladı" ayrı
 * eksenlerdir (KB-17).
 *
 * Soru çözücüsü alanları düz bir `Record<string, string>` torbasından okur.
 * O torba iki soruya aynı anda cevap veremiyordu:
 *
 *   1. Bu alanın koşullu görünürlük (`visibleWhen` / `dependsOn`) kararlarını
 *      sürdürecek bir DEĞERİ var mı?
 *   2. Bu alan CEVAPLANMIŞ mı — yani soruyu kapatmaya yetkili bir kaynaktan
 *      mı geldi?
 *
 * İkisi tek bir "boş değil" kontrolüne çöktüğü için, Talepo'nun kendi
 * çıkarımı kullanıcı cevabı gibi davranıyor ve routing'i belirleyen soruyu
 * sessizce kapatıyordu. Bu işaret ikinci soruyu ayrı tutar: değer torbada
 * KALIR (koşullar bozulmaz), ama alan cevaplanmış SAYILMAZ.
 *
 * İşaret, torbada zaten var olan `__explicit__<key>` işaretinin kardeşidir ve
 * aynı yerde, `toResolverFieldBag` içinde üretilir. Yalnız `INFERRED`
 * provenance'lı değerler işaretlenir; `EXPLICIT_TEXT`, `EXPLICIT_BROWSE` ve
 * `CATALOG_ENRICHED` işaretlenmez.
 *
 * Bu modülün hiçbir importu yoktur — hem bilgi katmanı hem besteci katmanı
 * döngü riski olmadan okuyabilsin diye.
 */

export const INFERENCE_ONLY_MARKER_PREFIX = "__inference_only__";

export function inferenceOnlyMarkerKey(fieldKey: string): string {
  return `${INFERENCE_ONLY_MARKER_PREFIX}${fieldKey}`;
}

/** Alanın değeri YALNIZ çıkarımdan mı geliyor? */
export function isInferenceOnlyInBag(
  values: Record<string, string | undefined>,
  fieldKey: string,
): boolean {
  return (values[inferenceOnlyMarkerKey(fieldKey)] ?? "").trim().length > 0;
}
