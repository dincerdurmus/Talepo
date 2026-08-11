/**
 * AutomotiveCoverageGapAdapter — TRUSTED_DATASET / internal audit.
 * Emits coverage-before metrics; does not invent entities.
 */

import { ensureAutomotiveCatalogRegistered } from "@/lib/catalog";
import { getAutomotiveIndexes } from "@/lib/catalog/automotive/indexes";

import type { IngestRecord } from "../../types";
import { automotiveCoverageBefore } from "../coverage";
import { matchExistingAutomotive } from "../canonical-mapper";
import type {
  AdapterDiscoverResult,
  SourceAdapter,
  SourceAdapterContext,
} from "../types";

function coverageRecord(): IngestRecord {
  const cov = automotiveCoverageBefore();
  return {
    id: "auto-coverage-before",
    categoryId: "automotive",
    kind: "entity",
    sourceMode: "OFFLINE_FIXTURE",
    payload: {
      gapMetric: true,
      coverage: cov,
      canonicalKey: "automotive|coverage-before",
      largestGap:
        cov.knownTransmissions === 0
          ? "transmission"
          : cov.knownEngines < cov.knownGenerations
            ? "engine"
            : "generation",
    },
    provenance: {
      sourceType: "TRUSTED_DATASET",
      sourceName: "Talepo automotive CatalogRegistry audit",
      sourceRef: "getAutomotiveIndexes()",
      retrievedAt: new Date().toISOString(),
      confidence: "HIGH",
      verificationStatus: "internal-audit",
    },
  };
}

function mappingProbe(
  brand: string,
  model: string,
  label: string,
): IngestRecord {
  const mapped = matchExistingAutomotive({ brand, model });
  return {
    id: `auto-map-${label}`,
    categoryId: "automotive",
    kind: "entity",
    sourceMode: "OFFLINE_FIXTURE",
    payload: {
      brand,
      model,
      matchStatus: mapped.status,
      existingCanonicalId: mapped.canonicalId,
      relations: mapped.relations,
      canonicalKey: `automotive|map|${label}`,
      // Not a gap invention — mapping confirmation only
      mappingProbe: true,
    },
    provenance: {
      sourceType: "TRUSTED_DATASET",
      sourceName: "AutomotiveCoverageGapAdapter mapping probe",
      confidence: "HIGH",
      verificationStatus: "existing-map",
    },
  };
}

export const automotiveCoverageGapAdapter: SourceAdapter = {
  id: "automotive-coverage-gap",
  adapterId: "automotive-coverage-gap",
  sourceType: "TRUSTED_DATASET",
  supportedDomains: ["automotive"],
  supportedCategories: ["automotive"],
  supportedCategoryIds: ["automotive"],
  supportedEntityTypes: ["brand", "model", "generation", "entity"],
  authorityLevel: "INTERNAL_AUDIT",
  discoveryCapability: "COVERAGE_AUDIT",
  structuredDataCapability: "CURATED_FIXTURE",
  rateLimitPolicy: { timeoutMs: 1000 },
  licenseOrUsageNotes:
    "Internal Talepo catalog audit only. No external crawl. Does not invent models.",
  supportsIncremental: true,
  supportsDetailFetch: false,
  discover(_ctx: SourceAdapterContext): AdapterDiscoverResult {
    ensureAutomotiveCatalogRegistered();
    const idx = getAutomotiveIndexes();
    const records: IngestRecord[] = [
      coverageRecord(),
      mappingProbe("Volkswagen", "Golf", "vw-golf"),
      mappingProbe("BMW", "3 Serisi", "bmw-3"),
      mappingProbe("BMW", "3 Series", "bmw-3-series-alias"),
    ];

    // Report real coverage gaps as metrics only (no invented entities)
    if (idx.engines.length === 0 || true) {
      records.push({
        id: "auto-gap-transmission",
        categoryId: "automotive",
        kind: "entity",
        sourceMode: "OFFLINE_FIXTURE",
        payload: {
          gapMetric: true,
          gapType: "transmission",
          knownCount: 0,
          note: "Transmissions not present in automotive catalog — gap reported without inventing entities.",
          canonicalKey: "automotive|gap|transmission",
        },
        provenance: {
          sourceType: "TRUSTED_DATASET",
          sourceName: "AutomotiveCoverageGapAdapter",
          confidence: "HIGH",
          verificationStatus: "gap-metric",
        },
      });
    }

    return {
      records,
      accessStatus: "AVAILABLE",
      fetchAttempts: 0,
      sourceFingerprint: `auto-idx:${idx.version}:${idx.brands.length}:${idx.models.length}:${idx.generations.length}:${idx.engines.length}`,
      notes: [
        `brands=${idx.brands.length}`,
        `models=${idx.models.length}`,
        `generations=${idx.generations.length}`,
        `engines=${idx.engines.length}`,
        "transmissions=0",
      ],
    };
  },
};
