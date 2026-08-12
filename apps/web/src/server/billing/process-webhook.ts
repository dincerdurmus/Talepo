import { BillingError, BillingErrorCode } from "@/lib/billing/errors";
import { createSubsystemLogger } from "@/lib/observability/logger";

import { applyCanonicalBillingEvent } from "./apply-billing-event";
import { getBillingProvider } from "./get-provider";

const log = createSubsystemLogger("billing");

export async function processBillingWebhook(input: {
  headers: Headers;
  rawBody: string;
}) {
  const started = Date.now();
  const provider = getBillingProvider();

  const verified = await provider.verifyWebhook({
    headers: input.headers,
    rawBody: input.rawBody,
  });

  if (!verified.ok) {
    log.warn("billing.webhook.invalid", {
      outcome: "denied",
      errorCode: BillingErrorCode.INVALID_WEBHOOK,
      context: { reason: verified.reason, provider: provider.id },
    });
    throw new BillingError({
      code: BillingErrorCode.INVALID_WEBHOOK,
      userMessage: "Webhook doğrulanamadı.",
      diagnostic: verified.reason,
    });
  }

  const events = await provider.parseWebhookEvent({
    rawBody: input.rawBody,
    headers: input.headers,
  });

  const results = [];
  for (const event of events) {
    const result = await applyCanonicalBillingEvent(event);
    results.push({
      providerEventId: event.providerEventId,
      eventType: event.eventType,
      outcome: result.outcome,
    });
  }

  log.info("billing.webhook.processed", {
    outcome: "success",
    durationMs: Date.now() - started,
    context: {
      provider: provider.id,
      eventCount: events.length,
      results,
    },
  });

  return { ok: true as const, results };
}
