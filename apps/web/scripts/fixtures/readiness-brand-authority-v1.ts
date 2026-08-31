/**
 * READINESS MARKA OTORİTESİ — DONDURULMUŞ TABAN (2026-08-27).
 *
 * Bu fixture YALNIZ tek bir metriğin kimliklerini dondurur: readiness Pro
 * formülüne giren `BRAND_ROUTABLE_TRUSTED` kümesi. Kategori kapsam
 * senaryolarının (`category-coverage-v1.ts`) beklentileri, puanı ya da
 * readiness formülü buraya taşınmaz; o dosya bu turda DEĞİŞMEDİ.
 *
 * NEDEN AYRI BİR DOSYA. D3c-b (111b412) iç kanıtı `snapshot.attributes`
 * torbasından tipli `internalEvidence` kanalına taşıdı. Ölçüm aracı eski
 * yolu okumaya devam ettiği için marka kanıtı görünmez oldu ve Pro
 * hazırlığı sahte olarak düştü. Aynı ölçüm daha önce de yanlıştı: anahtarın
 * VARLIĞINI güven sayıyordu, bu yüzden sahte olarak yüksekti. İki hata da
 * aynı kök nedenden gelir — "kanıt var" ile "bu kanıt yönlendirmede
 * güvenilir" tek sayıya sıkıştırılmıştı. Kimlikler burada donuyor ki
 * gelecekteki bir düzeltme bu kümeyi sessizce büyütüp küçültemesin.
 *
 * GÜVEN KURALI (kurucu, 2026-08-27). Güven kararı kanonik otorite
 * merdiveninden okunur (`request-understanding/provenance.ts`:
 * `Authority` / `isAtLeastAuthority`). `VERIFIED` ve `USER_EXPLICIT`
 * güvenilirdir; `INFERRED` ve `UNKNOWN` değildir. Burada ikinci bir rank
 * tablosu ya da kaynak listesi YOKTUR.
 */

/**
 * GÜVENİLİR MARKA KİMLİKLERİ — çift yönlü doğrulanır (missing=0,
 * unexpected=0). Yedisi de katalog zenginleştirmesinden geçmiştir:
 * kayıt `source: FUTURE_KNOWLEDGE` taşır ve kanonik merdivende `VERIFIED`
 * seviyesine çıkar.
 */
export const TRUSTED_BRAND_IDENTITIES = [
  "auto-01",
  "auto-02",
  "auto-03",
  "auto-04",
  "auto-07",
  "auto-08",
  "auto-10",
  // Wave K (2026-08-31): KNOWN-OPEN 9 kaydın sertifika merdiveni ürün
  // kodunda düzeltildi (understand-request brandEvidence kaydı artık
  // belgelediği statüyü taşıyor). Delta satır satır sayıldı ve TAM olarak
  // 7aa6990'da adlarıyla dondurulan kümedir; 8'i envelope markası
  // taşıdığı için güvenilir kümeye girdi. mach-07 USER_EXPLICIT oldu ama
  // envelope markası yok — "present ≠ trusted" ayrımı bozulmadı.
  "tech-02",
  "tech-03",
  "tech-10",
  "print-07",
  "appl-04",
  "appl-06",
  "appl-07",
  "mach-03",
] as const;

/**
 * MARKA KANITI TAŞIYAN BÜTÜN KİMLİKLER ve kanonik otoriteleri.
 *
 * `mach-07` kanıt taşır ama envelope'a marka çıkmaz: "kanıt mevcut" ile
 * "yönlendirilebilir marka" ayrı sayılardır ve bu kimlik ikisinin
 * birbirine karıştırılmadığını kanıtlar.
 */
export const BRAND_EVIDENCE_AUTHORITY_BASELINE: Readonly<
  Record<string, "UNKNOWN" | "INFERRED" | "VERIFIED" | "USER_EXPLICIT">
> = {
  "auto-01": "VERIFIED",
  "auto-02": "VERIFIED",
  "auto-03": "VERIFIED",
  "auto-04": "VERIFIED",
  "auto-07": "VERIFIED",
  "auto-08": "VERIFIED",
  "auto-10": "VERIFIED",
  // Wave K (2026-08-31): sertifika kaydı artık belgelediği statüyü taşır —
  // VERIFIED_CATALOG → VERIFIED (PRODUCT_IDENTITY), USER_ASSERTED →
  // USER_EXPLICIT. Bu 9 satır 7aa6990'ın KNOWN-OPEN kümesinin kendisidir.
  "tech-02": "VERIFIED",
  "tech-03": "VERIFIED",
  "tech-10": "VERIFIED",
  "print-07": "VERIFIED",
  "appl-04": "VERIFIED",
  "appl-06": "VERIFIED",
  "appl-07": "VERIFIED",
  "mach-03": "VERIFIED",
  "mach-07": "USER_EXPLICIT",
};

/**
 * ÖLÇÜLMÜŞ TABAN SAYILARI. Tek tek kimliklerden türetilebilir olsalar da
 * ayrıca yazılırlar: bir düzeltme kimlik listesini ve sayıyı aynı anda
 * kaydırırsa iki yönlü karşılaştırma bunu yakalar.
 */
export const BRAND_BASELINE = {
  scenarios: 108,
  /** Envelope'a marka çıkan senaryo sayısı (kanıt otoritesinden bağımsız). */
  brandPresent: 15,
  /** Marka kanıtı KAYDI bulunan senaryo sayısı (tipli kanal + legacy). */
  brandEvidencePresent: 16,
  brandEvidenceUnknown: 0,
  // Wave K (2026-08-31): KNOWN-OPEN 9'un ürün kodundaki kapanışı sonrası
  // dağılım — 8 VERIFIED_CATALOG kaydı VERIFIED'a, mach-07 (USER_ASSERTED)
  // USER_EXPLICIT'e çıktı; INFERRED sertifika kaydı kalmadı.
  brandEvidenceInferred: 0,
  brandEvidenceVerified: 15,
  brandEvidenceUserExplicit: 1,
  /** Envelope markası VAR ve kanıtı merdivende ≥ VERIFIED. */
  brandRoutableTrusted: 15,
  /**
   * KNOWN-OPEN kapandı (Wave K): kanıt kaydının değeri ile kaydın kendi
   * merdiven yeri artık çelişmiyor. Sayaç kasıtlı olarak kaldı ki bir
   * regresyon çelişkiyi yeniden üretirse çift yönlü karşılaştırma yakalasın.
   */
  evidenceValueClaimsAuthorityAboveRecord: 0,
} as const;

/**
 * ESKİ KAYIT ÖRNEĞİ — provenance'sız legacy marka kanıtı.
 *
 * D3c-b öncesi yazılmış snapshot'larda değer `attributes.brandEvidence`
 * içindedir ve otorite bilgisi HİÇ yoktur. Otoritesi uydurulamaz; bilinmiyor
 * demek `UNKNOWN` demektir ve UNKNOWN güvenilir değildir.
 */
export const LEGACY_BRAND_EVIDENCE_VALUE = "VERIFIED_CATALOG";
