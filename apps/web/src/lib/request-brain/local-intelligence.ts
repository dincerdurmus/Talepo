import {
  buildPriceStrategyContext,
  resolvePriceStrategy,
} from "@/lib/price-intelligence/strategy-resolver";
import { computeStrategyCompleteness } from "@/lib/price-intelligence/strategy-completeness";

import type { RequestDraft } from "./types";

/** Instant client-side strategy + completeness without API */
export function buildLocalRequestIntelligence(draft: RequestDraft) {
  const fieldValuesArray = Object.entries(draft.fieldValues)
    .filter(([, v]) => v?.trim())
    .map(([key, value]) => ({ key, value: value.trim() }));

  if (draft.city.trim()) {
    fieldValuesArray.push({ key: "city", value: draft.city.trim() });
  }
  if (draft.budget.trim()) {
    fieldValuesArray.push({ key: "budget", value: draft.budget.trim() });
  }

  const ctx = buildPriceStrategyContext({
    categorySlug: draft.categorySlug,
    title: draft.title,
    condition: draft.fieldValues.condition ?? null,
    fieldValues: fieldValuesArray,
  });

  const strategy = resolvePriceStrategy(ctx);
  const completeness = computeStrategyCompleteness({
    strategy: strategy.strategy,
    attributes: ctx.attributes,
    brand: ctx.brand,
    model: ctx.model,
    semanticFields: ctx.semanticFields,
  });

  return { strategy, completeness, context: ctx };
}

export function confidenceLevelLabelTr(
  level: string | null | undefined,
): string {
  switch (level) {
    case "NONE":
      return "Veri yok";
    case "VERY_LOW":
      return "Çok düşük";
    case "LOW":
      return "Düşük";
    case "MEDIUM":
      return "Orta";
    case "HIGH":
      return "Yüksek";
    case "VERY_HIGH":
      return "Çok yüksek";
    default:
      return "Belirsiz";
  }
}

export function formatTryAmount(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value);
}

export function budgetEvaluationMessageTr(
  status: string | null | undefined,
): string | null {
  switch (status) {
    case "WITHIN_MARKET":
      return "Bütçeniz mevcut piyasa aralığında.";
    case "BELOW_MARKET":
      return "Bütçeniz mevcut piyasa referansının altında.";
    case "ABOVE_MARKET":
      return "Bütçeniz mevcut piyasa referansının üzerinde.";
    default:
      return null;
  }
}
