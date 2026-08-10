import { buildSemanticFieldMap } from "@/lib/product-identity/semantic-fields";
import type { SemanticFieldClass } from "@/lib/product-identity/types";

import { COMPLETENESS_WEIGHTS } from "./confidence-config";
import {
  getStrategyAttributeProfile,
  type PriceStrategyKey,
} from "./price-strategy-registry";

export type CompletenessBreakdown = {
  score: number;
  missingRequiredFields: string[];
  missingImportantFields: string[];
  presentRequiredFields: string[];
  presentImportantFields: string[];
  nextBestFields: string[];
};

function fieldSatisfied(
  fieldKey: string,
  attributes: Record<string, string>,
  semanticFields: Record<string, SemanticFieldClass>,
  brand?: string | null,
  model?: string | null,
): boolean {
  if (fieldKey.includes("-like")) {
    const cls = fieldKey as SemanticFieldClass;
    if (cls === "brand-like" && (brand?.trim() || attributes.brand?.trim() || attributes.brandPreference?.trim())) {
      return true;
    }
    if (cls === "model-like" && (model?.trim() || attributes.model?.trim() || attributes.productName?.trim())) {
      return true;
    }
    return Object.values(semanticFields).includes(cls) &&
      Object.entries(semanticFields).some(
        ([key, sf]) => sf === cls && Boolean(attributes[key]?.trim()),
      );
  }

  if (fieldKey === "brand" && (brand?.trim() || attributes.brand?.trim() || attributes.brandPreference?.trim())) {
    return true;
  }
  if (fieldKey === "model" && (model?.trim() || attributes.model?.trim())) {
    return true;
  }

  return Boolean(attributes[fieldKey]?.trim());
}

function evaluateFieldGroup(
  fields: string[],
  attributes: Record<string, string>,
  semanticFields: Record<string, SemanticFieldClass>,
  brand?: string | null,
  model?: string | null,
): { present: string[]; missing: string[] } {
  const present: string[] = [];
  const missing: string[] = [];
  for (const field of fields) {
    if (fieldSatisfied(field, attributes, semanticFields, brand, model)) {
      present.push(field);
    } else {
      missing.push(field);
    }
  }
  return { present, missing };
}

/**
 * Strategy completeness score for first-release request UX (0..1).
 * Uses StrategyAttributeProfile — not raw field count.
 */
export function computeStrategyCompleteness(input: {
  strategy: PriceStrategyKey;
  attributes: Record<string, string>;
  brand?: string | null;
  model?: string | null;
  semanticFields?: Record<string, SemanticFieldClass>;
}): CompletenessBreakdown {
  const profile = getStrategyAttributeProfile(input.strategy);
  const semanticFields =
    input.semanticFields ?? buildSemanticFieldMap(input.attributes);

  const required = evaluateFieldGroup(
    profile.required,
    input.attributes,
    semanticFields,
    input.brand,
    input.model,
  );
  const important = evaluateFieldGroup(
    profile.important,
    input.attributes,
    semanticFields,
    input.brand,
    input.model,
  );

  const reqTotal = profile.required.length || 1;
  const impTotal = profile.important.length || 1;

  const requiredScore = required.present.length / reqTotal;
  const importantScore = important.present.length / impTotal;

  const score = Math.round(
    Math.min(
      1,
      requiredScore * COMPLETENESS_WEIGHTS.required +
        importantScore * COMPLETENESS_WEIGHTS.important +
        (required.missing.length === 0 && important.present.length > 0 ? COMPLETENESS_WEIGHTS.optional : 0),
    ) * 1000,
  ) / 1000;

  const nextBestFields = [
    ...required.missing,
    ...important.missing.filter((f) => !required.missing.includes(f)),
  ].slice(0, 3);

  return {
    score,
    missingRequiredFields: required.missing,
    missingImportantFields: important.missing,
    presentRequiredFields: required.present,
    presentImportantFields: important.present,
    nextBestFields,
  };
}
