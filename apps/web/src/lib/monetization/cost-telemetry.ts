import { INTELLIGENCE_UNIT_WEIGHTS } from "./fair-use-policy";

export type CostFeature = "OPPORTUNITY" | "PRICE" | "OFFER_COPILOT" | "FOLLOW_UP" | "PRICE_PROVIDER_QUERY" | "AI_GENERATION";
export type CostDimension = "AI" | "PROVIDER" | "PAYMENT" | "INFRA" | "SUPPORT";
export type CostEvent = { eventType: "INTELLIGENCE_ACTION" | "PROVIDER_QUERY" | "AI_GENERATION"; feature: CostFeature; costDimension: CostDimension; userId?: string; workspaceId?: string; requestId?: string; provider?: string; model?: string; units: number; intelligenceUnits: number; cacheHit: boolean; dedupHit: boolean; estimatedCost: number | null; currency: string | null; timestamp: string; metadata?: Record<string, string | number | boolean | null> };
const events: CostEvent[] = [];
export function recordCostEvent(input: Omit<CostEvent, "timestamp">): CostEvent { const event = { ...input, timestamp: new Date().toISOString() }; events.push(event); if (events.length > 1000) events.shift(); return event; }
export function getCostEvents(limit = 100) { return events.slice(-limit); }
export function clearCostEvents() { events.length = 0; }
export function costUnits(feature: CostFeature) { if (feature === "OPPORTUNITY") return INTELLIGENCE_UNIT_WEIGHTS.opportunity; if (feature === "PRICE") return INTELLIGENCE_UNIT_WEIGHTS.price; if (feature === "OFFER_COPILOT") return INTELLIGENCE_UNIT_WEIGHTS.offerCopilot; if (feature === "FOLLOW_UP") return INTELLIGENCE_UNIT_WEIGHTS.followUp; return INTELLIGENCE_UNIT_WEIGHTS.providerQuery; }

export type FairUseState = "NORMAL" | "SOFT_LIMIT" | "HARD_LIMIT" | "ABUSE_SUSPECTED";
export function evaluateFairUse(totalUnits: number, policy: { softLimit: number; hardLimit: number }, recentEvents = 0): FairUseState { if (recentEvents > policy.hardLimit * 2) return "ABUSE_SUSPECTED"; if (totalUnits >= policy.hardLimit) return "HARD_LIMIT"; if (totalUnits >= policy.softLimit) return "SOFT_LIMIT"; return "NORMAL"; }
