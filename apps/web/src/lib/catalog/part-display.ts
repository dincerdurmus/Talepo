/**
 * Parça görünen adı birleştirme kuralları — TEK yetkili (I22/I23, 2026-08-31).
 *
 * İki ölçülen kayıp bu modülden kapanır; kural cümleye özel değildir,
 * eksen düzeyindedir:
 *
 * - KONUM EKSENİ (I23): konum belirteci, parça adında ZATEN geçiyorsa
 *   yeniden eklenmez. Ölçülen: katalog zenginleştirmesi "ön" + "Ön far"ı
 *   naif join ile "ön ön far" yapıyordu; aynı naif join semantic-subject'in
 *   "için" dalında da vardı.
 *
 * Zenginleştirme ekseninin (I22) kapsama kararı BURADA DEĞİLDİR: onun tek
 * yetkilisi `request-understanding/part-relation.ts` içindeki
 * `coversRequestedTokens`tır; ikinci bir kopya kurulmadı.
 *
 * Bu modül katalog katmanındadır çünkü kuralı hem katalog zenginleştirmesi
 * hem anlama katmanı kullanır; iki katman da buradan İTHAL eder.
 */

function foldToken(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u");
}

/**
 * Konum + parça adını, konum belirtecini çoğaltmadan birleştirir.
 * mergePositionIntoPartName("ön", "ön far") → "ön far".
 */
export function mergePositionIntoPartName(
  position: string | null | undefined,
  partName: string,
): string {
  const name = partName.trim();
  if (!position?.trim()) return name;
  const nameTokens = new Set(foldToken(name).split(/\s+/).filter(Boolean));
  const posTokens = position
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((tok) => !nameTokens.has(foldToken(tok)));
  return [...posTokens, name].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}
