/**
 * İSTENEN ŞEYİN ROLÜ — tek yetkili tanım (KB-12, 2026-08-24).
 *
 * Bu kural hem `understand-request.ts` hem `build-state.ts` hem de
 * `semantic-subject.ts` tarafından kullanılır. Kural üç yerde birden
 * tanımlanmasın diye buraya alındı; `understand-request.ts` onu yeniden
 * dışa vurur, böylece mevcut içe aktarmalar bozulmaz.
 *
 * `semantic-subject.ts` doğrudan buradan okur: `understand-request.ts`
 * zaten `semantic-subject.ts`'i içe aktardığı için ters yönde bir içe
 * aktarım döngü yaratırdı.
 */

/** Türkçe katlama — rol kuralı için (KB-12). */
export function foldRoleToken(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/[çÇ]/g, "c")
    .replace(/[ğĞ]/g, "g")
    .replace(/[ıİ]/g, "i")
    .replace(/[öÖ]/g, "o")
    .replace(/[şŞ]/g, "s")
    .replace(/[üÜ]/g, "u");
}

/**
 * İSTENEN ŞEY, ÜST ÜRÜNÜN MODELİ OLAMAZ (KB-12, 2026-08-24).
 *
 * Türkçede uyumluluk bağlacı "için" cümleyi ikiye böler: solunda parçanın ait
 * olduğu ÜST ÜRÜN, sağında İSTENEN ŞEY durur. Model, üst ürünü niteler; bu
 * yüzden yalnızca bağlacın sağında geçen bir jeton model olamaz.
 *
 * Ölçülen hata: "Arçelik bulaşık makinesi için rezistans arıyorum" →
 * `model = "rezistans"`, "Siemens ankastre fırın için termostat lazım" →
 * `model = "termostat"`. Siemens vakasında parça kataloğu "termostat"ı zaten
 * PARÇA olarak tanıyordu; aynı jeton iki rol birden üstleniyordu.
 *
 * Kural kelimeye özel DEĞİL, konumsaldır — yeni parça adları için liste
 * güncellemesi gerektirmez. `isProductTypePhrase` guard'ının kardeşidir:
 * o "bu şey NE" sorusunu, bu "bu şey KİMİN İÇİN" sorusunu korur.
 *
 * Bağlaç yoksa kural uygulanmaz ("Dyson V15 filtresi" → V15 model kalır).
 * Jeton bağlacın solunda da geçiyorsa model olmaya devam eder
 * ("Heidelberg SM 74 için …" → SM 74 solda, korunur).
 */
export function isRequestedItemNotModel(input: string, token: string): boolean {
  const hay = foldRoleToken(String(input ?? ""));
  const needle = foldRoleToken(token).trim();
  if (!hay.trim() || !needle) return false;
  const match = hay.match(/(^|[^a-z0-9])icin([^a-z0-9]|$)/);
  if (!match || match.index == null) return false;
  const before = hay.slice(0, match.index);
  const after = hay.slice(match.index);
  if (after.includes(needle) && !before.includes(needle)) return true;

  /**
   * SENTEZLENMİŞ JETON — ilişkinin İKİ YAKASINI birden kapsayan aday (1B).
   *
   * Kimlik katmanı bitişik olmayan sözcükleri birleştirip aday model
   * üretebiliyor. Ölçülen uydurmalar:
   *   "Bosch kampanya için destek arıyorum" → model = "kampanya destek"
   *   "Bosch acil için servis arıyorum"     → model = "acil servis"
   * İkisi de metinde HİÇ geçmez; "kampanya"/"acil" solda, "destek"/"servis"
   * sağdadır. Bütün olarak arandığında bulunamadıkları için yukarıdaki
   * kontrolden kaçıyorlardı.
   *
   * Model üst ürünü niteler; üst ürün ise bağlacın SOLUNDA durur. Bu yüzden
   * adayın herhangi bir sözcüğü yalnız SAĞDA geçiyorsa aday ilişki sınırını
   * ihlal ediyordur ve model olamaz.
   *
   * Solda da geçen jetonlar korunur: "Heidelberg SM 74 için …" → "sm" ve "74"
   * solda, model bozulmaz.
   */
  const parts = needle.split(/[^a-z0-9]+/).filter(Boolean);
  if (parts.length < 2) return false;
  return parts.some((w) => after.includes(w) && !before.includes(w));
}
