/**
 * HUKUKİ METİNLERİN TEK DOLDURMA NOKTASI (2026-09-15).
 *
 * KVKK aydınlatma metni ve kullanım koşulları, şirket bilgisini buradan
 * okur. Amaç: Dinçer'in metinlerin içinde tek tek yer tutucu aramaması —
 * yalnız bu dosyayı doldurması yeter.
 *
 * BOŞ BIRAKILAN ALAN GİZLENMEZ. `null` kalan her alan sayfada sarı bir
 * "DOLDURULACAK" rozeti olarak görünür. Bilinçli bir karardır: eksik bir
 * hukuki metni tamammış gibi yayımlamak, hiç yayımlamamaktan kötüdür ve
 * fark edilmesi imkânsız olur.
 */
export type LegalPlaceholder = string | null;

export const LEGAL_ENTITY = {
  /** Ticaret unvanı — ör. "Talepo Teknoloji A.Ş." */
  legalName: null as LegalPlaceholder,
  /** Açık adres */
  address: null as LegalPlaceholder,
  /** MERSİS numarası */
  mersis: null as LegalPlaceholder,
  /** Vergi dairesi ve numarası */
  taxOffice: null as LegalPlaceholder,
  /** KEP adresi */
  kep: null as LegalPlaceholder,
  /** VERBİS kayıt numarası (kayıt yükümlülüğü varsa) */
  verbis: null as LegalPlaceholder,
  /** KVKK başvurularının geleceği e-posta */
  kvkkEmail: null as LegalPlaceholder,
  /** Genel destek e-postası */
  supportEmail: null as LegalPlaceholder,
  /** Uyuşmazlıkta yetkili mahkeme/icra şehri */
  jurisdictionCity: null as LegalPlaceholder,
  /** Metinlerin yürürlük tarihi — ör. "1 Ekim 2026" */
  effectiveDate: null as LegalPlaceholder,
  /** Barındırma sağlayıcısı ve veri merkezi bölgesi */
  hostingProvider: null as LegalPlaceholder,
  /** Veritabanı sağlayıcısı ve veri merkezi bölgesi */
  databaseProvider: null as LegalPlaceholder,
  /** E-posta bildirim sağlayıcısı unvanı */
  emailProvider: null as LegalPlaceholder,
  /** İlan edilen fiyatlar KDV dahil mi? */
  vatIncluded: null as LegalPlaceholder,
} as const;

export type LegalEntityKey = keyof typeof LEGAL_ENTITY;

/** Türkçe etiketler — eksik alan rozetinde gösterilir. */
export const LEGAL_ENTITY_LABELS: Record<LegalEntityKey, string> = {
  legalName: "ticaret unvanı",
  address: "adres",
  mersis: "MERSİS no",
  taxOffice: "vergi dairesi ve no",
  kep: "KEP adresi",
  verbis: "VERBİS kayıt no",
  kvkkEmail: "KVKK başvuru e-postası",
  supportEmail: "destek e-postası",
  jurisdictionCity: "yetkili mahkeme şehri",
  effectiveDate: "yürürlük tarihi",
  hostingProvider: "barındırma sağlayıcısı",
  databaseProvider: "veritabanı sağlayıcısı",
  emailProvider: "e-posta sağlayıcısı",
  vatIncluded: "KDV dahil/hariç",
};

export function missingLegalFields(): LegalEntityKey[] {
  return (Object.keys(LEGAL_ENTITY) as LegalEntityKey[]).filter(
    (key) => !LEGAL_ENTITY[key],
  );
}
