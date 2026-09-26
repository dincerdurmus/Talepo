/**
 * /talep HAREKET DİLİ — TEK SABİT TABLO (kurucu, 2026-09-25 tanıtım videosu).
 *
 * Değerler tanıtım videosunun kaynak kodundan (`video/kaynak-dikey/dikey.js`,
 * `K` zaman çizelgesi ve `EASE.expo` / `spring` kullanımı) alındı. Her yüzey
 * kendi süresini uydurmasın diye tek yerde durur: vurgu aralığı da, satır
 * aralığı da, kartın yay girişi de buradan okunur.
 *
 * NE YAPMAZ. Karar taşımaz. Hiçbir süre bir sorunun sorulup sorulmayacağını,
 * bir alanın zorunlu olup olmadığını ya da yayın kapısını etkilemez; yalnız
 * aynı içeriğin ne kadar sürede göründüğünü söyler.
 *
 * AZALTILMIŞ HAREKET. `prefersReducedMotion()` tek okuma noktasıdır. Hareketi
 * olan her yüzey bu fonksiyonu çağırır ve sırayı hiç kurmadan son hâli
 * gösterir — animasyonu hızlandırmaz, atlar.
 */

/** expo-out — videodaki `EASE.expo` karşılığı. */
export const EASE_REVEAL = "cubic-bezier(0.16, 1, 0.3, 1)";

/**
 * Yay (spring) girişi. Videoda `spring(t, 10, 8)` ile çizilen hafif aşımın
 * CSS karşılığı; kartın aşağıdan gelişi bu eğriyi kullanır.
 */
export const EASE_SPRING = "cubic-bezier(0.22, 1.18, 0.36, 1)";

/** Bir yüzeyin belirme süresi; videodaki reveal aralığı 400–600 ms. */
export const REVEAL_MS = 460;
export const REVEAL_SLOW_MS = 600;

/** Kartın yaydan giriş süresi. */
export const CARD_IN_MS = 560;

/** Okuma anında iki vurgu arasındaki gecikme (video `K.hlStep` = 0,42 s). */
export const HIGHLIGHT_STEP_MS = 420;

/** Okuma başlamadan önceki soluklanma ve son vurgudan sonraki bekleme. */
export const READING_LEAD_MS = 320;
export const READING_TAIL_MS = 520;

/**
 * Okuma anının üst sınırı (kurucu: "en fazla 3 s"). Çok alan anlaşılan uzun
 * bir cümlede kullanıcı kartı beklemek zorunda kalmasın diye vardır.
 */
export const READING_MAX_MS = 3000;

/** Kart satırlarının sırayla dolma aralığı (video `K.rows` adımı = 0,22 s). */
export const ROW_STEP_MS = 220;

/**
 * Okuma anının toplam süresi — TEK HESAP. Vurgu sayısı arttıkça uzar ama
 * `READING_MAX_MS` sınırını geçmez.
 */
export function readingDurationMs(spanCount: number): number {
  const raw =
    READING_LEAD_MS +
    Math.max(spanCount, 0) * HIGHLIGHT_STEP_MS +
    READING_TAIL_MS;
  return Math.min(raw, READING_MAX_MS);
}

/**
 * Azaltılmış hareket tercihi. Sunucuda `false` döner: sıra yalnız istemcide
 * kurulduğu için sunucu render'ı bu kararı hiç vermez.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
