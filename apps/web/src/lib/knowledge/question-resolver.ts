/**
 * Dynamic question resolver — WHAT TO ASK NEXT.
 * Does not invent intent; reads schema + current explicit/known values.
 */

import { isExplicitBrowseField } from "./browse";
import {
  getConditionalFields,
  getMissingRequiredFields,
  getNextMissingFields,
  getOptionalFields,
  getRequiredFields,
  resolveRequestSchema,
  type ResolveRequestSchemaInput,
} from "./request-schema";
import type { KnowledgeField } from "./types";

export type QuestionResolverState = ResolveRequestSchemaInput & {
  /** Keys filled by free-text EXPLICIT extraction (Single Brain). */
  explicitKeys?: string[];
};

export type QuestionResolverResult = {
  known: string[];
  missingRequired: KnowledgeField[];
  optionalUseful: KnowledgeField[];
  conditionalActive: KnowledgeField[];
  next: KnowledgeField[];
};

function isKnown(
  values: Record<string, string | undefined>,
  key: string,
  explicitKeys: Set<string>,
): boolean {
  if (explicitKeys.has(key)) return true;
  if (isExplicitBrowseField(values, key)) return true;
  const v = values[key];
  return v != null && String(v).trim().length > 0;
}

export function resolveNextQuestions(
  state: QuestionResolverState,
): QuestionResolverResult {
  const values = state.values ?? {};
  const explicitKeys = new Set(state.explicitKeys ?? []);
  const schema = resolveRequestSchema(state);

  const known = schema.fields
    .filter((f) => isKnown(values, f.key, explicitKeys))
    .map((f) => f.key);

  // Treat explicit (text or browse) as filled so they are not re-asked
  const valuesWithExplicit: Record<string, string | undefined> = { ...values };
  for (const key of known) {
    if (!valuesWithExplicit[key]?.trim()) {
      valuesWithExplicit[key] = values[key] ?? "__KNOWN__";
    }
  }

  const input: ResolveRequestSchemaInput = {
    ...state,
    values: valuesWithExplicit,
  };

  return {
    known,
    missingRequired: getMissingRequiredFields(input),
    optionalUseful: getOptionalFields(input).filter(
      (f) => !isKnown(values, f.key, explicitKeys),
    ),
    conditionalActive: getConditionalFields(input),
    next: getNextMissingFields(input, 3),
  };
}

export {
  resolveRequestSchema,
  getRequiredFields,
  getOptionalFields,
  getMissingRequiredFields,
  getNextMissingFields,
  getConditionalFields,
};
