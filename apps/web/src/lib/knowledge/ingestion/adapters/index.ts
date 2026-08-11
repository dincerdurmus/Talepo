/**
 * Real SourceAdapter registry (SourceAdapters V2).
 * Policy enforcement remains in the ingestion engine via resolveKnowledgeProfile.
 */

import type { SourceAdapter } from "../types";
import { appliancesDiscoveryAdapter } from "./appliances-discovery";
import { automotiveCoverageGapAdapter } from "./automotive-coverage-gap";
import { automotiveEngineExpansionAdapter } from "./automotive-engine-expansion";
import { automotiveEpaFuelEconomyAdapter } from "./automotive-epa-fueleconomy";
import { automotiveTransmissionDiscoveryAdapter } from "./automotive-transmission";
import { automotiveWikidataAdapter } from "./automotive-wikidata";
import { genericStructuredDiscoveryAdapter } from "./generic-structured";
import { machinerySelectivePilotAdapter } from "./machinery-selective";
import { EMPTY_ADAPTERS } from "./stub";
import { technologyDiscoveryAdapter } from "./technology-discovery";

export {
  createStubSourceAdapter,
  EMPTY_ADAPTERS,
} from "./stub";
export { automotiveCoverageGapAdapter } from "./automotive-coverage-gap";
export { automotiveWikidataAdapter } from "./automotive-wikidata";
export { automotiveTransmissionDiscoveryAdapter } from "./automotive-transmission";
export { automotiveEngineExpansionAdapter } from "./automotive-engine-expansion";
export { automotiveEpaFuelEconomyAdapter } from "./automotive-epa-fueleconomy";
export { appliancesDiscoveryAdapter } from "./appliances-discovery";
export { technologyDiscoveryAdapter } from "./technology-discovery";
export { machinerySelectivePilotAdapter } from "./machinery-selective";
export { genericStructuredDiscoveryAdapter } from "./generic-structured";

/** All real adapters registered for CLI / ingest-all. */
export const REAL_SOURCE_ADAPTERS: SourceAdapter[] = [
  automotiveCoverageGapAdapter,
  automotiveWikidataAdapter,
  automotiveTransmissionDiscoveryAdapter,
  automotiveEngineExpansionAdapter,
  automotiveEpaFuelEconomyAdapter,
  appliancesDiscoveryAdapter,
  technologyDiscoveryAdapter,
  machinerySelectivePilotAdapter,
  genericStructuredDiscoveryAdapter,
];

export function getRegisteredAdapters(opts?: {
  sourceFilter?: string | null;
  categoryId?: string | null;
}): SourceAdapter[] {
  let list = REAL_SOURCE_ADAPTERS;
  if (opts?.sourceFilter) {
    list = list.filter(
      (a) =>
        a.adapterId === opts.sourceFilter || a.id === opts.sourceFilter,
    );
  }
  if (opts?.categoryId) {
    list = list.filter((a) =>
      (a.supportedCategories?.length
        ? a.supportedCategories
        : a.supportedCategoryIds
      ).includes(opts.categoryId!),
    );
  }
  return list;
}

export function adaptersForDomain(domain: string): SourceAdapter[] {
  if (domain === "all") return REAL_SOURCE_ADAPTERS;
  return getRegisteredAdapters({ categoryId: domain });
}

/** Disabled domains must never register live crawlers. */
export const DISABLED_DOMAIN_ADAPTERS: SourceAdapter[] = EMPTY_ADAPTERS;
