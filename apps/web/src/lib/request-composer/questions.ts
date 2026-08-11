/**
 * Question minimization wired to hybrid state + schema priority + ANY semantics.
 * Sole question authority for Hybrid Composer / /talep ask surface.
 */

import type { DynamicField } from "@/lib/request-category-engine";
import { resolveNextQuestions } from "@/lib/knowledge/question-resolver";
import type { KnowledgeField } from "@/lib/knowledge/types";
import type { CompletenessBreakdown } from "@/lib/price-intelligence/strategy-completeness";
import type { PriceStrategyKey } from "@/lib/price-intelligence/price-strategy-registry";
import { rankNextBestQuestions } from "@/lib/request-brain/question-priority";
import type { QuestionCandidate } from "@/lib/request-brain/types";

import { toResolverFieldBag } from "./build-state";
import type { CanonicalRequestState } from "./types";

export type HybridQuestionResult = {
  known: string[];
  missingRequired: KnowledgeField[];
  optionalUseful: KnowledgeField[];
  next: KnowledgeField[];
  /** Keys skipped because ANY / NOT_APPLICABLE / not needed for spare parts */
  suppressed: string[];
  /**
   * UI-ready candidates — single authoritative list.
   * Ranking may reuse rankNextBestQuestions as an internal scorer only.
   */
  candidates: QuestionCandidate[];
  /** Debug / tests: which pipeline produced the final list */
  questionSource: "canonical-hybrid";
};

const AUTOMOTIVE_SPARE_SUPPRESS = new Set([
  "engine",
  "transmission",
  "fuel",
  "trim",
  "mileage",
  "bodyCondition",
  "condition",
  "variant",
]);

function knowledgeFieldToCandidate(field: KnowledgeField): QuestionCandidate {
  const inputType =
    field.type === "ENUM" || field.type === "MULTI_SELECT"
      ? "select"
      : field.type === "NUMBER" || field.type === "MEASUREMENT" || field.type === "RANGE"
        ? "number"
        : "text";
  return {
    fieldKey: field.engineFieldKey ?? field.key,
    label: field.canonicalLabel,
    reason:
      field.priority === "required"
        ? "Yayın için gerekli"
        : "Teklif kalitesini artırabilir",
    publishImpact: field.priority === "required" ? 0.9 : 0.5,
    matchingImpact: 0.6,
    priceImpact: 0.4,
    confidenceImpact: 0.4,
    priorityScore: field.priority === "required" ? 0.9 : 0.55,
    inputType,
    options: field.options?.map((o) => ({ label: o.label, value: o.value })),
  };
}

/**
 * Reuse strategy ranking as an internal sort — allowlist remains hybrid schema next[].
 */
function rankWithinAllowlist(
  allowlist: KnowledgeField[],
  opts: {
    strategy?: PriceStrategyKey | null;
    completeness?: CompletenessBreakdown | null;
    fieldValues: Record<string, string>;
    dynamicFields?: DynamicField[];
    requiredDynamicKeys?: string[];
  },
): QuestionCandidate[] {
  const base = allowlist.map(knowledgeFieldToCandidate);
  if (!opts.strategy || !opts.completeness || base.length === 0) {
    return base.slice(0, 3);
  }

  const allowKeys = new Set(allowlist.map((f) => f.key));
  const ranked = rankNextBestQuestions({
    strategy: opts.strategy,
    completeness: opts.completeness,
    fieldValues: opts.fieldValues,
    commonDraft: {
      title: opts.fieldValues.title ?? "",
      city: opts.fieldValues.city ?? "",
      budget: opts.fieldValues.budget ?? "",
      quantity: opts.fieldValues.quantity ?? "",
      delivery: opts.fieldValues.delivery ?? "",
    },
    dynamicFields: opts.dynamicFields ?? [],
    requiredDynamicKeys: opts.requiredDynamicKeys ?? [],
    maxQuestions: 8,
  }).filter((q) => allowKeys.has(q.fieldKey));

  const seen = new Set(ranked.map((q) => q.fieldKey));
  const merged = [
    ...ranked,
    ...base.filter((c) => !seen.has(c.fieldKey)),
  ];
  return merged.slice(0, 3);
}

export type ResolveHybridQuestionsOptions = {
  strategy?: PriceStrategyKey | null;
  completeness?: CompletenessBreakdown | null;
  dynamicFields?: DynamicField[];
  requiredDynamicKeys?: string[];
};

/**
 * Resolve next questions from canonical hybrid state.
 * ANY / NOT_APPLICABLE are not missing; automotive spare suppresses engine/TX.
 */
export function resolveHybridQuestions(
  state: CanonicalRequestState,
  opts?: ResolveHybridQuestionsOptions,
): HybridQuestionResult {
  const values = toResolverFieldBag(state);
  const categoryId =
    state.categoryId ?? state.understanding.category.value ?? null;

  // Unknown category: don't dump appliance questions on free-text
  if (!categoryId) {
    return {
      known: [],
      missingRequired: [],
      optionalUseful: [],
      next: [],
      suppressed: ["no-category"],
      candidates: [],
      questionSource: "canonical-hybrid",
    };
  }

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

  const missingRequired = filterAnyAware(filterSpare(base.missingRequired));
  const optionalUseful = filterAnyAware(filterSpare(base.optionalUseful));
  const next = filterAnyAware(filterSpare(base.next));

  const candidates = rankWithinAllowlist(next, {
    strategy: opts?.strategy,
    completeness: opts?.completeness,
    fieldValues: values,
    dynamicFields: opts?.dynamicFields,
    requiredDynamicKeys: opts?.requiredDynamicKeys,
  });

  return {
    known: base.known,
    missingRequired,
    optionalUseful,
    next,
    suppressed: [...new Set(suppressed)],
    candidates,
    questionSource: "canonical-hybrid",
  };
}
