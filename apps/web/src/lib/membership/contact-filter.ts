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
