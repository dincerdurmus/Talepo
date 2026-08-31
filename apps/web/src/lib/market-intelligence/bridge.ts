/**
 * DW-2 köprüsü — ürün olayı → v1 warehouse olayı → sink (2026-08-31).
 *
 * Üreticiler kanonik SERVİS sınırında `trackProductEvent` çağırır (UI'dan
 * değil, başarılı DB işleminden sonra). Bu köprü o akışa abone olur ve v1
 * sözleşmesine `toMarketEvent` ile çevirir:
 *
 * - Sözleşmeyi sağlamayan olay (kategori/özne yok) SESSİZCE sayıya
 *   dönüşmez — düşer (ölçülmeyen, sıfır değildir).
 * - Idempotency: sink, deterministik eventId üzerinden aynı özneyi iki kez
 *   saymaz; retry duplicate analitik olay üretmez.
 * - Köprü/sink hatası ürün işlemini KIRAMAZ: teslim try/catch ile
 *   yalıtılır (product-events'in kendi sink yalıtımına ek savunma).
 * - Üretim kaydı BURADA yapılmaz: transport (ClickHouse batch) DW-3
 *   provision'ına bağlıdır; kayıt, transport'lu sink kurulduğunda yapılır.
 */
import {
  addProductEventSink,
  type ProductEvent,
} from "@/lib/observability/product-events";

import { toMarketEvent } from "./contract";
import type { WarehouseSink } from "./sink";

/** Olay başına idempotency öznesi — olayın TEKİL ürün kimliği. */
function subjectIdFor(event: ProductEvent): string | null {
  const meta = event.metadata ?? {};
  switch (event.eventName) {
    case "REQUEST_PUBLISHED":
      return event.requestId ?? null;
    case "OFFER_SUBMITTED":
    case "OFFER_ACCEPTED":
      return typeof meta.offerId === "string" ? meta.offerId : null;
    case "DEAL_COMPLETED":
      return typeof meta.dealOutcomeId === "string" ? meta.dealOutcomeId : null;
    default:
      return null;
  }
}

export function registerMarketIntelligenceBridge(
  sink: Pick<WarehouseSink, "offer">,
): () => void {
  return addProductEventSink((event) => {
    try {
      const meta = event.metadata ?? {};
      const marketEvent = toMarketEvent({
        productEvent: event,
        categoryId: typeof meta.categoryId === "string" ? meta.categoryId : null,
        provinceCode:
          typeof meta.provinceCode === "string" ? meta.provinceCode : null,
        subjectId: subjectIdFor(event),
      });
      if (marketEvent) sink.offer(marketEvent);
    } catch {
      // Teslim hatası ürün akışına DÖNMEZ; sink kendi sayaçlarını tutar.
    }
  });
}
