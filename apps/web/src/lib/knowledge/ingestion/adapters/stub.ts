/**
 * Stub SourceAdapter for foundation tests.
 */

import type { IngestRecord } from "../../types";
import type {
  AdapterDiscoverResult,
  SourceAdapter,
  SourceAdapterContext,
} from "../types";

export function createStubSourceAdapter(opts: {
  id: string;
  supportedCategoryIds: string[];
  recordsFor: (ctx: SourceAdapterContext) => IngestRecord[];
}): SourceAdapter {
  return {
    id: opts.id,
    adapterId: opts.id,
    sourceType: "TRUSTED_DATASET",
    supportedDomains: opts.supportedCategoryIds,
    supportedCategories: opts.supportedCategoryIds,
    supportedCategoryIds: opts.supportedCategoryIds,
    supportedEntityTypes: ["entity"],
    authorityLevel: "TRUSTED_DATASET",
    discoveryCapability: "FULL_GRAPH",
    structuredDataCapability: "CURATED_FIXTURE",
    rateLimitPolicy: { timeoutMs: 1000 },
    licenseOrUsageNotes: "Test stub — not a real source.",
    supportsIncremental: false,
    supportsDetailFetch: false,
    discover(ctx): AdapterDiscoverResult {
      return {
        records: opts.recordsFor(ctx),
        accessStatus: "AVAILABLE",
        fetchAttempts: 0,
        notes: ["stub"],
      };
    },
  };
}

export const EMPTY_ADAPTERS: SourceAdapter[] = [];
