import { ATTRIBUTE_CONFIDENCE } from "./confidence-config";
import type {
  UnderstandingFact,
  UnderstandingProvenance,
  UnderstandingSource,
  UnderstandingValue,
} from "./types";

export function uv<T>(
  value: T,
  input: {
    confidence?: number;
    provenance: UnderstandingProvenance;
    source: UnderstandingSource;
    evidence?: string[];
  },
): UnderstandingValue<T> {
  const confidence =
    input.confidence ??
    (input.provenance === "EXPLICIT"
      ? ATTRIBUTE_CONFIDENCE.explicit
      : ATTRIBUTE_CONFIDENCE.strongInference);

  return {
    value,
    confidence: clamp01(confidence),
    provenance: input.provenance,
    source: input.source,
    evidence: input.evidence,
  };
}

export function factFromValue(
  key: string,
  value: UnderstandingValue<unknown>,
): UnderstandingFact {
  return {
    key,
    value: value.value,
    confidence: value.confidence,
    provenance: value.provenance,
    source: value.source,
    evidence: value.evidence,
  };
}

export function partitionFacts(
  values: Array<{ key: string; value: UnderstandingValue<unknown> | undefined }>,
): { explicitFacts: UnderstandingFact[]; inferredFacts: UnderstandingFact[] } {
  const explicitFacts: UnderstandingFact[] = [];
  const inferredFacts: UnderstandingFact[] = [];

  for (const row of values) {
    if (!row.value) continue;
    const fact = factFromValue(row.key, row.value);
    if (fact.provenance === "EXPLICIT") explicitFacts.push(fact);
    else inferredFacts.push(fact);
  }

  return { explicitFacts, inferredFacts };
}

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** Prefer explicit over inferred when merging same key. */
export function preferExplicit<T>(
  a?: UnderstandingValue<T>,
  b?: UnderstandingValue<T>,
): UnderstandingValue<T> | undefined {
  if (!a) return b;
  if (!b) return a;
  if (a.provenance === "EXPLICIT" && b.provenance !== "EXPLICIT") return a;
  if (b.provenance === "EXPLICIT" && a.provenance !== "EXPLICIT") return b;
  return a.confidence >= b.confidence ? a : b;
}
