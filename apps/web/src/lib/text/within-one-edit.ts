/**
 * TEK HARFLİK YAZIM HATASI ÖLÇÜTÜ — TALEPO'NUN TEK TANIMI.
 *
 * Tanım eczane kapsam kapısında doğdu (`request-understanding/pharmacy-scope-gate`)
 * ve oradan `intent-signals` ile `understand-request` de okuyordu. Taksonomi
 * alias çözücüsünün de aynı ölçüte ihtiyacı olunca dosya OLDUĞU GİBİ buraya
 * taşındı: eczane kapısı ilaç adları JSON'unu (birkaç megabayt) yanında
 * taşıyor ve istemci paketine giren taksonomi katmanı onu içeri alamazdı.
 * Ölçüt kopyalanmadı — eski modül bu dosyadan yeniden dışa açar, böylece
 * "bir harf hatası"nın iki farklı toleransı hiç var olmaz.
 *
 * Kısa sözcüklerde (6 harften az) yalnız AYNI UZUNLUKTA değişim kabul edilir:
 * bir harf silmek "agri"yi "ari"ye (arı) çevirir ve o başka bir sözcüktür.
 */
export function withinOneEdit(word: string, root: string): boolean {
  if (word === root) return true;
  const shortRoot = root.length < 6;
  if (shortRoot && word.length !== root.length) return false;
  if (Math.abs(word.length - root.length) > 1) return false;

  if (word.length === root.length) {
    let diff = 0;
    for (let i = 0; i < word.length; i += 1) {
      if (word[i] !== root[i]) diff += 1;
      if (diff > 2) return false;
    }
    if (diff === 1) return true;
    // Komşu iki harfin yer değişmesi de tek hatadır ("kesici" → "keisci").
    if (diff === 2) {
      for (let i = 0; i < word.length - 1; i += 1) {
        if (word[i] === root[i + 1] && word[i + 1] === root[i]) {
          const rest =
            word.slice(0, i) + root[i] + root[i + 1] + word.slice(i + 2) === root;
          if (rest) return true;
        }
      }
    }
    return false;
  }

  const [shorter, longer] = word.length < root.length ? [word, root] : [root, word];
  let i = 0;
  let j = 0;
  let skipped = 0;
  while (i < shorter.length && j < longer.length) {
    if (shorter[i] === longer[j]) {
      i += 1;
      j += 1;
      continue;
    }
    skipped += 1;
    if (skipped > 1) return false;
    j += 1;
  }
  return true;
}
