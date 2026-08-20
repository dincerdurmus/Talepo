import { PRO_FEATURE_PRESENTATION } from "@/lib/membership/feature-presentation";

/**
 * Product availability for “Teklif taslağı” on request detail + offer composer.
 * Entitlement may still expose the feature key; UI stays locked until status is LIVE.
 */
export function isOfferDraftAssistantLive(): boolean {
  return PRO_FEATURE_PRESENTATION.ai_offer_assistant?.status === "LIVE";
}

export const OFFER_DRAFT_COMING_SOON_COPY =
  "Talebe göre teklif taslağı hazırlama özelliği yakında kullanıma açılacak.";
