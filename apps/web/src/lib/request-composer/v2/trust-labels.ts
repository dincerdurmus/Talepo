/**
 * User-facing trust language for extracted facts.
 * Never show raw confidence percentages in the composer UI.
 */

export type TrustTone = "understood" | "check" | "unsure";

export function trustToneFromConfidence(confidence: number | undefined): TrustTone {
  if (typeof confidence !== "number" || !Number.isFinite(confidence)) {
    return "check";
  }
  if (confidence >= 0.7) return "understood";
  if (confidence >= 0.45) return "check";
  return "unsure";
}

export function trustLabelForTone(tone: TrustTone): string {
  switch (tone) {
    case "understood":
      return "Bunu anladık";
    case "check":
      return "Bunu kontrol edelim";
    case "unsure":
      return "Bu konuda emin değiliz";
  }
}
