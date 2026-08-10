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

  // Knowledge confidence is already 0–100 over category-available signals.
  const score = knowledge.confidence;

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
