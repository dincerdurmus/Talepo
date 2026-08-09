const PHONE_PATTERN =
  /(\+?\d[\d\s().-]{8,}\d|0\s?\d{3}\s?\d{3}\s?\d{2}\s?\d{2})/gi;

const IBAN_PATTERN = /\bTR\d{2}(?:\s?\d{4}){5}\s?\d{2}\b/gi;

const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

const EXTERNAL_LINK_PATTERN =
  /\b(?:whatsapp|telegram|instagram|facebook)\b|wa\.me|t\.me/gi;

export function sanitizeCommercialText(text: string) {
  return text
    .replace(PHONE_PATTERN, "[iletişim bilgisi gizlendi]")
    .replace(IBAN_PATTERN, "[IBAN gizlendi]")
    .replace(EMAIL_PATTERN, "[e-posta gizlendi]")
    .replace(EXTERNAL_LINK_PATTERN, "[harici bağlantı gizlendi]");
}

export function containsBlockedContactInfo(text: string) {
  const sample = text.slice(0, 5000);
  return (
    PHONE_PATTERN.test(sample) ||
    IBAN_PATTERN.test(sample) ||
    EXTERNAL_LINK_PATTERN.test(sample)
  );
}
