/** Central thresholds for Request Understanding Confidence (0..1). */
import type { DecisionStatus } from "./types";

export const UNDERSTANDING_CONFIDENCE_WEIGHTS = {
  intent: 0.28,
  category: 0.22,
  strategy: 0.2,
  identity: 0.18,
  attributes: 0.12,
} as const;

export const UNDERSTANDING_PENALTIES = {
  ambiguity: 0.08,
  contradiction: 0.15,
  tentativeCategory: 0.05,
  unknownIntent: 0.1,
} as const;

/** Category decision gating */
export const CATEGORY_DECISION = {
  /** Minimum detector score for CONFIDENT status */
  confidentMinScore: 2,
  /** Below this confidence → UNKNOWN (do not treat as real category) */
  unknownBelow: 0.35,
  /** Below this → TENTATIVE even if detector marked confident */
  tentativeBelow: 0.55,
} as const;

/**
 * Güven → karar statüsü eşlemesi. Daha önce understand-request.ts içinde
 * modül-yereldi; kategori kapısı kendi modülüne taşınınca iki tüketici
 * oluştu ve eşik mantığı eşiklerin tanımlandığı bu dosyaya TAŞINDI
 * (kopyalanmadı). Eşikler CATEGORY_DECISION'dan okunur; ikinci bir eşik
 * tablosu yoktur.
 */
export function decisionStatus(
  confidence: number,
  opts?: { forceUnknown?: boolean; detectorConfident?: boolean },
): DecisionStatus {
  if (opts?.forceUnknown || confidence < CATEGORY_DECISION.unknownBelow) {
    return "UNKNOWN";
  }
  if (
    confidence < CATEGORY_DECISION.tentativeBelow ||
    opts?.detectorConfident === false
  ) {
    return "TENTATIVE";
  }
  return "CONFIDENT";
}

/** Attribute acceptance */
export const ATTRIBUTE_CONFIDENCE = {
  explicit: 0.95,
  normalizedExplicit: 0.9,
  strongInference: 0.75,
  weakInference: 0.45,
  identityStrong: 0.7,
  identityWeak: 0.4,
} as const;
