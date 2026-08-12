import { NextResponse } from "next/server";

import { EntitlementError } from "@/lib/membership/types";
import {
  bindCorrelationFromRequest,
  correlationResponseHeaders,
  runWithCorrelationAsync,
} from "@/lib/observability/correlation";
import { safeErrorResponse } from "@/lib/observability/errors";
import { readIdempotencyKeyFromRequest } from "@/lib/observability/idempotency";
import {
  assertRateLimit,
  clientKeyFromRequest,
  userKey,
} from "@/lib/observability/rate-limit";
import { AuthenticationError, requireUser } from "@/server/auth/require-user";
import { createRequest } from "@/server/request/create-request";
import {
  parseCreateRequestInput,
  RequestValidationError,
} from "@/server/request/request-schema";

export async function POST(request: Request) {
  const store = bindCorrelationFromRequest(request, { surface: "api.requests" });

  return runWithCorrelationAsync(store, async () => {
    try {
      assertRateLimit({
        key: clientKeyFromRequest(request, "request.publish"),
        limit: 20,
        windowMs: 60_000,
      });

      const user = await requireUser();
      store.userId = user.id;

      assertRateLimit({
        key: userKey("request.publish", user.id),
        limit: 10,
        windowMs: 60_000,
      });

      const body = await request.json();
      const input = parseCreateRequestInput(body);
      const headerKey = readIdempotencyKeyFromRequest(request);
      const createdRequest = await createRequest(user.id, {
        ...input,
        idempotencyKey: headerKey ?? input.idempotencyKey,
      });

      const res = NextResponse.json(
        {
          ok: true,
          request: createdRequest,
          redirectTo: `/panel/taleplerim/${createdRequest.id}`,
        },
        { status: 201 },
      );
      for (const [k, v] of Object.entries(correlationResponseHeaders(store))) {
        res.headers.set(k, v);
      }
      return res;
    } catch (error) {
      if (
        error instanceof AuthenticationError ||
        error instanceof EntitlementError ||
        error instanceof RequestValidationError
      ) {
        const res = safeErrorResponse(error, {
          service: "request",
          event: "request.publish.failed",
          correlationId: store.correlationId,
        });
        for (const [k, v] of Object.entries(correlationResponseHeaders(store))) {
          res.headers.set(k, v);
        }
        return res;
      }

      const res = safeErrorResponse(error, {
        service: "request",
        event: "request.publish.failed",
        correlationId: store.correlationId,
      });
      for (const [k, v] of Object.entries(correlationResponseHeaders(store))) {
        res.headers.set(k, v);
      }
      return res;
    }
  });
}
