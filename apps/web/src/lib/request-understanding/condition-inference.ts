import { uv } from "./provenance";
import type {
  RequestIntent,
  SubjectKind,
  UnderstandingValue,
} from "./types";

/** Emergency rollback switch: false disables all contextual condition inference. */
export const ENABLE_CONTEXTUAL_CONDITION_INFERENCE = true;

const CONDITION_CAPABLE_CATEGORIES = new Set([
  "automotive",
  "machinery",
  "furniture",
  "technology",
  "appliances",
  "medical",
  "baby",
]);

const USED_CONTEXT =
  /(?:^|[^\p{L}\p{N}])(?:kullanılmış|kullanilmis|az\s+kullanılmış|az\s+kullanilmis|teşhir|teshir|kutusu\s+açılmış|kutusu\s+acilmis|çiziksiz|ciziksiz|ekspertiz|boyasız|boyasiz|değişensiz|degisensiz|hasarsız|hasarsiz|bakımları\s+yapılmış|bakimlari\s+yapilmis|çalışma\s+saati|calisma\s+saati)(?=[^\p{L}\p{N}]|$)/iu;

export type ConditionInferenceInput = {
  normalizedInput: string;
  categoryId?: string | null;
  subjectKind: SubjectKind;
  intent: RequestIntent;
  modelYear?: number | null;
  currentYear?: number;
};

/**
 * Contextual inference is deliberately conservative:
 * - explicit/structured condition is resolved by the caller and always wins;
 * - a past vehicle model year can safely imply used;
 * - in other durable categories year alone is ambiguous, so the question remains;
 * - parts/services/property never inherit condition from a parent/model year.
 */
export function inferConditionFromContext(
  input: ConditionInferenceInput,
): UnderstandingValue<"NEW" | "USED" | "REFURBISHED" | "UNKNOWN"> | undefined {
  if (!ENABLE_CONTEXTUAL_CONDITION_INFERENCE) return undefined;
  if (input.intent !== "BUY") return undefined;
  if (
    input.subjectKind === "PART" ||
    input.subjectKind === "SERVICE" ||
    input.subjectKind === "PROPERTY"
  ) {
    return undefined;
  }

  const categoryId = input.categoryId?.split("/")[0] ?? null;
  const conditionCapable =
    input.subjectKind === "VEHICLE" ||
    (categoryId != null && CONDITION_CAPABLE_CATEGORIES.has(categoryId));
  if (!conditionCapable) return undefined;

  const usedContext = USED_CONTEXT.test(input.normalizedInput);
  const currentYear = input.currentYear ?? new Date().getFullYear();

  if (
    input.subjectKind === "VEHICLE" &&
    input.modelYear != null &&
    input.modelYear < currentYear
  ) {
    return uv("USED", {
      provenance: "INFERRED",
      source: "DETERMINISTIC_INFERENCE",
      confidence: usedContext ? 0.97 : 0.94,
      evidence: [
        `condition:vehicle-past-model-year=${input.modelYear}`,
        ...(usedContext ? ["condition:used-context"] : []),
      ],
    });
  }

  if (usedContext) {
    return uv("USED", {
      provenance: "INFERRED",
      source: "DETERMINISTIC_INFERENCE",
      confidence: 0.91,
      evidence: ["condition:used-context"],
    });
  }

  return undefined;
}
