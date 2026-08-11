/**
 * Stub SourceAdapter for foundation tests.
 * Real manufacturer/EPC adapters land in a later phase.
 */

import type { IngestRecord } from "../../types";
import type { SourceAdapter, SourceAdapterContext } from "../types";

export function createStubSourceAdapter(opts: {
  id: string;
  supportedCategoryIds: string[];
  recordsFor: (ctx: SourceAdapterContext) => IngestRecord[];
}): SourceAdapter {
  return {
    id: opts.id,
    sourceType: "TRUSTED_DATASET",
    supportedCategoryIds: opts.supportedCategoryIds,
    discover(ctx) {
      return opts.recordsFor(ctx);
    },
  };
}

export const EMPTY_ADAPTERS: SourceAdapter[] = [];
