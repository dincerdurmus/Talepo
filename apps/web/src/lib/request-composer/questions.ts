/**
 * Question minimization wired to hybrid state + schema priority + ANY semantics.
 */

import { resolveNextQuestions } from "@/lib/knowledge/question-resolver";
import type { KnowledgeField } from "@/lib/knowledge/types";

import { toResolverFieldBag } from "./build-state";
import type { CanonicalRequestState } from "./types";

export type HybridQuestionResult = {
  known: string[];
  missingRequired: KnowledgeField[];
  optionalUseful: KnowledgeField[];
  next: KnowledgeField[];
  /** Keys skipped because ANY / NOT_APPLICABLE / not needed for spare parts */
  suppressed: string[];
};

const AUTOMOTIVE_SPARE_SUPPRESS = new Set([
  "engine",
  "transmission",
  "fuel",
  "trim",
  "mileage",
  "bodyCondition",
  "variant",
]);

/**
 * Resolve next questions from canonical hybrid state.
 * ANY / NOT_APPLICABLE are not missing; automotive spare suppresses engine/TX.
 */
export function resolveHybridQuestions(
  state: CanonicalRequestState,
): HybridQuestionResult {
  const values = toResolverFieldBag(state);
  const categoryId =
    state.categoryId ??
    state.understanding.category.value ??
    "appliances";

  const explicitKeys = Object.entries(state.fields)
    .filter(
      ([, f]) =>
        f.kind === "ANY" ||
        f.kind === "NOT_APPLICABLE" ||
        (f.kind === "VALUE" &&
          (f.provenance === "EXPLICIT_TEXT" ||
            f.provenance === "EXPLICIT_BROWSE")),
    )
    .map(([k]) => k);

  const base = resolveNextQuestions({
    categoryId,
    subcategorySlug: state.subcategorySlug,
    values,
    explicitKeys,
  });

  const isAutoSpare =
    categoryId === "automotive" &&
    (values.needType === "part" ||
      state.understanding.requestSubject.kind.value === "PART");

  const suppressed: string[] = [];
  const filterSpare = (fields: KnowledgeField[]) => {
    if (!isAutoSpare) return fields;
    return fields.filter((f) => {
      if (AUTOMOTIVE_SPARE_SUPPRESS.has(f.key)) {
        suppressed.push(f.key);
        return false;
      }
      return true;
    });
  };

  // Never re-ask ANY / NA / known VALUE fields; never force model when brand is ANY
  const brandAny = state.fields.brand?.kind === "ANY";
  const filterAnyAware = (fields: KnowledgeField[]) =>
    fields.filter((f) => {
      const kind = state.fields[f.key]?.kind;
      if (kind === "ANY" || kind === "NOT_APPLICABLE") {
        suppressed.push(f.key);
        return false;
      }
      if (kind === "VALUE") return false;
      if (brandAny && (f.key === "brand" || f.key === "brandPreference")) {
        suppressed.push(f.key);
        return false;
      }
      // TV: don't force model when unknown
      if (
        f.key === "model" &&
        state.fields.model?.kind === "UNKNOWN" &&
        (state.fields.productType?.value?.includes("televizyon") ||
          state.taxonomyNodeId?.includes("televizyon"))
      ) {
        return false;
      }
      return true;
    });

  return {
    known: base.known,
    missingRequired: filterAnyAware(filterSpare(base.missingRequired)),
    optionalUseful: filterAnyAware(filterSpare(base.optionalUseful)),
    next: filterAnyAware(filterSpare(base.next)),
    suppressed: [...new Set(suppressed)],
  };
}
