/**
 * Field-scoped ANY / FARKETMEZ language — thin post-processor.
 * Does not invent global ANY; binds only to mentioned field context.
 */

import type { CanonicalFieldState } from "./types";

export type AnyBinding = {
  fieldKey: string;
  evidence: string;
};

type PatternRule = {
  fieldKey: string;
  /** Match against folded Turkish text */
  patterns: RegExp[];
};

const RULES: PatternRule[] = [
  {
    fieldKey: "brand",
    patterns: [
      /\bmarka\s+(fark\s*etmez|önemli\s*değil|onemli\s*degil)\b/i,
      /\b(fark\s*etmez|önemli\s*değil|onemli\s*degil)\s+marka\b/i,
      /\bherhangi\s+bir\s+marka\b/i,
      /\bmarka\s+herhangi\b/i,
    ],
  },
  {
    fieldKey: "color",
    patterns: [
      /\brenk(?:i|ler)?\s+(fark\s*etmez|önemli\s*değil|onemli\s*degil)\b/i,
      /\b(fark\s*etmez|önemli\s*değil|onemli\s*degil)\s+renk(?:i)?\b/i,
    ],
  },
  {
    fieldKey: "model",
    patterns: [
      /\bmodel(?:i)?\s+(fark\s*etmez|önemli\s*değil|onemli\s*degil)\b/i,
      /\b(fark\s*etmez|önemli\s*değil|onemli\s*degil)\s+model(?:i)?\b/i,
      /\bherhangi\s+bir\s+model\b/i,
    ],
  },
  {
    fieldKey: "condition",
    patterns: [
      /\bdurum(?:u)?\s+(fark\s*etmez|önemli\s*değil|onemli\s*degil)\b/i,
      /\b(sıfır|sifir)\s+(ikinci\s*el|2\.\s*el)\s+(fark\s*etmez|önemli\s*değil|onemli\s*degil)\b/i,
      /\b(ikinci\s*el|2\.\s*el)\s+(sıfır|sifir)\s+(fark\s*etmez|önemli\s*değil|onemli\s*degil)\b/i,
    ],
  },
  {
    fieldKey: "deliveryDate",
    patterns: [
      /\bteslim\s+tarih(?:i)?\s+(esnek|fark\s*etmez|önemli\s*değil|onemli\s*degil)\b/i,
      /\btermin\s+(esnek|fark\s*etmez)\b/i,
    ],
  },
];

/**
 * Extract field-scoped ANY bindings from free text.
 * Bare "farketmez" / "önemli değil" without a field cue is ignored
 * (no global ANY).
 */
export function extractFieldScopedAny(rawText: string): AnyBinding[] {
  const text = rawText.normalize("NFC");
  const found: AnyBinding[] = [];
  const seen = new Set<string>();

  for (const rule of RULES) {
    for (const re of rule.patterns) {
      const m = text.match(re);
      if (!m) continue;
      if (seen.has(rule.fieldKey)) break;
      seen.add(rule.fieldKey);
      found.push({ fieldKey: rule.fieldKey, evidence: m[0] });
      break;
    }
  }

  return found;
}

export function applyAnyBindingsToFields(
  fields: Record<string, CanonicalFieldState>,
  bindings: AnyBinding[],
): Record<string, CanonicalFieldState> {
  if (bindings.length === 0) return fields;
  const next = { ...fields };
  for (const b of bindings) {
    const existing = next[b.fieldKey];
    // Do not overwrite a concrete EXPLICIT_BROWSE value with ANY from stale text
    if (
      existing?.kind === "VALUE" &&
      existing.provenance === "EXPLICIT_BROWSE"
    ) {
      continue;
    }
    next[b.fieldKey] = {
      kind: "ANY",
      value: null,
      provenance: "EXPLICIT_TEXT",
      confidence: 0.95,
      evidence: [b.evidence],
    };
  }
  return next;
}
