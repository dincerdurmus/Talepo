/**
 * İNCELEME BEKLEYEN TALEBİN GÖRÜNMEZLİK FİLTRESİ — TEK TANIM (D-0032).
 *
 * "Şüpheli talep kaydedilir ama YAYINLANMAZ" cümlesinin tek gerçek karşılığı
 * budur: hiçbir tedarikçi, eşleştirme, alarm, bildirim, keşfet, fiyat zekâsı
 * ya da cron yolu onu GÖREMEZ. Bu bir görsel gizleme değil, bir güven
 * sınırıdır; sınır tek bir yerde tanımlanır ki yeni bir okuma yüzeyi
 * eklendiğinde "hangi alanı filtreleyecektim" sorusu tek cevaplı olsun.
 *
 * NEDEN İKİ ALAN BİRDEN.
 *  - `publishedAt: { not: null }` — inceleme bekleyen talepte yayın anı YOKTUR.
 *  - `isModerationHidden: false` — moderatör sonradan gizlerse de kapanır.
 * İkisi ayrı sebeplerle boş kalabilir; biri unutulursa diğeri tutar.
 *
 * `status` alanı BİLEREK YOK. Yüzeylerin çoğu zaten `status: { in: [...] }`
 * ile beyaz liste kuruyor ve `PENDING_REVIEW` yeni bir enum DEĞERİ olduğu
 * için o listelere hiç girmez — yani orada koruma yapısaldır. Buraya ikinci
 * bir `status` anahtarı koymak o sorguları derleme hatasına ya da sessiz
 * çakışmaya sokardı.
 */
export const REVIEW_HOLD_GUARD = {
  isModerationHidden: false,
  publishedAt: { not: null },
} as const;

/** Talebin okuma yüzeylerinden saklanması gereken durum değeri. */
export const REVIEW_HOLD_STATUS = "PENDING_REVIEW" as const;
