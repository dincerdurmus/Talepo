/**
 * Central coverage matrix — counts only, no fake percentages.
 */

export type CoverageBucket = "KNOWN" | "DISCOVERED" | "VERIFIED" | "REVIEW" | "GAP";

export type CoverageMatrixRow = {
  domain: string;
  entityType: string;
  KNOWN: number;
  DISCOVERED: number;
  VERIFIED: number;
  REVIEW: number;
  GAP: number;
  notes?: string[];
};

export type CoverageMatrix = {
  generatedAt: string;
  rows: CoverageMatrixRow[];
};

export function buildCoverageMatrix(input: {
  domain: string;
  known: Record<string, number>;
  discovered?: Record<string, number>;
  verified?: Record<string, number>;
  review?: Record<string, number>;
  gaps?: Record<string, number>;
  notes?: Record<string, string[]>;
}): CoverageMatrixRow[] {
  const entityTypes = new Set([
    ...Object.keys(input.known),
    ...Object.keys(input.discovered ?? {}),
    ...Object.keys(input.verified ?? {}),
    ...Object.keys(input.review ?? {}),
    ...Object.keys(input.gaps ?? {}),
  ]);

  const rows: CoverageMatrixRow[] = [];
  for (const entityType of entityTypes) {
    const KNOWN = input.known[entityType] ?? 0;
    const DISCOVERED = input.discovered?.[entityType] ?? 0;
    const VERIFIED = input.verified?.[entityType] ?? 0;
    const REVIEW = input.review?.[entityType] ?? 0;
    const explicitGap = input.gaps?.[entityType];
    const GAP =
      explicitGap != null
        ? explicitGap
        : Math.max(0, DISCOVERED - VERIFIED); // observational residual, not a % claim
    rows.push({
      domain: input.domain,
      entityType,
      KNOWN,
      DISCOVERED,
      VERIFIED,
      REVIEW,
      GAP,
      notes: input.notes?.[entityType],
    });
  }
  return rows;
}

export function emptyCoverageMatrix(domains: string[]): CoverageMatrix {
  return {
    generatedAt: new Date().toISOString(),
    rows: domains.flatMap((domain) =>
      ["brand", "model", "generation", "engine", "transmission", "family"].map(
        (entityType) => ({
          domain,
          entityType,
          KNOWN: 0,
          DISCOVERED: 0,
          VERIFIED: 0,
          REVIEW: 0,
          GAP: 0,
        }),
      ),
    ),
  };
}

export function mergeCoverageMatrices(parts: CoverageMatrixRow[]): CoverageMatrix {
  return {
    generatedAt: new Date().toISOString(),
    rows: parts,
  };
}
