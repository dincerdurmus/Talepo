import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * X-IYZ-SIGNATURE-V3 verification — official docs only.
 * https://docs.iyzico.com/en/advanced/webhook.md
 *
 * Legacy X-Iyz-Signature / V2 are not accepted.
 */
export function getIyzicoSignatureV3Header(headers: Headers): string | null {
  return (
    headers.get("x-iyz-signature-v3") ||
    headers.get("X-IYZ-SIGNATURE-V3") ||
    headers.get("X-Iyz-Signature-V3")
  );
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a.toLowerCase(), "utf8");
    const bb = Buffer.from(b.toLowerCase(), "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function hmacHex(secretKey: string, message: string): string {
  return createHmac("sha256", secretKey).update(message).digest("hex");
}

export function verifyIyzicoWebhookSignatureV3(input: {
  secretKey: string;
  merchantId: string;
  signatureHeader: string | null | undefined;
  payload: Record<string, unknown>;
}): { ok: true; format: "direct" | "hpp" | "subscription" } | { ok: false; reason: string } {
  const signature = input.signatureHeader?.trim();
  if (!signature) {
    return { ok: false, reason: "missing_signature_v3" };
  }

  const eventType = String(
    input.payload.iyziEventType ?? input.payload.eventType ?? "",
  );

  // Subscription format (no merchantId in body — use configured merchantId)
  if (
    typeof input.payload.subscriptionReferenceCode === "string" ||
    eventType.startsWith("subscription.")
  ) {
    if (!input.merchantId) {
      return { ok: false, reason: "missing_merchant_id_for_subscription_sig" };
    }
    const message =
      input.merchantId +
      input.secretKey +
      eventType +
      String(input.payload.subscriptionReferenceCode ?? "") +
      String(input.payload.orderReferenceCode ?? "") +
      String(input.payload.customerReferenceCode ?? "");
    const expected = hmacHex(input.secretKey, message);
    return safeEqualHex(expected, signature)
      ? { ok: true, format: "subscription" }
      : { ok: false, reason: "subscription_signature_mismatch" };
  }

  // HPP / Checkout Form format (has token)
  if (typeof input.payload.token === "string") {
    const message =
      input.secretKey +
      eventType +
      String(input.payload.iyziPaymentId ?? "") +
      String(input.payload.token ?? "") +
      String(input.payload.paymentConversationId ?? "") +
      String(input.payload.status ?? "");
    const expected = hmacHex(input.secretKey, message);
    return safeEqualHex(expected, signature)
      ? { ok: true, format: "hpp" }
      : { ok: false, reason: "hpp_signature_mismatch" };
  }

  // Direct format
  if (
    input.payload.paymentId != null ||
    input.payload.paymentConversationId != null
  ) {
    const message =
      input.secretKey +
      eventType +
      String(input.payload.paymentId ?? "") +
      String(input.payload.paymentConversationId ?? "") +
      String(input.payload.status ?? "");
    const expected = hmacHex(input.secretKey, message);
    return safeEqualHex(expected, signature)
      ? { ok: true, format: "direct" }
      : { ok: false, reason: "direct_signature_mismatch" };
  }

  return { ok: false, reason: "unknown_webhook_payload_shape" };
}

/** Test helper — generate V3 signature for unit tests (never used in production paths). */
export function generateIyzicoWebhookTestSignature(input: {
  secretKey: string;
  merchantId?: string;
  payload: Record<string, unknown>;
}): string {
  const eventType = String(
    input.payload.iyziEventType ?? input.payload.eventType ?? "",
  );
  if (
    typeof input.payload.subscriptionReferenceCode === "string" ||
    eventType.startsWith("subscription.")
  ) {
    const message =
      (input.merchantId ?? "") +
      input.secretKey +
      eventType +
      String(input.payload.subscriptionReferenceCode ?? "") +
      String(input.payload.orderReferenceCode ?? "") +
      String(input.payload.customerReferenceCode ?? "");
    return hmacHex(input.secretKey, message);
  }
  if (typeof input.payload.token === "string") {
    const message =
      input.secretKey +
      eventType +
      String(input.payload.iyziPaymentId ?? "") +
      String(input.payload.token ?? "") +
      String(input.payload.paymentConversationId ?? "") +
      String(input.payload.status ?? "");
    return hmacHex(input.secretKey, message);
  }
  const message =
    input.secretKey +
    eventType +
    String(input.payload.paymentId ?? "") +
    String(input.payload.paymentConversationId ?? "") +
    String(input.payload.status ?? "");
  return hmacHex(input.secretKey, message);
}
