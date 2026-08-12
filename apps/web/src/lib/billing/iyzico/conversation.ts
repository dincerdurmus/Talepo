import { randomBytes } from "node:crypto";

import type { PlanTierId } from "@/lib/membership/plans";
import type { BillingSubjectRef } from "@/lib/billing/types";

/**
 * Opaque conversationId for iyzico correlation.
 * Format: tlp1.<kind>.<subjectType>.<subjectId>.<sku>.<nonce>
 * Never trusts client-supplied amounts.
 */
export type IyzicoConversation =
  | {
      kind: "sub";
      subject: BillingSubjectRef;
      planTier: PlanTierId;
      nonce: string;
    }
  | {
      kind: "crd";
      subject: BillingSubjectRef;
      packId: string;
      nonce: string;
    };

export function buildSubscriptionConversationId(input: {
  subject: BillingSubjectRef;
  planTier: PlanTierId;
}): string {
  const nonce = randomBytes(4).toString("hex");
  return [
    "tlp1",
    "sub",
    input.subject.type === "COMPANY" ? "C" : "U",
    input.subject.id,
    input.planTier,
    nonce,
  ].join(".");
}

export function buildCreditConversationId(input: {
  subject: BillingSubjectRef;
  packId: string;
}): string {
  const nonce = randomBytes(4).toString("hex");
  return [
    "tlp1",
    "crd",
    input.subject.type === "COMPANY" ? "C" : "U",
    input.subject.id,
    input.packId,
    nonce,
  ].join(".");
}

export function parseIyzicoConversationId(
  conversationId: string | null | undefined,
): IyzicoConversation | null {
  if (!conversationId || !conversationId.startsWith("tlp1.")) return null;
  const parts = conversationId.split(".");
  if (parts.length < 6) return null;
  const [, kind, subjectCode, subjectId, sku, nonce] = parts;
  if (!subjectId || !sku || !nonce) return null;
  const subject: BillingSubjectRef = {
    type: subjectCode === "C" ? "COMPANY" : "USER",
    id: subjectId,
  };
  if (kind === "sub") {
    if (
      sku !== "PREMIUM" &&
      sku !== "PROFESSIONAL" &&
      sku !== "CORPORATE"
    ) {
      return null;
    }
    return { kind: "sub", subject, planTier: sku, nonce };
  }
  if (kind === "crd") {
    return { kind: "crd", subject, packId: sku, nonce };
  }
  return null;
}
