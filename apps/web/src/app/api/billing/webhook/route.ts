import { NextResponse } from "next/server";

import { BillingError } from "@/lib/billing/errors";
import { safeErrorResponse } from "@/lib/observability/errors";
import { processBillingWebhook } from "@/server/billing/process-webhook";

/**
 * Provider webhook — signature + idempotency.
 * Do NOT apply aggressive IP rate limits that break provider retries.
 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const result = await processBillingWebhook({
      headers: request.headers,
      rawBody,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof BillingError) {
      return safeErrorResponse(error, {
        service: "billing",
        event: "billing.webhook.failed",
      });
    }
    return safeErrorResponse(error, {
      service: "billing",
      event: "billing.webhook.failed",
    });
  }
}
