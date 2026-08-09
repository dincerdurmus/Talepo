import { getCategoryById } from "@/lib/request-category-engine";

import type { AiCoreResult } from "./types";
import { parseRequest } from "./parser/parser";
import { composeProfessionalDescription } from "./request-text-composer";
import { runKnowledgeEngine } from "./knowledge";
import { estimatePrice } from "./pricing/estimate";
import { estimateCompanyMatches } from "./matching/companyMatcher";
import { createRecommendations } from "./recommendations/recommendationEngine";

export function runTalepoAiCore(text: string): AiCoreResult {
  const parsed = parseRequest(text);
  const category = getCategoryById(parsed.categoryId);
  const commonFieldKeys = new Set(category.commonFields.map((field) => field.key));
  const knowledge = runKnowledgeEngine(parsed);
  const pricing = estimatePrice(parsed);
  const matching = estimateCompanyMatches(parsed);
  const recommendations = createRecommendations(parsed);

  const professionalText = composeProfessionalDescription({
    categoryId: parsed.categoryId,
    rawText: parsed.rawText,
    attributes: parsed.attributes,
    city: parsed.city,
    budget: parsed.budget,
    deliveryDays: parsed.deliveryDays,
    quantity: parsed.quantity,
    unit: parsed.unit,
    fields: category.fields,
    fieldValues: Object.fromEntries(
      Object.entries(parsed.attributes).map(([key, value]) => [
        key,
        String(value),
      ]),
    ),
  });

  const score = Math.min(
    100,
    Math.round(
      knowledge.confidence +
        (parsed.budget ? 4 : 0) +
        (commonFieldKeys.has("quantity") && parsed.quantity ? 3 : 0)
    )
  );

  return {
    parsed,
    knowledge,
    pricing,
    matching,
    recommendations,
    professionalText,
    score,
  };
}
