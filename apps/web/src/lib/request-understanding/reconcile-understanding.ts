import type {
  RequestIntent,
  SubjectKind,
  UnderstandingDecision,
} from "@/lib/request-understanding/types";
import type { PriceStrategyKey } from "@/lib/price-intelligence/price-strategy-registry";

/**
 * Light reconciliation between intent / category / strategy / subject.
 * Full ambiguity engine is out of scope (B4).
 */
export function reconcileUnderstanding(input: {
  intent: UnderstandingDecision<RequestIntent>;
  category: UnderstandingDecision<string>;
  strategy: UnderstandingDecision<PriceStrategyKey>;
  subject: UnderstandingDecision<SubjectKind>;
}): {
  intent: UnderstandingDecision<RequestIntent>;
  category: UnderstandingDecision<string>;
  strategy: UnderstandingDecision<PriceStrategyKey>;
  subject: UnderstandingDecision<SubjectKind>;
} {
  const { intent, strategy } = input;
  let { category, subject } = input;

  // Strong intent beats weak category for downstream interpretation markers
  if (
    intent.value === "SERVICE" &&
    category.value &&
    category.status !== "CONFIDENT" &&
    category.value === "services"
  ) {
    category = {
      ...category,
      status: "TENTATIVE",
      evidence: [...(category.evidence ?? []), "reconcile:service-intent"],
    };
  }

  if (
    intent.value &&
    intent.value !== "UNKNOWN" &&
    intent.status !== "UNKNOWN" &&
    strategy.value === "UNKNOWN" &&
    intent.confidence >= 0.7
  ) {
    // Keep UNKNOWN strategy — do not invent; readiness will reflect this
  }

  // Subject consistency with intent
  if (intent.value === "PART" && subject.value !== "PART") {
    subject = {
      value: "PART",
      confidence: intent.confidence,
      status: intent.status,
      evidence: [...(subject.evidence ?? []), "reconcile:intent-part"],
    };
  }
  if (intent.value === "SERVICE" && subject.value !== "SERVICE") {
    subject = {
      value: "SERVICE",
      confidence: intent.confidence,
      status: intent.status,
      evidence: [...(subject.evidence ?? []), "reconcile:intent-service"],
    };
  }

  // Never present services as CONFIDENT when strategy is not service-aligned
  // and intent is purchase-like
  if (
    category.value === "services" &&
    category.status === "CONFIDENT" &&
    (intent.value === "BUY" || intent.value === "SELL") &&
    strategy.value !== "SERVICE_SCOPE"
  ) {
    category = {
      ...category,
      status: "TENTATIVE",
      confidence: Math.min(category.confidence, 0.5),
      evidence: [
        ...(category.evidence ?? []),
        "reconcile:demote-services-vs-purchase",
      ],
    };
  }

  return { intent, category, strategy, subject };
}
