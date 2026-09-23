/** Non-global patterns for `.test()` (avoids lastIndex flakiness). */
const PHONE_TEST =
  /(\+?\d[\d\s().-]{8,}\d|0\s?\d{3}\s?\d{3}\s?\d{2}\s?\d{2})/i;
const IBAN_TEST = /\bTR\d{2}(?:\s?\d{4}){5}\s?\d{2}\b/i;
const EMAIL_TEST = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const EXTERNAL_TEST =
  /\b(?:whatsapp|telegram|instagram|facebook)\b|wa\.me|t\.me/i;

export function sanitizeCommercialText(text: string) {
  return text
    .replace(
      /(\+?\d[\d\s().-]{8,}\d|0\s?\d{3}\s?\d{3}\s?\d{2}\s?\d{2})/gi,
      "[iletişim bilgisi gizlendi]",
    )
    .replace(/\bTR\d{2}(?:\s?\d{4}){5}\s?\d{2}\b/gi, "[IBAN gizlendi]")
    .replace(
      /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi,
      "[e-posta gizlendi]",
    )
    .replace(
      /\b(?:whatsapp|telegram|instagram|facebook)\b|wa\.me|t\.me/gi,
      "[harici bağlantı gizlendi]",
    );
}

export function containsBlockedContactInfo(text: string) {
  const sample = text.slice(0, 5000);
  return (
    PHONE_TEST.test(sample) ||
    IBAN_TEST.test(sample) ||
    EMAIL_TEST.test(sample) ||
    EXTERNAL_TEST.test(sample)
  );
}

/**
 * TALEP METNİNDEKİ İLETİŞİM BİLGİSİ (kurucu kararı D-0031, 2026-09-23).
 *
 * Talepte iletişim bilgisi ENGELLENMEZ — kullanıcı uyarılır ve seçer.
 * Ama uyarıyı gösterebilmek için NE bulunduğunu bilmek gerekir. Bu iki
 * fonksiyon, aynı dosyadaki AYNI kalıpları okur; ikinci bir algılayıcı
 * yazılmaz. Teklif ve değerlendirme yollarındaki engelleme davranışı
 * (`containsBlockedContactInfo`) olduğu gibi kalır — orada karar farklıdır.
 */
export type ContactInfoKind = "PHONE" | "EMAIL" | "IBAN" | "SOCIAL";

/** Metinde hangi TÜR iletişim bilgisi var? Değerin kendisi DÖNMEZ. */
export function describeContactInfo(text: string): ContactInfoKind[] {
  const sample = text.slice(0, 5000);
  const kinds: ContactInfoKind[] = [];
  if (PHONE_TEST.test(sample)) kinds.push("PHONE");
  if (EMAIL_TEST.test(sample)) kinds.push("EMAIL");
  if (IBAN_TEST.test(sample)) kinds.push("IBAN");
  if (EXTERNAL_TEST.test(sample)) kinds.push("SOCIAL");
  return kinds;
}

/**
 * "Kaldır" seçeneğinin karşılığı: bilgi metinden ÇIKARILIR, geri kalanı
 * korunur.
 *
 * `sanitizeCommercialText`ten farkı bilerek: o, yerine "[iletişim bilgisi
 * gizlendi]" yazar çünkü orada karşı tarafın bir şeyin gizlendiğini görmesi
 * gerekir. Burada kullanıcı kendi metninden silmeyi SEÇMİŞTİR; ona bir
 * gizleme etiketi bırakmak, silmedik demektir.
 */
export function stripContactInfo(text: string): string {
  return text
    .replace(/(\+?\d[\d\s().-]{8,}\d|0\s?\d{3}\s?\d{3}\s?\d{2}\s?\d{2})/gi, " ")
    .replace(/\bTR\d{2}(?:\s?\d{4}){5}\s?\d{2}\b/gi, " ")
    .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, " ")
    .replace(/\b(?:whatsapp|telegram|instagram|facebook)\b|wa\.me|t\.me/gi, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}
