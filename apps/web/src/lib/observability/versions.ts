import {
  DISCOVERY_FILTER_VERSION,
  DISCOVERY_PROJECTION_VERSION,
} from "@/lib/discovery/types";

/**
 * Traceable version metadata for intelligence/read-model surfaces.
 * Reports known hardcoded drifts; no mass refactor in Phase 4A.
 */

export type VersionSurface =
  | "understanding"
  | "taxonomy"
  | "discovery_projection"
  | "discovery_filter"
  | "matcher"
  | "price_strategy";

export type VersionInfo = {
  surface: VersionSurface;
  version: string | number;
  source: string;
  notes?: string;
};

export function getPlatformVersionMetadata(): VersionInfo[] {
  return [
    {
      surface: "understanding",
      version: "v1",
      source: "request-understanding/types.ts (RequestUnderstandingResult.version)",
      notes: "Hardcoded literal \"v1\" — drift risk if pipeline changes without bump.",
    },
    {
      surface: "taxonomy",
      version: "manifest",
      source: "data/taxonomy/manifest.json",
      notes: "Loaded via ensureTaxonomyLoaded / registry — check manifest version field.",
    },
    {
      surface: "discovery_projection",
      version: DISCOVERY_PROJECTION_VERSION,
      source: "lib/discovery/types.ts DISCOVERY_PROJECTION_VERSION",
    },
    {
      surface: "discovery_filter",
      version: DISCOVERY_FILTER_VERSION,
      source: "lib/discovery/types.ts DISCOVERY_FILTER_VERSION",
    },
    {
      surface: "matcher",
      version: "distribute+hunter-v1",
      source: "server/request/distribute-request.ts + opportunity-hunter",
      notes: "No single matcher version constant yet.",
    },
    {
      surface: "price_strategy",
      version: "registry-v1",
      source: "lib/price-intelligence/price-strategy-registry.ts",
      notes: "Strategy IDs are enum-like; no global version field.",
    },
  ];
}
