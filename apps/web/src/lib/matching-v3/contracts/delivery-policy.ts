/**
 * Paid/Pro delivery policy — CONTRACT ONLY for Dilim 1.
 * Must not drive live notification behavior yet.
 */

import type { MatchTier } from "../types";

export type DeliveryChannel = "in_app" | "email" | "push" | "digest";

export type DeliveryUrgency = "instant" | "preference" | "digest" | "ops_review" | "none";

export type DeliveryPolicyRule = {
  tier: MatchTier;
  pro: DeliveryUrgency;
  standard: DeliveryUrgency;
  notes: string;
};

export const DELIVERY_POLICY_VERSION = "delivery-policy/v0-contract" as const;

/**
 * Proposed mapping (not live):
 * EXACT → Pro instant
 * STRONG → Pro instant or preference
 * NEAR → preference/digest
 * REVIEW → ops or user confirmation
 * NO_MATCH → must not silently disappear (ops/review path)
 */
export const DELIVERY_POLICY_CONTRACT: DeliveryPolicyRule[] = [
  {
    tier: "EXACT",
    pro: "instant",
    standard: "preference",
    notes: "Pro anlık; Standard plan gecikmesi mevcut visibleToSuppliersAt ile uyumlu kalabilir",
  },
  {
    tier: "STRONG",
    pro: "instant",
    standard: "preference",
    notes: "Pro anlık veya tercihe bağlı",
  },
  {
    tier: "NEAR",
    pro: "preference",
    standard: "digest",
    notes: "Digest/tercih — gürültü kontrolü",
  },
  {
    tier: "REVIEW",
    pro: "ops_review",
    standard: "ops_review",
    notes: "Operasyon veya kullanıcı teyidi; sessiz kayıp yok",
  },
  {
    tier: "NO_MATCH",
    pro: "ops_review",
    standard: "ops_review",
    notes: "Sessizce kaybolmaz — review/replay kuyruğu",
  },
];

export type NotificationDeliveryRecordContract = {
  requestId: string;
  companyId: string;
  userId: string;
  matchTier: MatchTier;
  matchReasons: string[];
  planDeliveryPolicyVersion: string;
  channel: DeliveryChannel;
  dedupeKey: string;
  status: "queued" | "sent" | "delivered" | "failed" | "opened";
  retryCount: number;
  createdAt: string;
  updatedAt: string;
};

export function buildDedupeKey(input: {
  requestId: string;
  companyId: string;
  policyVersion: string;
  channel: DeliveryChannel;
}): string {
  return `${input.requestId}:${input.companyId}:${input.policyVersion}:${input.channel}`;
}

/**
 * Current fire-and-forget path notes (observation only — Dilim 1).
 * Source: distribute-request.ts + opportunity-hunter + alert-notifications.
 */
export const CURRENT_NOTIFICATION_RELIABILITY_NOTES = {
  queue: false,
  retry: false,
  worker: false,
  caps: {
    categoryTake: 200,
    cityPoolTake: 300,
    cityOnlyMax: 40,
    alertRuleScan: 500,
    inventoryScan: 400,
    companySavedSearchHunter: 300,
    corporateProfileTake: 100,
  },
  dedupeToday: {
    requestMatch: "createMany skipDuplicates",
    alertNotify: "findFirst on user+request+title+message",
    opportunityMatch: "upsert (companyId, requestId, source)",
  },
  proposedDedupe: "requestId + companyId + policyVersion + channel",
  dilim1Action: "observe_only_no_live_change",
} as const;
