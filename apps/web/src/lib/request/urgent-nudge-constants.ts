/**
 * Window after publish before an urgent request without offers nudges the buyer.
 * Testing: 1 minute. Production should be 1 hour (3_600_000).
 */
export const URGENT_NO_OFFER_NUDGE_MS = 60_000;

export const URGENT_NO_OFFER_NUDGE_TITLE = "Teklif gelmedi";

export const URGENT_NO_OFFER_NUDGE_MESSAGE =
  "Teklif gelmedi. Talebi, kayıtlı ve ürününüzü tedarik edebilecek kullanıcılara doğrudan bildirim olarak göndermek ister misiniz?";
