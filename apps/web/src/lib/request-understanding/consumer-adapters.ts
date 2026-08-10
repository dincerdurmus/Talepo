import type { PriceStrategyKey } from "@/lib/price-intelligence/price-strategy-registry";
import type { PriceStrategyResolution } from "@/lib/price-intelligence/strategy-resolver";
import type { RequestUnderstandingResult } from "./types";
import { strategyResolutionFromUnderstanding } from "./activation-bridge";

/**
 * Thin packaging for consumers — not a second understanding model.
 */
export type CanonicalRequestContext = {
  understanding: RequestUnderstandingResult;
  structuredOverrides?: {
    categoryId?: string | null;
    city?: string | null;
    district?: string | null;
    fieldValues?: Record<string, string | null | undefined>;
  };
  requestId?: string;
};

export type MatchingEstimateInput = {
  /** When null, matching must not invent a category */
  categorySlug: string | null;
  city: string | null;
  strategy: PriceStrategyKey | null;
  intent: string | null;
  status: "READY" | "INSUFFICIENT_UNDERSTANDING";
  reasons: string[];
  diagnostics?: {
    categoryStatus: string;
    categorySource: "CANONICAL" | "STRUCTURED_OVERRIDE" | "NONE";
  };
};

/**
 * Pure adapter — no reinterpretation.
 * UNKNOWN / low-confidence TENTATIVE → INSUFFICIENT (never silent services).
 */
export function toMatchingEstimateInput(
  understanding: RequestUnderstandingResult,
  opts?: { cityOverride?: string | null; categoryLocked?: boolean },
): MatchingEstimateInput {
  const city =
    opts?.cityOverride?.trim() ||
    understanding.location?.city?.value ||
    null;

  const cat = understanding.category;
  const locked = Boolean(opts?.categoryLocked && cat.value);

  if (locked && cat.value) {
    return {
      categorySlug: cat.value,
      city,
      strategy: understanding.strategy.value,
      intent: understanding.intent.value,
      status: "READY",
      reasons: ["structured category override"],
      diagnostics: {
        categoryStatus: cat.status,
        categorySource: "STRUCTURED_OVERRIDE",
      },
    };
  }

  if (cat.status === "CONFIDENT" && cat.value) {
    return {
      categorySlug: cat.value,
      city,
      strategy: understanding.strategy.value,
      intent: understanding.intent.value,
      status: "READY",
      reasons: [],
      diagnostics: {
        categoryStatus: cat.status,
        categorySource: "CANONICAL",
      },
    };
  }

  // TENTATIVE with value: allow limited matching on provisional schema category
  // but never upgrade status to CONFIDENT downstream
  if (cat.status === "TENTATIVE" && cat.value && cat.value !== "services") {
    return {
      categorySlug: cat.value,
      city,
      strategy: understanding.strategy.value,
      intent: understanding.intent.value,
      status: "READY",
      reasons: ["tentative category — limited matching"],
      diagnostics: {
        categoryStatus: cat.status,
        categorySource: "CANONICAL",
      },
    };
  }

  return {
    categorySlug: null,
    city,
    strategy: understanding.strategy.value,
    intent: understanding.intent.value,
    status: "INSUFFICIENT_UNDERSTANDING",
    reasons: [
      cat.status === "UNKNOWN"
        ? "canonical category UNKNOWN"
        : "canonical category not confident enough for matching",
    ],
    diagnostics: {
      categoryStatus: cat.status,
      categorySource: "NONE",
    },
  };
}

export type PriceCanonicalHints = {
  strategy: PriceStrategyResolution;
  categorySlug: string | null;
  categoryStatus: string;
};

/** Pure — maps understanding → price engine canonical strategy hint */
export function toPriceCanonicalHints(
  understanding: RequestUnderstandingResult,
): PriceCanonicalHints {
  return {
    strategy: strategyResolutionFromUnderstanding(understanding),
    categorySlug: understanding.category.value,
    categoryStatus: understanding.category.status,
  };
}
