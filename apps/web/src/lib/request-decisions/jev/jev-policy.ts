/**
 * JEV POLİTİKA EŞİKLERİ — hepsi ÖLÇÜLDÜ, hiçbiri tahmin değil (2026-09-21).
 *
 * Kaynak ölçüm: Veyra/jev-olcum, 1077 vakalık Talepo adversarial korpusu.
 * Toplam ~3.400 canlı çağrı, dört tasarım karşılaştırıldı. Rapor:
 * `Veyra/projects/talepo/SONUC-KAPSAM-TASARIM-2026-09-21.md` (D-0029).
 *
 * KAZANAN TASARIM: kategori 11 seçenekli tek choice + kapsam AYRI bir noul.
 * Kapsamı 12. seçenek yapmak kategori dağılımını kirletiyordu (1021/1040);
 * ayrı soru kirletmedi (1025/1040 — kapsam sorusu olmayan koşunun 1024'ünü
 * bile geçti). Eşikler BURADA yaşar ve koda gömülü DEĞİLDİR: yanlış çıkarsa
 * tek satır değişir, sağlayıcı yeniden yazılmaz.
 */

/**
 * KATEGORİ GÜVEN EŞİĞİ — altındaysa netleştirme kartı açılır.
 *
 * Ölçüldü: yanlış cevapların 3 koşuda gördüğü EN YÜKSEK güven 0.69
 * (45 gözlem). Eşik seçenekleri ve bedelleri:
 *   0.85 → pay 0.16 · gereksiz soru %17,2
 *   0.80 → pay 0.11 · gereksiz soru %14,2   <-- seçilen
 *   0.75 → pay 0.06 · gereksiz soru %11,3
 * Pay neden önemli: aynı ölçümde YANLIŞ cevapların güven kayması 0.30'a
 * çıkıyor (doğru cevaplarınki 0.00–0.15). Yanlış cevap kararsızdır; pay o
 * kararsızlığı karşılamalı. 0.80 seçildi: kaçak sıfır, pay kaymanın üçte
 * birinden büyük, bedel 0.75'e göre yalnız 3 puan.
 */
export const JEV_CATEGORY_CONFIDENCE_MIN = 0.8;

/**
 * KAPSAM BANDI — tek eşik YOK, iki eşik var.
 *
 * Ölçüldü: kapsam dışı vakaların gördüğü en düşük noul 0.47, kapsam içinin
 * gördüğü en yüksek 0.77 — ÖRTÜŞÜYOR, tek çizgi çekilemez. Örtüşme kusur
 * değil: "Satılık arsa" Türkçede gerçekten iki anlamlıdır (arayan da,
 * satan da aynı cümleyi kurar). Doğru cevap "sor"dur, kart zaten onun için
 * vardır. Bant ölçüldü (tam korpus):
 *   noul > 0.80  → kesin kapsam dışı — 25/37 vaka, YANLIŞ İLAN 0
 *   0.40 – 0.80  → kart açılır — 12/37 kapsam dışı + kapsam içi 5/1040 (%0,5)
 *   noul < 0.40  → kapsam içi
 * Yani hiçbir geçerli talep yanlışlıkla kapsam dışı ilan edilmiyor.
 */
export const JEV_SCOPE_CERTAIN_MIN = 0.8;
export const JEV_SCOPE_CLEAR_MAX = 0.4;

/**
 * TAKSONOMİ DIŞI BANDI — aynı desen, HENÜZ ÖLÇÜLMEDİ.
 *
 * Kapsam sorusunun kazandığı desen (ayrı noul) taksonomi dışı sorusuna da
 * uygulandı, ama bu sorunun kendi eşiği korpusla DOĞRULANMADI: korpusun 84
 * tabanının tamamı 11 kökün içinde, yani "hiçbir köke girmeyen" vaka yok.
 * Başlangıç değerleri kapsam bandından devralındı ve `NEEDS_VERIFICATION`
 * olarak işaretlendi. Doğrulaması: 11 kök dışından gerçek talep cümleleri
 * toplanıp ayrı bir eksen olarak koşulmalı.
 */
export const JEV_OUT_OF_TAXONOMY_CERTAIN_MIN = 0.8;
export const JEV_OUT_OF_TAXONOMY_CLEAR_MAX = 0.4;

/** Ağ bütçesi — tek çağrı, üç soru. Ölçülen p50 317 ms, p95 377 ms. */
export const JEV_TIMEOUT_MS = 4000;

export type JevGateOutcome =
  | "USE_DECISION"
  | "ASK_CLARIFICATION"
  | "OUT_OF_SCOPE"
  | "OUT_OF_TAXONOMY";
