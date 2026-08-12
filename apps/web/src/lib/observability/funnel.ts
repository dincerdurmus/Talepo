import { ProductEventName } from "./product-events";

/**
 * Marketplace funnel contracts — measurement definitions only.
 * No dashboards / fake conversion rates in Phase 4A.
 */

export type FunnelStep = {
  id: string;
  productEvent: (typeof ProductEventName)[keyof typeof ProductEventName] | string;
  description: string;
};

export type FunnelDefinition = {
  id: string;
  actor: "buyer" | "seller" | "professional" | "corporate";
  steps: FunnelStep[];
};

export const MARKETPLACE_FUNNELS: FunnelDefinition[] = [
  {
    id: "buyer_request_to_conversation",
    actor: "buyer",
    steps: [
      {
        id: "request_started",
        productEvent: ProductEventName.REQUEST_STARTED,
        description: "Buyer opens/composer starts a request draft.",
      },
      {
        id: "request_published",
        productEvent: ProductEventName.REQUEST_PUBLISHED,
        description: "Request persisted as PUBLISHED.",
      },
      {
        id: "offers_received",
        productEvent: "OFFERS_RECEIVED",
        description: "Derived metric: ≥1 SUBMITTED offer on the request.",
      },
      {
        id: "offer_accepted",
        productEvent: ProductEventName.OFFER_ACCEPTED,
        description: "Buyer accepts an offer.",
      },
      {
        id: "conversation_started",
        productEvent: ProductEventName.CONVERSATION_STARTED,
        description: "Conversation exists for accepted offer.",
      },
    ],
  },
  {
    id: "seller_discovery_to_accept",
    actor: "seller",
    steps: [
      {
        id: "discovery_viewed",
        productEvent: ProductEventName.DISCOVERY_VIEWED,
        description: "Seller opens discovery/explore workspace.",
      },
      {
        id: "request_viewed",
        productEvent: "REQUEST_VIEWED",
        description: "Seller opens a request detail (future product event).",
      },
      {
        id: "offer_started",
        productEvent: ProductEventName.OFFER_STARTED,
        description: "Seller begins offer form.",
      },
      {
        id: "offer_submitted",
        productEvent: ProductEventName.OFFER_SUBMITTED,
        description: "Offer created successfully.",
      },
      {
        id: "offer_accepted",
        productEvent: ProductEventName.OFFER_ACCEPTED,
        description: "Buyer accepted seller's offer.",
      },
    ],
  },
  {
    id: "professional_opportunity",
    actor: "professional",
    steps: [
      {
        id: "opportunity_viewed",
        productEvent: ProductEventName.OPPORTUNITY_VIEWED,
        description: "Professional views opportunity workspace item.",
      },
      {
        id: "saved_or_followed",
        productEvent: ProductEventName.SAVED_SEARCH_CREATED,
        description: "Saved search / category follow / alert created.",
      },
      {
        id: "offer_submitted",
        productEvent: ProductEventName.OFFER_SUBMITTED,
        description: "Offer submitted from opportunity.",
      },
    ],
  },
  {
    id: "corporate_opportunity_ops",
    actor: "corporate",
    steps: [
      {
        id: "opportunity_discovered",
        productEvent: ProductEventName.OPPORTUNITY_VIEWED,
        description: "Corporate sees OpportunityMatch / center row.",
      },
      {
        id: "assigned",
        productEvent: ProductEventName.OPPORTUNITY_ASSIGNED,
        description: "Manager assigns opportunity to member.",
      },
      {
        id: "offer_submitted",
        productEvent: ProductEventName.OFFER_SUBMITTED,
        description: "Assigned member submits offer.",
      },
      {
        id: "accepted",
        productEvent: ProductEventName.OFFER_ACCEPTED,
        description: "Offer accepted by buyer.",
      },
    ],
  },
];

export function getFunnelById(id: string): FunnelDefinition | undefined {
  return MARKETPLACE_FUNNELS.find((f) => f.id === id);
}
