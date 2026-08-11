/**
 * Coverage-before / coverage-after reports for ingestion domains.
 */

import { ensureAutomotiveCatalogRegistered } from "@/lib/catalog";
import { getAutomotiveIndexes } from "@/lib/catalog/automotive/indexes";

export type DomainCoverageReport = {
  domain: string;
  knownBrands: number;
  knownFamilies: number;
  knownModels: number;
  knownSeries: number;
  knownGenerations: number;
  knownEngines: number;
  knownTransmissions: number;
  knownVariants: number;
  notes: string[];
};

export type CoverageCompareReport = DomainCoverageReport & {
  discovered: number;
  existing: number;
  newCandidates: number;
  ambiguous: number;
  rejected: number;
};

export function automotiveCoverageBefore(): DomainCoverageReport {
  ensureAutomotiveCatalogRegistered();
  const idx = getAutomotiveIndexes();
  return {
    domain: "automotive",
    knownBrands: idx.brands.length,
    knownFamilies: 0,
    knownModels: idx.models.length,
    knownSeries: 0,
    knownGenerations: idx.generations.length,
    knownEngines: idx.engines.length,
    knownTransmissions: idx.transmissions.length,
    knownVariants: 0,
    notes: [
      idx.transmissions.length === 0
        ? "Production transmission catalog empty (V2C loader empty-safe) — count=0."
        : `Production transmissions loaded=${idx.transmissions.length}.`,
      "Families/series not first-class in automotive graph (brand→model→generation).",
    ],
  };
}

export function emptyDomainCoverage(domain: string, notes: string[] = []): DomainCoverageReport {
  return {
    domain,
    knownBrands: 0,
    knownFamilies: 0,
    knownModels: 0,
    knownSeries: 0,
    knownGenerations: 0,
    knownEngines: 0,
    knownTransmissions: 0,
    knownVariants: 0,
    notes: [
      ...notes,
      "No production entity catalog for this domain yet — coverage starts at zero.",
    ],
  };
}

export function coverageBeforeForCategory(categoryId: string): DomainCoverageReport {
  if (categoryId === "automotive") return automotiveCoverageBefore();
  if (categoryId === "appliances") {
    return emptyDomainCoverage("appliances", [
      "Appliances production catalog not seeded; fixtures/discovery only in SourceAdapters V1.",
    ]);
  }
  if (categoryId === "technology") {
    return emptyDomainCoverage("technology", [
      "Technology production catalog not seeded; fixtures/discovery only in SourceAdapters V1.",
    ]);
  }
  if (categoryId === "machinery") {
    return emptyDomainCoverage("machinery", [
      "Machinery selective pilot — no production entity catalog seed.",
    ]);
  }
  return emptyDomainCoverage(categoryId);
}

export function buildCoverageBefore(
  categoryIds: string[],
): Record<string, DomainCoverageReport> {
  const out: Record<string, DomainCoverageReport> = {};
  for (const id of categoryIds) {
    out[id] = coverageBeforeForCategory(id);
  }
  return out;
}
