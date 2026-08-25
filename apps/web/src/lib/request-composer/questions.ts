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
  "modelYear",
]);

/** Whole-product fields that must not be asked for a spare/part subject. */
const PART_SUPPRESS_WHOLE_PRODUCT = new Set([
  "energyClass",
  "usageArea",
  "listingType",
  "propertyType",
  "roomCount",
  "mileage",
  "engine",
  "transmission",
  "fuel",
]);

/**
 * Product-family fields are named differently by category schemas. If the
 * canonical state already knows one of them, asking the generic equivalent
 * again creates a duplicate question (for example: "süpürge" + "Ürün türü").
 */
const PRODUCT_FAMILY_KEYS = [
  "productType",
  "applianceType",
  "furnitureType",
  "machineType",
  "deviceFamily",
] as const;

function hasKnownProductFamily(state: CanonicalRequestState): boolean {
  return PRODUCT_FAMILY_KEYS.some((key) => {
    const field = state.fields[key];
    return (
      field?.kind === "VALUE" &&
      typeof field.value === "string" &&
      field.value.trim().length > 0
    );
  });
}

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
    quickChoices: field.options?.map((o) => ({
      label: o.label,
      value: o.value,
    })),
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

  /**
   * KAPSAM DIŞI TALEPTE SORU MOTORU BAŞLAMAZ (kurucu kararı, 2026-08-25).
   *
   * Arz ilanı Talepo'nun konusu değildir; ona bütçe, konum ya da marka
   * sormak kullanıcıyı yayınlanamayacak bir formda yürütmek olur. Karar
   * burada verilmez — anlama katmanının tek kapsam kararı okunur.
   */
  if (state.understanding.requestScope?.value === "UNSUPPORTED_SUPPLY") {
    return {
      known: [],
      missingRequired: [],
      optionalUseful: [],
      next: [],
      suppressed: ["unsupported-supply"],
      candidates: [],
      questionSource: "canonical-hybrid",
    };
  }

  const categoryId =
    state.categoryId ?? state.understanding.category.value ?? null;
  const categoryUnknown = !categoryId || categoryId === "unknown";

  // Unknown category: don't dump appliance/vehicle/estate questions on free-text
  if (categoryUnknown) {
    return {
      known: [],
      missingRequired: [],
      optionalUseful: [],
      next: [],
      suppressed: ["no-category"],
      candidates: [
        {
          fieldKey: "needDescription",
          label: "Ne aradığını biraz daha tarif eder misin?",
          reason: "Kategori henüz net değil",
          publishImpact: 0.9,
          matchingImpact: 0.8,
          priceImpact: 0.2,
          confidenceImpact: 0.9,
          priorityScore: 0.95,
          inputType: "text",
          placeholder: "Ürün, parça, hizmet veya emlak olarak yazabilirsiniz",
        },
      ],
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

  const isPartSubject =
    values.needType === "part" ||
    values.needType === "tire" ||
    state.understanding.requestSubject.kind.value === "PART" ||
    state.understanding.requestSubject.kind.value === "ACCESSORY";

  const isAutoSpare = categoryId === "automotive" && isPartSubject;

  const automotiveNeedUnknown =
    categoryId === "automotive" &&
    !isAutoSpare &&
    !(
      state.fields.needType?.kind === "VALUE" &&
      state.fields.needType.value
    ) &&
    state.understanding.requestSubject.kind.value !== "VEHICLE";

  const browsePinnedNeed =
    state.fields.needType?.provenance === "EXPLICIT_BROWSE" &&
    state.fields.needType.kind === "VALUE";

  const productFamilyKnown = hasKnownProductFamily(state);

  const suppressed: string[] = [];
  const filterSpare = (fields: KnowledgeField[]) => {
    if (!isAutoSpare && !isPartSubject) return fields;
    return fields.filter((f) => {
      if (isAutoSpare && AUTOMOTIVE_SPARE_SUPPRESS.has(f.key)) {
        suppressed.push(f.key);
        return false;
      }
      if (isPartSubject && PART_SUPPRESS_WHOLE_PRODUCT.has(f.key)) {
        suppressed.push(f.key);
        return false;
      }
      return true;
    });
  };

  // Never re-ask ANY / NA / known VALUE fields; never force model when brand is ANY
  const brandAny = state.fields.brand?.kind === "ANY";
  const brandPreferred = (state.fields.brand?.preferredValues?.length ?? 0) >= 1;
  const filterAnyAware = (fields: KnowledgeField[]) =>
    fields.filter((f) => {
      if (
        productFamilyKnown &&
        PRODUCT_FAMILY_KEYS.includes(
          (f.engineFieldKey ?? f.key) as (typeof PRODUCT_FAMILY_KEYS)[number],
        )
      ) {
        suppressed.push(f.key);
        return false;
      }
      // Automotive root without intent: only ask needType — never flash vehicle-purchase fields
      if (
        automotiveNeedUnknown &&
        f.key !== "needType"
      ) {
        suppressed.push(f.key);
        return false;
      }
      // Generic spare-part: year is optional unless the part schema marks it visible
      if (
        f.key === "modelYear" &&
        (isAutoSpare ||
          state.understanding.requestSubject.kind.value === "PART" ||
          state.understanding.requestSubject.kind.value === "ACCESSORY")
      ) {
        suppressed.push(f.key);
        return false;
      }
      if (browsePinnedNeed && f.key === "needType") {
        suppressed.push(f.key);
        return false;
      }
      const field = state.fields[f.key];
      const kind = field?.kind;
      if (kind === "ANY" || kind === "NOT_APPLICABLE") {
        suppressed.push(f.key);
        return false;
      }
      if (kind === "VALUE") return false;
      // Preferred / allowed multi-value satisfies the field for ask purposes
      if (
        (field?.preferredValues?.length ?? 0) >= 1 ||
        (field?.allowedValues?.length ?? 0) >= 1
      ) {
        suppressed.push(f.key);
        return false;
      }
      // Exclusion-only without need to pick a positive value (ANY+exclude already handled)
      if (brandAny && (f.key === "brand" || f.key === "brandPreference")) {
        suppressed.push(f.key);
        return false;
      }
      if (
        brandPreferred &&
        (f.key === "brand" || f.key === "brandPreference")
      ) {
        suppressed.push(f.key);
        return false;
      }
      // TV: don't force model when unknown
      if (
        f.key === "model" &&
        state.fields.model?.kind === "UNKNOWN" &&
        !(state.fields.model?.preferredValues?.length) &&
        (state.fields.productType?.value?.includes("televizyon") ||
          state.taxonomyNodeId?.includes("televizyon"))
      ) {
        return false;
      }
      // deviceFamily is for generic hardware leaf — irrelevant on TV / appliance paths
      if (
        f.key === "deviceFamily" &&
        (state.fields.productType?.value
          ?.toLocaleLowerCase("tr-TR")
          .includes("televizyon") ||
          state.taxonomyNodeId?.includes("televizyon") ||
          state.understanding.requestSubject.kind.value === "PART" ||
          categoryId === "appliances" ||
          categoryId === "automotive")
      ) {
        suppressed.push(f.key);
        return false;
      }
      // Explicit part condition (çıkma / ikinci el) — don't re-ask vehicle condition
      if (
        f.key === "condition" &&
        (state.understanding.requestSubject.kind.value === "PART" ||
          state.understanding.requestSubject.kind.value === "ACCESSORY" ||
          values.needType === "part")
      ) {
        suppressed.push(f.key);
        return false;
      }
      return true;
    });

  const missingRequired = filterAnyAware(filterSpare(base.missingRequired));
  const optionalUseful = filterAnyAware(filterSpare(base.optionalUseful));
  const next = filterAnyAware(filterSpare(base.next)).slice(0, 3);

  let candidates = rankWithinAllowlist(next, {
    strategy: opts?.strategy,
    completeness: opts?.completeness,
    fieldValues: values,
    dynamicFields: opts?.dynamicFields,
    requiredDynamicKeys: opts?.requiredDynamicKeys,
  });

  if (categoryId === "automotive" && !isPartSubject) {
    const vehiclePreferenceKeys = new Set(["fuel", "transmission"]);
    const preferred = next
      .filter((field) => vehiclePreferenceKeys.has(field.engineFieldKey ?? field.key))
      .map(knowledgeFieldToCandidate);
    candidates = [
      ...preferred,
      ...candidates.filter((candidate) => !vehiclePreferenceKeys.has(candidate.fieldKey)),
    ].slice(0, 3);
  }

  const cityField = [...missingRequired, ...next, ...optionalUseful].find(
    (field) => (field.engineFieldKey ?? field.key) === "city",
  );
  if (!values.city?.trim() && cityField) {
    candidates = [
      knowledgeFieldToCandidate(cityField),
      ...candidates.filter((candidate) => candidate.fieldKey !== "city"),
    ].slice(0, 3);
  }

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
