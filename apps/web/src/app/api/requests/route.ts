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
import { assertUserCanAct } from "@/server/auth/assert-user-can-act";
import { createRequest } from "@/server/request/create-request";
import {
  parseCreateRequestInput,
  parseJsonObject,
  RequestValidationError,
} from "@/server/request/request-schema";

function publishOperation(error: unknown): string {
  if (error instanceof AuthenticationError) return "publish.auth";
  if (error instanceof RequestValidationError) return "publish.validate";
  if (error instanceof EntitlementError) return "publish.entitlement";
  return "publish.create";
}

export async function POST(request: Request) {
  const store = bindCorrelationFromRequest(request, { surface: "api.requests" });

  return runWithCorrelationAsync(store, async () => {
    try {
      // Read the stream before auth/cookies so the body cannot be consumed twice.
      const rawBody = await request.text();

      assertRateLimit({
        key: clientKeyFromRequest(request, "request.publish"),
        limit: 20,
        windowMs: 60_000,
      });

      const user = await requireUser();
      await assertUserCanAct(user.id);
      store.userId = user.id;

      assertRateLimit({
        key: userKey("request.publish", user.id),
        limit: 10,
        windowMs: 60_000,
      });

      const body = parseJsonObject(rawBody);
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
      const res = safeErrorResponse(error, {
        service: "request",
        event: "request.publish.failed",
        correlationId: store.correlationId,
        context: {
          operation: publishOperation(error),
        },
      });
      for (const [k, v] of Object.entries(correlationResponseHeaders(store))) {
        res.headers.set(k, v);
      }
      return res;
    }
  });
}
