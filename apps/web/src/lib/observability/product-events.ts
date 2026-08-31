/**
 * Vendor-neutral product telemetry foundation.
 * Separate from operational logging — funnel/product analytics only.
 * No PII / free-text content in metadata.
 */

import { getCorrelationStore } from "./correlation";
import { sanitizeTelemetryMetadata } from "./redaction";

export const ProductEventName = {
  REQUEST_STARTED: "REQUEST_STARTED",
  REQUEST_PUBLISHED: "REQUEST_PUBLISHED",
  DISCOVERY_VIEWED: "DISCOVERY_VIEWED",
  DISCOVERY_FILTER_APPLIED: "DISCOVERY_FILTER_APPLIED",
  SAVED_SEARCH_CREATED: "SAVED_SEARCH_CREATED",
  ALERT_CREATED: "ALERT_CREATED",
  CATEGORY_FOLLOWED: "CATEGORY_FOLLOWED",
  OPPORTUNITY_VIEWED: "OPPORTUNITY_VIEWED",
  OPPORTUNITY_ASSIGNED: "OPPORTUNITY_ASSIGNED",
  OFFER_STARTED: "OFFER_STARTED",
  OFFER_SUBMITTED: "OFFER_SUBMITTED",
  OFFER_ACCEPTED: "OFFER_ACCEPTED",
  /**
   * DW-2 (2026-08-31): kabul edilen teklif ile TAMAMLANAN satış ayrı
   * olaylardır (ölçüm sözlüğü). Üretici: deal-outcome çift onay geçişi
   * (`justCompleted`) — DealOutcome COMPLETED'a tam bir kez döndüğünde.
   */
  DEAL_COMPLETED: "DEAL_COMPLETED",
  CONVERSATION_STARTED: "CONVERSATION_STARTED",
  INVENTORY_ITEM_CREATED: "INVENTORY_ITEM_CREATED",
  INVENTORY_IMPORT_COMPLETED: "INVENTORY_IMPORT_COMPLETED",
  UPSELL_VIEWED: "UPSELL_VIEWED",
  CHECKOUT_STARTED: "CHECKOUT_STARTED",
  CHECKOUT_COMPLETED: "CHECKOUT_COMPLETED",
  SUBSCRIPTION_ACTIVATED: "SUBSCRIPTION_ACTIVATED",
  SUBSCRIPTION_CANCELED: "SUBSCRIPTION_CANCELED",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  CREDIT_PURCHASED: "CREDIT_PURCHASED",
} as const;

export type ProductEventName =
  (typeof ProductEventName)[keyof typeof ProductEventName];

export type ActorType = "buyer" | "seller" | "professional" | "corporate" | "system" | "anonymous";

export type ProductEvent = {
  eventName: ProductEventName;
  occurredAt: string;
  actorType: ActorType;
  plan?: string;
  surface: string;
  requestId?: string;
  companyId?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
};

export type ProductEventSink = (event: ProductEvent) => void;

const sinks: ProductEventSink[] = [];
const recent: ProductEvent[] = [];
const MAX_RECENT = 200;

export function addProductEventSink(sink: ProductEventSink): () => void {
  sinks.push(sink);
  return () => {
    const idx = sinks.indexOf(sink);
    if (idx >= 0) sinks.splice(idx, 1);
  };
}

/**
 * DW-1 (2026-08-31): logger ile AYNI teslim yalıtımı — fırlatan sink ürün
 * akışını kıramaz, düşen teslim sayaçla görünür. verify-log-sink-chain-v1.
 */
let productSinkDeliveryFailures = 0;

export function getProductSinkDeliveryFailures(): number {
  return productSinkDeliveryFailures;
}

export function clearRecentProductEvents(): void {
  recent.length = 0;
}

export function getRecentProductEvents(limit = 50): ProductEvent[] {
  return recent.slice(-limit);
}

export function trackProductEvent(input: {
  eventName: ProductEventName;
  actorType: ActorType;
  surface: string;
  plan?: string;
  requestId?: string;
  companyId?: string;
  metadata?: Record<string, unknown>;
}): ProductEvent {
  const store = getCorrelationStore();
  const event: ProductEvent = {
    eventName: input.eventName,
    occurredAt: new Date().toISOString(),
    actorType: input.actorType,
    plan: input.plan,
    surface: input.surface,
    requestId: input.requestId ?? store?.requestId,
    companyId: input.companyId ?? store?.companyId,
    correlationId: store?.correlationId,
    metadata: sanitizeTelemetryMetadata(input.metadata),
  };

  recent.push(event);
  if (recent.length > MAX_RECENT) {
    recent.splice(0, recent.length - MAX_RECENT);
  }

  for (const sink of [...sinks]) {
    try {
      sink(event);
    } catch {
      productSinkDeliveryFailures += 1;
    }
  }

  // Optional debug visibility in non-production without flooding ops JSON.
  if (process.env.NODE_ENV !== "production" && process.env.TALEPO_PRODUCT_EVENTS_STDOUT === "1") {
    console.log(JSON.stringify({ kind: "product_event", ...event }));
  }

  return event;
}

export function isKnownProductEvent(name: string): name is ProductEventName {
  return Object.prototype.hasOwnProperty.call(ProductEventName, name);
}
