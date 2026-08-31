/**
 * Warehouse sink sınırı — FOUNDATION (2026-08-31).
 *
 * Gerçek dayanıklı teslim (outbox / ClickHouse günlük batch) DIŞ ALTYAPI
 * ister ve bu turda provision EDİLMEZ; bu modül onu taklit ETMEZ. Sahte bir
 * in-memory "dayanıklı" kuyruk kurmak yerine sınır dürüsttür:
 *
 * - Transport enjekte edilmemişse durum `DW_PROVISION_REQUIRED`dır ve olay
 *   sayılmadan düşer (düşen sayılır ve görünür — sessiz örnekleme yok).
 * - Teslim HİÇBİR ZAMAN ürün akışını bloklamaz: hata yutulur, sayaca yazılır.
 * - Batch modeli ClickHouse günlük batch başlangıç kararıyla uyumludur;
 *   ölçek continuous ingestion isterse geçiş sınırı programa yazılır
 *   (docs/MARKET-INTELLIGENCE-PROGRAM.md).
 */
import type { MarketEvent } from "./contract";

export type WarehouseDeliveryResult =
  | { ok: true; delivered: number }
  | { ok: false; reason: string };

/** Dış altyapının tek arayüzü — sağlayıcı kararı (DW-3) bu arayüzün arkasında. */
export type WarehouseTransport = {
  name: string;
  deliverBatch(events: MarketEvent[]): Promise<WarehouseDeliveryResult>;
};

export type WarehouseSinkStatus = {
  transport: string | null;
  state: "DW_PROVISION_REQUIRED" | "READY";
  buffered: number;
  deliveredTotal: number;
  droppedNoTransport: number;
  failedDeliveries: number;
};

export type WarehouseSink = {
  offer(event: MarketEvent): void;
  flush(): Promise<WarehouseDeliveryResult>;
  status(): WarehouseSinkStatus;
};

export function createBufferedWarehouseSink(options?: {
  transport?: WarehouseTransport | null;
  maxBuffer?: number;
}): WarehouseSink {
  const transport = options?.transport ?? null;
  const maxBuffer = options?.maxBuffer ?? 1000;
  const buffer: MarketEvent[] = [];
  const seen = new Set<string>();
  let deliveredTotal = 0;
  let droppedNoTransport = 0;
  let failedDeliveries = 0;

  return {
    offer(event) {
      if (!transport) {
        // Dürüst düşüş: sayılır, taklit edilmez.
        droppedNoTransport += 1;
        return;
      }
      if (seen.has(event.eventId)) return; // idempotent: aynı olay iki kez sayılmaz
      if (buffer.length >= maxBuffer) {
        failedDeliveries += 1;
        return;
      }
      seen.add(event.eventId);
      buffer.push(event);
    },
    async flush() {
      if (!transport) return { ok: false, reason: "DW_PROVISION_REQUIRED" };
      if (!buffer.length) return { ok: true, delivered: 0 };
      const batch = buffer.splice(0, buffer.length);
      try {
        const result = await transport.deliverBatch(batch);
        if (result.ok) {
          deliveredTotal += result.delivered;
          return result;
        }
        failedDeliveries += 1;
        // Başarısız teslim ürünü bloklamaz; olaylar bir sonraki flush için geri konur.
        for (const ev of batch) buffer.push(ev);
        return result;
      } catch (error) {
        failedDeliveries += 1;
        for (const ev of batch) buffer.push(ev);
        return { ok: false, reason: String((error as Error)?.message ?? "delivery-failed") };
      }
    },
    status() {
      return {
        transport: transport?.name ?? null,
        state: transport ? "READY" : "DW_PROVISION_REQUIRED",
        buffered: buffer.length,
        deliveredTotal,
        droppedNoTransport,
        failedDeliveries,
      };
    },
  };
}
