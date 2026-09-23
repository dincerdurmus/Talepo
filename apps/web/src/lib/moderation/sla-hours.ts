/**
 * MODERASYON SLA SAATLERİ — TEK TANIM.
 *
 * Tablo `server/admin/moderation-sla.ts` içinde modül-yerel yaşıyordu. D-0032
 * ile kullanıcıya gösterilen "genellikle N saat içinde" metni de aynı sayıya
 * ihtiyaç duydu; metne elle "24" yazmak iki otorite yaratır ve SLA değiştiği
 * gün kullanıcıya yalan söyler. Tanım TAŞINDI, çoğaltılmadı: hem sunucu
 * hesabı hem istemci metni burayı okur.
 *
 * İstemciden de okunabilsin diye `lib` altındadır ve hiçbir sunucu modülüne
 * bağımlı değildir.
 */
export const MODERATION_SLA_HOURS = {
  CRITICAL: 4,
  HIGH: 24,
  MEDIUM: 48,
  LOW: 72,
} as const;

export type ModerationSlaPriority = keyof typeof MODERATION_SLA_HOURS;
