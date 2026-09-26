/**
 * KANONİK ALAN EVRENİ TABANI — TEK TANIM (2026-09-25 akşam).
 *
 * NEDEN BU DOSYA VAR. Aynı iki sayı DÖRT doğrulayıcıda ayrı ayrı yazılıydı
 * (`verify-common-field-response-v1` E2/E3, `verify-field-response-authority-v1`
 * F2/F3, `verify-generated-field-answer-v1` G2/G3,
 * `verify-nonvalue-answer-authority-v1` H2). Dördü de `CATEGORY_COVERAGE_V1`
 * korpusunu `createTextOnlyState` ile koşup aynı evreni sayıyor; yani tek bir
 * ölçüm dört yerde elle tutuluyordu. Bir taban tazelenip diğerleri
 * güncellenmediğinde CI dört ayrı kırmızı verir ve hangisinin gerçek olduğu
 * belirsizleşir — ölçüldü, 2026-09-25'te tam bu oldu.
 *
 * Sayı değiştiğinde tek yer güncellenir ve gerekçe burada, delta enumerasyonu
 * ile birlikte durur.
 *
 * ── TAZELEME GÜNLÜĞÜ ──────────────────────────────────────────────────────
 *
 * 1306 → 1307 · unknown 975 → 976 (2026-09-25 akşam)
 *
 * Delta `scripts/probe-field-delta.ts` (gitignore'da) ile iki durumda
 * dökülüp diff'lendi. TEK senaryo değişti:
 *
 *   health-04  "Klinik için steril eldiven arıyorum, 100 kutu"
 *     needType  VALUE "part"  →  UNKNOWN
 *     usageArea      (yok)    →  VALUE "Klinik"
 *
 * Sebep bir DÜZELTMEDİR. Eski durumda bu cümle **printing/CONFIDENT**
 * çözülüyordu (ölçüldü: detector=printing/5): matbaa sözlüğü "kutu"
 * sözcüğünü cümlenin her yerinde ürün sayıyordu ve bir kutu steril eldiven
 * MATBAACININ ücretli akışına düşüyordu. Ambalaj sözcüğü artık üretim kanıtı
 * ister (`ai/parser/category`; F holdout kümesinde yanlış EMİN iddia
 * 322 → 0) ve cümle doğru kökte, **health**'te çözülüyor.
 *
 * `usageArea="Klinik"` BENİM HÜKMÜM DEĞİL, DONDURULMUŞ TABANIN HÜKMÜ.
 * `verify-projection-authority-v1` aynı düzeltmeyle 108 → 104 ihlale indi ve
 * düşen dört satırın hepsi health-04'tür: `health-04/usageArea`
 * (attributes+constraints) daha önce "ölçüm evreninden KAYBOLDU" diye ihlal
 * sayılıyordu — yani dondurulmuş fixture o alanı BEKLİYOR ve düzeltme onu geri
 * getirdi; `health-04/needType` (attributes+constraints) ise "dondurulmuş
 * tabanda YOK — açıklanamayan yeni kimlik" diye ihlal sayılıyordu ve düştü.
 * OL-0011 notunun "Klinik kullanım bağlamıdır" cümlesi cümle BAŞKA bir
 * kökteyken yazılmıştı; kürasyonun kendi defteri tersini söylüyor. Karar yine
 * de kurucuya raporda açıkça bildirildi.
 */

/** `CATEGORY_COVERAGE_V1` korpusunda kurulan kanonik alan sayısı. */
export const CANONICAL_FIELD_UNIVERSE = 1307;

/** Aynı evrende varsayılan olarak UNKNOWN kalan alan sayısı. */
export const CANONICAL_FIELD_DEFAULT_UNKNOWN = 976;
