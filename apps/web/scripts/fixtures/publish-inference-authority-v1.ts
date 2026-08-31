/**
 * YAYIN ÇIKARIM OTORİTESİ — DONDURULMUŞ TABAN V1 (D3c-a, 2026-08-27).
 *
 * BU DOSYA BAĞIMSIZ VERİ OTORİTESİDİR. İçerik, HEAD `eb317dc` üzerinde
 * `verify-publish-inference-authority-v1.ts` ölçümünden BİR KEZ okunarak ELLE
 * donduruldu. Üretim kodundan, verifier ölçümünden ya da başka bir koddan
 * ÇALIŞMA ANINDA TÜRETİLMEZ ve otomatik güncellenmez — bu dosyada import
 * olmaması verifier tarafından ayrıca denetlenir.
 *
 * NEDEN DONDURULDU. Bir çıkarım kimliği ölçüm evreninden sessizce kaybolursa
 * (anlama katmanı o alanı artık çıkaramazsa), "sızan 0" hükmü yanlış başarıya
 * dönüşür: sızacak kimse kalmadığı için sıfırdır. Taban dondurulunca kaybolan
 * kimlik de, açıklanamayan yeni kimlik de ayrı ayrı KIRMIZI olur; toplam sayı
 * tek başına başarı sayılmaz.
 *
 * BU LİSTELERİ DEĞİŞTİRMEK BİR SÖZLEŞME KARARIDIR. Anlama katmanı bilinçli
 * olarak yeni bir çıkarım kazandığında ya da bir çıkarım bilinçli olarak
 * kaldırıldığında, fark burada TEK TEK kimlik olarak ve karar gerekçesiyle
 * güncellenir; verifier çıktısından kopyalanarak "yeşile boyanmaz".
 *
 * SIRALAMA SÖZLEŞMESİ: her iki liste kod-birimi (`Array.prototype.sort`
 * varsayılanı) sırasında ve benzersizdir; verifier bunu da denetler.
 */

/**
 * Ölçülen çıkarım evreni: 108 senaryoluk kapsama tabanında, serbest metin
 * sonrası kanonik durumda `INFERRED` otoriteyle değer taşıyan 85 kimlik
 * (`senaryo/alanAnahtarı`). İç kanıt alanları (`brandCandidate`,
 * daralması demektir.
 */
export const BASELINE_INFERRED_IDENTITIES: readonly string[] = [
  "appl-06/needType",
  "appl-07/needType",
  "appl-08/needType",
  "appl-09/needType",
  "auto-01/needType",
  "auto-02/condition",
  "auto-02/needType",
  "auto-03/needType",
  "auto-04/needType",
  "auto-05/brandCandidate",
  "auto-05/needType",
  "auto-06/needType",
  "auto-07/needType",
  "auto-08/condition",
  "auto-08/needType",
  "auto-09/brandCandidate",
  "auto-09/needType",
  "auto-10/needType",
  "auto-11/brandCandidate",
  "auto-11/needType",
  "auto-12/needType",
  "furn-01/usageArea",
  "furn-03/brandCandidate",
  "furn-03/needType",
  "furn-04/usageArea",
  "furn-05/needType",
  "furn-07/usageArea",
  "furn-08/brandCandidate",
  "furn-08/needType",
  "health-03/usageArea",
  "health-06/needType",
  "health-06/solutionType",
  "home-04/brandCandidate",
  "home-06/brandCandidate",
  "home-07/brandCandidate",
  "mach-01/needType",
  "mach-02/needType",
  "mach-03/needType",
  "mach-05/brandCandidate",
  "mach-05/needType",
  "mach-07/needType",
  "mach-08/needType",
  "print-04/brandCandidate",
  "print-07/needType",
  "print-11/needType",
  "print-12/brandCandidate",
  "re-01/brandCandidate",
  "re-05/brandCandidate",
  "re-11/brandCandidate",
  "re-12/brandCandidate",
  "svc-01/needType",
  "svc-02/needType",
  "svc-03/needType",
  "svc-04/needType",
  "svc-05/brandCandidate",
  "svc-05/needType",
  "svc-06/brandCandidate",
  "svc-06/needType",
  "svc-07/brandCandidate",
  "svc-07/needType",
  "svc-08/needType",
  "tech-01/needType",
  "tech-01/solutionType",
  "tech-02/solutionType",
  "tech-03/needType",
  "tech-03/solutionType",
  "tech-05/brandCandidate",
  "tech-05/needType",
  "tech-06/brandCandidate",
  "tech-06/needType",
  "tech-07/needType",
  "tech-08/needType",
  "tech-09/needType",
  "tech-10/needType",
  "tech-10/solutionType",
  "tech-11/needType",
];

/**
 * D3c-a öncesi kullanıcı cevabı kanalına SIZAN aile: kullanıcı dokunuşu
 * olmadan yayın adayına dönüşen 23 çıkarım kimliği. Bunlar, görünür bir
 * kategori alanına (ya da beyaz eşyada `brandPreference` kanalına) değer
 * taşıdığı için süzgeç olmasaydı `payload.fields[]`e yazılacak kümedir.
 * Sözleşme: 23'ü de kanal DIŞINDA kalır ama kanonik durumda ve (sorusu
 * render edildiğinde) öneri katmanında değerleriyle DURUR.
 */
export const BASELINE_UNCONFIRMED_PUBLISH_CANDIDATES: readonly string[] = [
  "auto-02/condition",
  "furn-01/usageArea",
  "furn-04/usageArea",
  "furn-07/usageArea",
  "health-03/usageArea",
  "mach-01/needType",
  "mach-02/needType",
  "mach-03/needType",
  "mach-07/needType",
  "mach-08/needType",
  "print-07/needType",
  "tech-01/needType",
  "tech-01/solutionType",
  "tech-02/solutionType",
  "tech-03/needType",
  "tech-03/solutionType",
  "tech-05/needType",
  "tech-06/needType",
  "tech-07/needType",
  "tech-08/needType",
  "tech-10/needType",
  "tech-10/solutionType",
  "tech-11/needType",
];
