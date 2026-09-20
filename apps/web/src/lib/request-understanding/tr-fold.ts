/**
 * TR KATLAMA — tek yetkili tanım (2026-09-20).
 *
 * Bu tablo ve foldTr daha önce understand-request.ts içinde modül-yerel
 * yaşıyordu. Kategori kapısı (category-gate.ts) kendi modülüne taşınınca
 * aynı katlamaya oradan da ihtiyaç doğdu; kopyalamak iki yetkili yaratırdı,
 * understand-request'ten import etmek ise döngü kurardı (understand-request
 * kategori kapısını import eder). Tanım TAŞINDI, çoğaltılmadı: iki tüketici
 * de burayı okur.
 */
const TR_DIACRITIC_FOLD: Record<string, string> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  ö: "o",
  ş: "s",
  ü: "u",
  â: "a",
  î: "i",
  û: "u",
};

/** tr-TR lowercase + diacritic fold, so "arcelik" matches "Arçelik". */
export function foldTr(value: string): string {
  let out = "";
  for (const ch of value.toLocaleLowerCase("tr-TR")) {
    out += TR_DIACRITIC_FOLD[ch] ?? ch;
  }
  return out;
}
