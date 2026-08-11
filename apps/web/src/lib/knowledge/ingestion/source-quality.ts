/**
 * Source quality scoring across registered / observed sources.
 * V2C adds TRANSMISSION_DETAIL + ENGINE_DETAIL dimensions.
 */

import type { AuthorityLevel } from "./types";
import type { SourceRegistryEntry } from "./source-registry";

export type QualityDimension =
  | "AUTHORITY"
  | "STRUCTURE"
  | "STABILITY"
  | "COVERAGE"
  | "SPEC_DETAIL"
  | "IDENTIFIER_QUALITY"
  | "ACCESS_RELIABILITY"
  | "TRANSMISSION_DETAIL"
  | "ENGINE_DETAIL";

export type SourceQualityScore = {
  sourceId: string;
  dimensions: Record<QualityDimension, number>;
  overall: number;
  notes: string[];
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function authorityScore(level: AuthorityLevel): number {
  switch (level) {
    case "OFFICIAL":
      return 1;
    case "TRUSTED_DATASET":
      return 0.85;
    case "INTERNAL_AUDIT":
      return 0.7;
    case "MARKETPLACE":
      return 0.35;
    case "DISCOVERY_ONLY":
      return 0.3;
    default:
      return 0.2;
  }
}

function structureScore(types: string[]): number {
  const set = new Set(types.map((t) => t.toLowerCase()));
  let s = 0;
  if ([...set].some((t) => t.includes("json") || t.includes("sparql") || t.includes("api"))) {
    s += 0.45;
  }
  if ([...set].some((t) => t.includes("json-ld") || t.includes("ld+json"))) s += 0.25;
  if ([...set].some((t) => t.includes("sitemap"))) s += 0.1;
  if ([...set].some((t) => t.includes("html") || t.includes("table"))) s += 0.1;
  if ([...set].some((t) => t.includes("fixture"))) s += 0.15;
  if ([...set].some((t) => t.includes("xml"))) s += 0.15;
  return clamp01(s);
}

function domainDetailHint(
  entry: SourceRegistryEntry,
  kind: "transmission" | "engine",
): number {
  const blob = `${entry.sourceId} ${entry.sourceName} ${entry.notes ?? ""} ${entry.coverageEstimate}`.toLowerCase();
  if (kind === "transmission") {
    if (/transmission|gearbox|dsg|dct|cvt|trany|epa/.test(blob)) return 0.75;
    if (entry.domain === "automotive" && entry.authorityLevel === "OFFICIAL") return 0.45;
    if (entry.authorityLevel === "DISCOVERY_ONLY") return 0.25;
    return 0.2;
  }
  if (/engine|power|displacement|epa|motor/.test(blob)) return 0.75;
  if (entry.domain === "automotive" && entry.authorityLevel === "OFFICIAL") return 0.5;
  if (entry.authorityLevel === "DISCOVERY_ONLY") return 0.25;
  return 0.2;
}

export function scoreSourceQuality(
  entry: SourceRegistryEntry,
  observed?: {
    accessSuccessRate?: number;
    avgSpecFields?: number;
    identifierPresentRate?: number;
    coverageHint?: number;
    stabilityHint?: number;
    transmissionDetailHint?: number;
    engineDetailHint?: number;
  },
): SourceQualityScore {
  const notes: string[] = [];
  const AUTHORITY = authorityScore(entry.authorityLevel);
  const STRUCTURE = structureScore(entry.structuredDataTypes);
  const ACCESS_RELIABILITY = clamp01(
    observed?.accessSuccessRate ??
      (entry.status === "ACTIVE"
        ? 0.8
        : entry.status === "ACCESS_BLOCKED"
          ? 0.05
          : entry.status === "DEGRADED"
            ? 0.4
            : 0.5),
  );
  const SPEC_DETAIL = clamp01(
    observed?.avgSpecFields != null
      ? Math.min(1, observed.avgSpecFields / 5)
      : entry.structuredDataTypes.some((t) => /json|sparql|api|xml/i.test(t))
        ? 0.55
        : 0.25,
  );
  const IDENTIFIER_QUALITY = clamp01(
    observed?.identifierPresentRate ??
      (entry.authorityLevel === "OFFICIAL" ? 0.7 : 0.4),
  );
  const COVERAGE = clamp01(
    observed?.coverageHint ??
      (entry.coverageEstimate.toLowerCase().includes("broad")
        ? 0.7
        : entry.coverageEstimate.toLowerCase().includes("partial")
          ? 0.4
          : 0.45),
  );
  const STABILITY = clamp01(
    observed?.stabilityHint ??
      (entry.accessMode === "SPARQL" || entry.accessMode === "PUBLIC_API"
        ? 0.75
        : entry.accessMode === "PUBLIC_HTTP"
          ? 0.45
          : 0.6),
  );
  const TRANSMISSION_DETAIL = clamp01(
    observed?.transmissionDetailHint ?? domainDetailHint(entry, "transmission"),
  );
  const ENGINE_DETAIL = clamp01(
    observed?.engineDetailHint ?? domainDetailHint(entry, "engine"),
  );

  if (entry.status === "ACCESS_BLOCKED") {
    notes.push("ACCESS_BLOCKED lowers ACCESS_RELIABILITY");
  }
  if (entry.authorityLevel === "DISCOVERY_ONLY") {
    notes.push("DISCOVERY_ONLY — not sole SAFE for critical OEM");
  }
  if (entry.authorityLevel === "MARKETPLACE") {
    notes.push("MARKETPLACE insufficient sole authority for TX/engine codes");
  }

  const dimensions: Record<QualityDimension, number> = {
    AUTHORITY,
    STRUCTURE,
    STABILITY,
    COVERAGE,
    SPEC_DETAIL,
    IDENTIFIER_QUALITY,
    ACCESS_RELIABILITY,
    TRANSMISSION_DETAIL,
    ENGINE_DETAIL,
  };

  const weights: Record<QualityDimension, number> = {
    AUTHORITY: 0.2,
    STRUCTURE: 0.12,
    STABILITY: 0.1,
    COVERAGE: 0.1,
    SPEC_DETAIL: 0.1,
    IDENTIFIER_QUALITY: 0.12,
    ACCESS_RELIABILITY: 0.1,
    TRANSMISSION_DETAIL: 0.08,
    ENGINE_DETAIL: 0.08,
  };

  let overall = 0;
  for (const k of Object.keys(dimensions) as QualityDimension[]) {
    overall += dimensions[k] * weights[k];
  }

  return {
    sourceId: entry.sourceId,
    dimensions,
    overall: Math.round(overall * 1000) / 1000,
    notes,
  };
}
