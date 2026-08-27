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
  "tech-02": "INFERRED",
  "tech-03": "INFERRED",
  "tech-10": "INFERRED",
  "print-07": "INFERRED",
  "appl-04": "INFERRED",
  "appl-06": "INFERRED",
  "appl-07": "INFERRED",
  "mach-03": "INFERRED",
  "mach-07": "INFERRED",
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
  brandEvidenceInferred: 9,
  brandEvidenceVerified: 7,
  brandEvidenceUserExplicit: 0,
  /** Envelope markası VAR ve kanıtı merdivende ≥ VERIFIED. */
  brandRoutableTrusted: 7,
  /**
   * KNOWN-OPEN (ürün kodu, bu turun kapsamı dışında). Kanıt kaydının
   * DEĞERİ "VERIFIED_CATALOG" / "USER_ASSERTED" diyor ama kaydın kendi
   * provenance/source bilgisi çıkarım seviyesinde yazılmış. Ölçüm kanonik
   * merdiveni okur; değer dizesinden ikinci bir güven kaynağı türetmez.
   */
  evidenceValueClaimsAuthorityAboveRecord: 9,
} as const;

/**
 * ESKİ KAYIT ÖRNEĞİ — provenance'sız legacy marka kanıtı.
 *
 * D3c-b öncesi yazılmış snapshot'larda değer `attributes.brandEvidence`
 * içindedir ve otorite bilgisi HİÇ yoktur. Otoritesi uydurulamaz; bilinmiyor
 * demek `UNKNOWN` demektir ve UNKNOWN güvenilir değildir.
 */
export const LEGACY_BRAND_EVIDENCE_VALUE = "VERIFIED_CATALOG";
