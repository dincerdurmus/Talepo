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
 * TAKSONOMİ DIŞI — NOUL TASARIMI ÖLÇÜLDÜ VE **TERK EDİLDİ** (2026-09-25).
 *
 * Aşağıdaki iki eşik `NEEDS_VERIFICATION` olarak konmuştu ve doğrulama sonucu
 * olumsuz çıktı: soru HİÇ AYRIŞMIYOR. 11 kökün dışından 77 gerçek talep
 * cümlesiyle ölçüldü (`qa/open-set` A kümesi, dev yarısı,
 * `model-eval-jev-taxonomy-gate-v2`):
 *
 *   noul tasarımı  →  yakalama 0/77 (%0,0)  ·  emin-ama-yanlış 17
 *
 * Yani hiçbir eşik işe yaramıyor; kök İÇİNDEKİ cümleler bu soruda daha yüksek
 * puan alıyor. Sabitler SİLİNMEDİ çünkü terk edilen tasarımın ölçümünü koşan
 * tarihsel sonda (`model-eval-out-of-taxonomy-probe-v1`) onları okur; üretim
 * yolu artık okumaz. Kazanılmamış bir statü taşımamaları için adları
 * SUPERSEDED olarak işaretlidir.
 */
export const JEV_OUT_OF_TAXONOMY_CERTAIN_MIN = 0.8;
export const JEV_OUT_OF_TAXONOMY_CLEAR_MAX = 0.4;

/**
 * TAKSONOMİ SEÇİMİ EŞİĞİ — ÖLÇÜLDÜ VE SEÇİLDİ (2026-09-25).
 *
 * Kazanan tasarım: taksonomi-dışılık ayrı bir noul DEĞİL, 12 SEÇENEKLİ tek
 * choice'tır — 11 kök + açıkça tarif edilmiş `HICBIRI`. Aynı 161 cümlede
 * (A dev 77 + B dev 84) ölçülen karşılaştırma:
 *
 *   | tasarım                | A yakalama | A emin-ama-yanlış | B yanlış alarm |
 *   |------------------------|-----------|-------------------|----------------|
 *   | noul (bugünkü)         | 0/77  %0,0 | 17               | 0/84           |
 *   | 12 seçenekli choice    | 70/77 %90,9| 1                | 1/84 %1,2      |
 *   | kural dayanağı reddeder| 76/77 %98,7| 0                | 15/84 %17,9    |
 *
 * `choice` kazandı: yakalamayı sıfırdan %90,9'a çıkarırken B kümesinde doğru
 * kök oranını DÜŞÜRMEDİ (82/84 → 83/84).
 *
 * EŞİK 0,5 SEÇİLDİ — süpürme ölçüldü:
 *   0,0  → yakalama 70/77, B yanlış alarm 1
 *   0,5  → yakalama 64/77 (%83,1), B yanlış alarm 0   <-- seçilen
 *   0,8  → yakalama 59/77, B yanlış alarm 0
 * 0,5 dizin: yanlış alarmı sıfıra indiren en düşük eşik. Daha yükseğe çıkmak
 * beş vaka daha kaybettiriyor ve karşılığında hiçbir şey kazandırmıyor.
 *
 * KATEGORİ SORUSUNA DOKUNULMADI. D-0029 ölçtü: kapsamı 12. seçenek yapmak
 * kategori dağılımını kirletiyordu. Bu yüzden yeni seçim AYRI bir soru olarak
 * eklendi; `kategori` sorusunun metni birebir korunur ve 1077 vakalık ölçümü
 * geçerli kalır.
 */
export const JEV_OUT_OF_TAXONOMY_CHOICE = "HICBIRI" as const;
export const JEV_OUT_OF_TAXONOMY_CHOICE_MIN = 0.5;

/** Ağ bütçesi — tek çağrı, üç soru. Ölçülen p50 317 ms, p95 377 ms. */
export const JEV_TIMEOUT_MS = 4000;

export type JevGateOutcome =
  | "USE_DECISION"
  | "ASK_CLARIFICATION"
  | "OUT_OF_SCOPE"
  | "OUT_OF_TAXONOMY";
