import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export const CORRELATION_HEADER = "x-correlation-id";
export const REQUEST_ID_HEADER = "x-request-id";

export type CorrelationStore = {
  correlationId: string;
  requestId?: string;
  userId?: string;
  companyId?: string;
  surface?: string;
};

const storage = new AsyncLocalStorage<CorrelationStore>();

export function generateCorrelationId(): string {
  return randomUUID();
}

export function getCorrelationStore(): CorrelationStore | undefined {
  return storage.getStore();
}

export function getCorrelationId(): string | undefined {
  return storage.getStore()?.correlationId;
}

export function runWithCorrelation<T>(
  store: CorrelationStore,
  fn: () => T,
): T {
  return storage.run(store, fn);
}

export async function runWithCorrelationAsync<T>(
  store: CorrelationStore,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run(store, fn);
}

export function bindCorrelationFromRequest(
  request: Request,
  extras?: Partial<CorrelationStore>,
): CorrelationStore {
  const headerId =
    request.headers.get(CORRELATION_HEADER) ??
    request.headers.get(REQUEST_ID_HEADER);
  return {
    correlationId: headerId?.trim() || generateCorrelationId(),
    requestId: extras?.requestId,
    userId: extras?.userId,
    companyId: extras?.companyId,
    surface: extras?.surface,
  };
}

export function correlationResponseHeaders(
  store: CorrelationStore,
): Record<string, string> {
  return {
    [CORRELATION_HEADER]: store.correlationId,
    [REQUEST_ID_HEADER]: store.requestId ?? store.correlationId,
  };
}
