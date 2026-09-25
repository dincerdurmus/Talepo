/**
 * YAYIN SONRASI DURUM METNİ — TEK KAYNAK (D-0032, 2026-09-25).
 *
 * Kusur ölçüldü: /talep yayın anı her zaman "Talebiniz yayınlandı" diyordu.
 * Oysa şüpheli talep `PENDING_REVIEW` ile kaydedilir, `publishedAt` boş
 * kalır ve HİÇBİR tedarikçi onu göremez. Kullanıcıya "yayında" demek, olmayan
 * bir şeyi olmuş gibi bildirmektir — teklif beklemeye başlar, gelmez.
 *
 * Karar SUNUCUDAN gelir, burada yeniden üretilmez: `/api/requests` cevabı
 * zaten talebin `status` ve `publishedAt` alanlarını döndürür. Bu modül o iki
 * alanı okur ve tek bir sonuç nesnesi verir. İkinci bir "yayında mı" kuralı
 * yoktur; eşik değerleri kanonik `review-hold` tanımından okunur.
 *
 * Metin de uydurulmaz: bekleme süresi cümlesi moderasyon SLA'sını tek
 * otorite kabul eden `reviewHoldNotice()`ten gelir.
 */

import { reviewHoldNotice } from "@/lib/request-composer/v2/publish-readiness";
import { REVIEW_HOLD_STATUS } from "@/lib/request/review-hold";

export type PublishOutcomeKind = "published" | "pending_review";

export type PublishOutcome = {
  kind: PublishOutcomeKind;
  /** Kartın üstündeki mono rozet. */
  badge: string;
  /** Büyük başlık. */
  headline: string;
  /** Açıklama cümlesi. */
  detail: string;
};

export function publishOutcomeFrom(input: {
  status?: string | null;
  publishedAt?: string | Date | null;
}): PublishOutcome {
  const held =
    input.status === REVIEW_HOLD_STATUS ||
    input.publishedAt == null ||
    input.publishedAt === "";

  if (held) {
    return {
      kind: "pending_review",
      badge: "İncelemede",
      headline: "Talebin incelemeye alındı",
      detail: reviewHoldNotice(),
    };
  }

  return {
    kind: "published",
    badge: "Yayında",
    headline: "Talebin yayında",
    detail:
      "Tedarikçiler talebini görebilir. Teklifler geldikçe Taleplerim'de toplanır.",
  };
}
