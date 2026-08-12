/**
 * Canonical business metric definitions — single vocabulary for future SQL/analytics.
 */

export type MetricDefinition = {
  id: string;
  name: string;
  description: string;
  grain: string;
  /** Conceptual SQL/filter — not executed here. */
  definition: string;
  notes?: string;
};

export const BUSINESS_METRICS: MetricDefinition[] = [
  {
    id: "published_request",
    name: "Published Request",
    description: "A request that reached PUBLISHED (or later marketplace statuses) with publishedAt set.",
    grain: "request",
    definition:
      "Request.deletedAt IS NULL AND Request.publishedAt IS NOT NULL AND Request.status IN ('PUBLISHED','RECEIVING_OFFERS','OFFER_SELECTED','COMPLETED',...marketplace)",
  },
  {
    id: "valid_offer",
    name: "Valid Offer",
    description: "An offer that was successfully submitted and is countable toward conversion.",
    grain: "offer",
    definition:
      "Offer.status IN ('SUBMITTED','VIEWED','ACCEPTED','REJECTED','WITHDRAWN') — excludes draft/invalid; typically created via createOffer after entitlement checks.",
  },
  {
    id: "accepted_offer",
    name: "Accepted Offer",
    description: "Offer with status ACCEPTED and acceptedAt set. At most one active accepted offer per request in happy path.",
    grain: "offer",
    definition: "Offer.status = 'ACCEPTED' AND Offer.acceptedAt IS NOT NULL",
  },
  {
    id: "active_conversation",
    name: "Active Conversation",
    description: "Conversation tied 1:1 to an offer (offerId unique) with at least one participant pair after accept.",
    grain: "conversation",
    definition:
      "Conversation.offerId IS NOT NULL AND EXISTS Message OR lastMessageAt IS NOT NULL",
  },
  {
    id: "opportunity",
    name: "Opportunity",
    description: "Company-scoped OpportunityMatch row for a request.",
    grain: "opportunity_match",
    definition: "OpportunityMatch.id IS NOT NULL (companyId + requestId)",
  },
  {
    id: "assigned_opportunity",
    name: "Assigned Opportunity",
    description: "OpportunityMatch with assignedToMemberId set.",
    grain: "opportunity_match",
    definition: "OpportunityMatch.assignedToMemberId IS NOT NULL",
  },
  {
    id: "offer_conversion",
    name: "Offer Conversion",
    description: "Accepted offers / valid offers in a period (seller or platform scope).",
    grain: "ratio",
    definition: "count(accepted_offer) / nullif(count(valid_offer), 0)",
    notes: "Never invent fake rates in UI; compute only from persisted statuses.",
  },
];

export function getMetricDefinition(id: string): MetricDefinition | undefined {
  return BUSINESS_METRICS.find((m) => m.id === id);
}
