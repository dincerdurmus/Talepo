/**
 * DEV / TEST BÖLÜNMESİ — TOHUM SABİT, RASTGELELİK YOK (2026-09-25).
 *
 * KURAL (kurucu görev tanımı): her küme dev %40 / test %60 bölünür, tohum
 * sabitlenir. Test yarısı YALNIZ FAZ 4'te BİR KEZ koşulur; test yarısına
 * bakarak kural yazmak YASAKTIR.
 *
 * NEDEN HASH, NEDEN SHUFFLE DEĞİL. Bir karıştırma algoritması kütüphane
 * sürümüne, dizi sırasına ve eleman sayısına duyarlıdır: kümeye tek bir satır
 * eklenince BÜTÜN bölünme kayar ve dünkü "test" satırı bugün "dev" olur. O an
 * ölçüm kirlenir ve kirlendiği FARK EDİLMEZ. Bu yüzden bölünme her satırın
 * KENDİ kimliğinden hesaplanır: bir satırın hangi yarıya düştüğü yalnız kendi
 * `id`'sine ve sabit tohuma bağlıdır. Kümeye satır eklemek mevcut satırların
 * yarısını DEĞİŞTİRMEZ.
 *
 * FNV-1a 32 bit: küçük, deterministik, platformdan bağımsız. Kriptografik
 * değildir ve olması gerekmez — burada gizlenecek bir şey yok, tekrarlanabilir
 * olması gerekiyor.
 */

/** Tohum. DEĞİŞTİRİLİRSE bütün ÖNCE/SONRA karşılaştırmaları geçersizleşir. */
export const OPEN_SET_SPLIT_SEED = "talepo-open-set-2026-09-25";

/** Dev yüzdesi. %40 dev / %60 test. */
export const DEV_SHARE = 40;

export type Half = "dev" | "test";

function fnv1a32(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    /* 32 bit çarpma, taşma güvenli: Math.imul. */
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Bir satırın yarısı — yalnız kendi kimliğinden. */
export function halfOf(id: string): Half {
  return fnv1a32(`${OPEN_SET_SPLIT_SEED}:${id}`) % 100 < DEV_SHARE
    ? "dev"
    : "test";
}

export function splitById<T extends { id: string }>(
  rows: readonly T[],
): { dev: T[]; test: T[] } {
  const dev: T[] = [];
  const test: T[] = [];
  for (const row of rows) (halfOf(row.id) === "dev" ? dev : test).push(row);
  return { dev, test };
}
