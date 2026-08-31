/**
 * Pazar ve Talep Zekâsı — v1 olay sözleşmesi (FOUNDATION, 2026-08-31).
 *
 * `docs/MARKET-INTELLIGENCE-PROGRAM.md` ölçüm sözlüğünün KOD karşılığıdır.
 * Dört kanonik olay AYRI sayılır; kabul ile tamamlanan satış asla aynı
 * metrik değildir. Bu modül üretici BAĞLAMAZ (DW-2 ayrı dilimdir) ve
 * operasyonel veritabanına DOKUNMAZ — prisma import'u yasaktır, kapı bunu
 * ölçer (verify-market-intelligence-foundation-v1).
 *
 * PII sınırı: kullanıcı kimliği, e-posta, serbest metin TAŞINMAZ.
 * requestId/companyId geri çözülemez özete indirilir; provinceCode yalnız
 * mevcut allowlist yetkilisinden geçerse taşınır (ikinci liste kurulmaz).
 */
import { createHash } from "node:crypto";

import {
  isProvinceCode,
  type ProvinceCode,
} from "@/lib/observability/province-allowlist";
import {
  ProductEventName,
  type ProductEvent,
} from "@/lib/observability/product-events";

export const MARKET_EVENT_SCHEMA_VERSION = 1 as const;

/** Ölçüm sözlüğündeki dört kanonik olay — huninin dört AYRI adımı. */
export const MarketEventName = {
  REQUEST_PUBLISHED: "request_published",
  OFFER_SUBMITTED: "offer_submitted",
  OFFER_ACCEPTED: "offer_accepted",
  DEAL_COMPLETED: "deal_completed",
} as const;

export type MarketEventName =
  (typeof MarketEventName)[keyof typeof MarketEventName];

export type MarketEvent = {
  schemaVersion: typeof MARKET_EVENT_SCHEMA_VERSION;
  event: MarketEventName;
  /** Idempotent kimlik — aynı (olay, özne) çifti her üretimde aynı id'yi verir. */
  eventId: string;
  occurredAt: string;
  categoryId: string;
  /** Yalnız allowlist'ten geçen kod; geçmeyen değer TAŞINMAZ (null olur). */
  provinceCode: ProvinceCode | null;
  /** Geri çözülemez özetler — ham id warehouse'a asla gitmez. */
  requestRef: string;
  workspaceRef: string | null;
  /** Anonim aktör sınıfı — kimlik değil. */
  actorType: "buyer" | "seller" | "professional" | "corporate" | "system" | "anonymous";
};

/** Kanonik ürün olayı → warehouse olay adı eşlemesi (sözlükteki kaynak sütunu). */
const PRODUCT_TO_MARKET: Partial<Record<ProductEventName, MarketEventName>> = {
  [ProductEventName.REQUEST_PUBLISHED]: MarketEventName.REQUEST_PUBLISHED,
  [ProductEventName.OFFER_SUBMITTED]: MarketEventName.OFFER_SUBMITTED,
  [ProductEventName.OFFER_ACCEPTED]: MarketEventName.OFFER_ACCEPTED,
  // DW-2 (2026-08-31): üretici deal-outcome çift onay geçişidir
  // (justCompleted); kabul ile AYRIK sayılır.
  [ProductEventName.DEAL_COMPLETED]: MarketEventName.DEAL_COMPLETED,
};

/** Geri çözülemez, alan-ayrık özet: `sha256(alan:v1:değer)` ilk 16 baytı. */
export function irreversibleRef(field: "request" | "workspace", raw: string): string {
  return createHash("sha256")
    .update(`talepo-market-v1:${field}:${raw}`)
    .digest("hex")
    .slice(0, 32);
}

/** Aynı (olay, özne) için deterministik idempotent kimlik. */
export function marketEventId(event: MarketEventName, subjectRef: string): string {
  return createHash("sha256")
    .update(`talepo-market-event-v1:${event}:${subjectRef}`)
    .digest("hex")
    .slice(0, 32);
}

export type MarketEventInput = {
  productEvent: ProductEvent;
  categoryId: string | null | undefined;
  provinceCode: string | null | undefined;
  /** Idempotency öznesi: olayın tekil ürün kimliği (offerId, requestId, dealId). */
  subjectId: string | null | undefined;
};

/**
 * Ürün olayını v1 warehouse olayına dönüştürür; sözleşmeyi sağlayamayan
 * girdi SESSİZCE sayıya dönüşmez — null döner ve çağıran saymaz
 * (ölçülmeyen, sıfır değildir).
 */
export function toMarketEvent(input: MarketEventInput): MarketEvent | null {
  const mapped = PRODUCT_TO_MARKET[input.productEvent.eventName];
  if (!mapped) return null;
  const categoryId = input.categoryId?.trim();
  const subjectId = input.subjectId?.trim();
  if (!categoryId || !subjectId) return null;
  const subjectRef = irreversibleRef("request", subjectId);
  return {
    schemaVersion: MARKET_EVENT_SCHEMA_VERSION,
    event: mapped,
    eventId: marketEventId(mapped, subjectRef),
    occurredAt: input.productEvent.occurredAt,
    categoryId,
    provinceCode: isProvinceCode(input.provinceCode) ? input.provinceCode : null,
    requestRef: input.productEvent.requestId
      ? irreversibleRef("request", input.productEvent.requestId)
      : subjectRef,
    workspaceRef: input.productEvent.companyId
      ? irreversibleRef("workspace", input.productEvent.companyId)
      : null,
    actorType: input.productEvent.actorType,
  };
}
