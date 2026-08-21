/**
 * Enrich hybrid UnderstoodFact rows with trust tone for the editable board.
 */

import type { UnderstoodFact } from "@/lib/request-composer/ui-helpers";
import type { RequestUnderstandingResult } from "@/lib/request-understanding/types";

import {
  composerFieldDisplayValue,
  composerFieldLabel,
  shouldHideNeedTypeFact,
} from "./display-format";
import {
  trustLabelForTone,
  trustToneFromConfidence,
  type TrustTone,
} from "./trust-labels";

export type EditableUnderstoodFact = UnderstoodFact & {
  confidence?: number;
  tone: TrustTone;
  trustLabel: string;
  /** Fact was confirmed by the user in this session. */
  userConfirmed?: boolean;
};

function confidenceForFactKey(
  understanding: RequestUnderstandingResult,
  key: string,
): number | undefined {
  const attrs = understanding.attributes ?? {};
  if (attrs[key]?.confidence != null) return attrs[key]!.confidence;

  const identity = understanding.identity;
  if (key === "brand" && identity?.brand?.confidence != null) {
    return identity.brand.confidence;
  }
  if (key === "model" && identity?.model?.confidence != null) {
    return identity.model.confidence;
  }
  if (key === "modelYear" || key === "yearMin" || key === "yearMax") {
    const fromAttrs = attrs[key]?.confidence ?? attrs.modelYear?.confidence;
    if (fromAttrs != null) return fromAttrs;
  }
  if (key === "city" && understanding.location?.city?.confidence != null) {
    return understanding.location.city.confidence;
  }
  if (key === "condition" && understanding.condition?.confidence != null) {
    return understanding.condition.confidence;
  }
  if (understanding.category.value && key === "category") {
    return understanding.category.confidence;
  }
  if (
    key === "productType" ||
    key === "applianceType" ||
    key === "furnitureType"
  ) {
    return attrs[key]?.confidence ?? 0.82;
  }
  if (key === "screenSize") {
    return attrs.screenSize?.confidence ?? 0.85;
  }
  return undefined;
}

export function enrichUnderstoodFacts(input: {
  facts: UnderstoodFact[];
  understanding: RequestUnderstandingResult;
  confirmedKeys?: Set<string> | string[];
  dismissedKeys?: Set<string> | string[];
  categoryId?: string | null;
  isPartNeed?: boolean;
}): EditableUnderstoodFact[] {
  const confirmed = new Set(
    Array.isArray(input.confirmedKeys)
      ? input.confirmedKeys
      : [...(input.confirmedKeys ?? [])],
  );
  const dismissed = new Set(
    Array.isArray(input.dismissedKeys)
      ? input.dismissedKeys
      : [...(input.dismissedKeys ?? [])],
  );

  const hideNeedType = shouldHideNeedTypeFact(input.facts.map((f) => f.key));

  return input.facts
    .filter((fact) => !dismissed.has(fact.key))
    .filter((fact) => fact.displayValue.trim().length > 0)
    .filter((fact) => !(hideNeedType && fact.key === "needType"))
    .map((fact) => {
      const sourceValue =
        fact.key === "screenSize"
          ? fact.displayValue
              .replace(/\s*(?:ekran|inç|inc|inch)\s*$/i, "")
              .trim() || fact.displayValue
          : fact.displayValue;
      const displayValue = composerFieldDisplayValue({
        key: fact.key,
        value: sourceValue,
        categoryId:
          input.categoryId ?? input.understanding.category.value ?? null,
        rawInput: input.understanding.rawInput,
      });

      const confidence = confidenceForFactKey(input.understanding, fact.key);
      const tone = confirmed.has(fact.key)
        ? ("understood" as const)
        : trustToneFromConfidence(confidence);
      return {
        ...fact,
        label: composerFieldLabel(fact.key, Boolean(input.isPartNeed)),
        displayValue,
        confidence,
        tone,
        trustLabel:
          tone === "understood"
            ? ""
            : tone === "check"
              ? "Bunu doğru anladık mı?"
              : trustLabelForTone(tone),
        userConfirmed: confirmed.has(fact.key),
      };
    });
}
