import { NextResponse } from "next/server";

import {
  bindCorrelationFromRequest,
  correlationResponseHeaders,
  runWithCorrelationAsync,
  type CorrelationStore,
} from "./correlation";
import { safeErrorResponse } from "./errors";
import { createSubsystemLogger } from "./logger";

type Handler = (request: Request, store: CorrelationStore) => Promise<Response>;

/**
 * Lightweight API wrapper: correlation + safe errors + duration log.
 * Does not rewrite the entire App Router surface.
 */
export function withApiObservability(
  service: string,
  eventBase: string,
  handler: Handler,
): (request: Request) => Promise<Response> {
  const log = createSubsystemLogger(service);

  return async (request: Request) => {
    const store = bindCorrelationFromRequest(request, { surface: service });
    const started = Date.now();

    return runWithCorrelationAsync(store, async () => {
      log.info(`${eventBase}.started`, { outcome: "success" });
      try {
        const response = await handler(request, store);
        const headers = new Headers(response.headers);
        for (const [k, v] of Object.entries(correlationResponseHeaders(store))) {
          headers.set(k, v);
        }
        log.info(`${eventBase}.completed`, {
          outcome: response.ok ? "success" : "failure",
          durationMs: Date.now() - started,
          context: { status: response.status },
        });
        return new NextResponse(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      } catch (error) {
        const res = safeErrorResponse(error, {
          service,
          event: `${eventBase}.failed`,
          correlationId: store.correlationId,
        });
        for (const [k, v] of Object.entries(correlationResponseHeaders(store))) {
          res.headers.set(k, v);
        }
        return res;
      }
    });
  };
}
