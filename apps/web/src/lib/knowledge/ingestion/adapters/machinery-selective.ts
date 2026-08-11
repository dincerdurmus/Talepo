/**
 * MachinerySelectivePilotAdapter — SELECTIVE policy, 3 pilot subcategories.
 */

import type { IngestRecord } from "../../types";
import { catalogSlug } from "../normalize";
import type {
  AdapterDiscoverResult,
  SourceAdapter,
  SourceAdapterContext,
} from "../types";
import { loadFixtureFile, toProvenance } from "./fixture-loader";

const PILOT_SUBCATS = new Set([
  "uretim-makinesi",
  "kesim-makinesi",
  "paketleme-makinesi",
]);

export const machinerySelectivePilotAdapter: SourceAdapter = {
  id: "machinery-selective-pilot",
  adapterId: "machinery-selective-pilot",
  sourceType: "TRUSTED_DATASET",
  supportedDomains: ["machinery"],
  supportedCategories: ["machinery"],
  supportedCategoryIds: ["machinery"],
  supportedEntityTypes: ["brand", "product_family", "model", "entity", "spec"],
  authorityLevel: "TRUSTED_DATASET",
  discoveryCapability: "MODEL",
  structuredDataCapability: "CURATED_FIXTURE",
  rateLimitPolicy: { timeoutMs: 1000 },
  licenseOrUsageNotes:
    "Selective curated fixtures only for Üretim / Kesim / Paketleme. No printing-services crawl.",
  supportsIncremental: true,
  supportsDetailFetch: false,
  discover(ctx: SourceAdapterContext): AdapterDiscoverResult {
    const limit = ctx.limit ?? 30;
    const file = loadFixtureFile("machinery");
    const records: IngestRecord[] = [];

    for (const p of file.products) {
      if (records.length >= limit) break;
      const sub = p.subcategorySlug ?? "";
      if (!PILOT_SUBCATS.has(sub)) continue;

      records.push({
        id: `mach-brand-${catalogSlug(p.brand)}`,
        categoryId: "machinery",
        kind: "brand",
        sourceMode: "OFFLINE_FIXTURE",
        payload: {
          brand: p.brand,
          subcategorySlug: sub,
          canonicalKey: `machinery|brand|${catalogSlug(p.brand)}`,
        },
        provenance: toProvenance(p.provenance),
      });

      records.push({
        id: p.id,
        categoryId: "machinery",
        kind: "model",
        sourceMode: "OFFLINE_FIXTURE",
        payload: {
          brand: p.brand,
          productFamily: p.productFamily,
          family: p.productFamily,
          model: p.model,
          machineType: p.machineType,
          subcategorySlug: sub,
          // Map to request-schema oriented keys
          power: p.specs?.powerKw != null ? `${p.specs.powerKw} kW` : undefined,
          powerKw: p.specs?.powerKw,
          capacity: p.specs?.capacity,
          voltage: p.specs?.voltage,
          phase: p.specs?.phase,
          specs: p.specs ?? {},
          canonicalKey: `machinery|model|${catalogSlug(p.brand)}|${catalogSlug(p.model)}`,
        },
        provenance: toProvenance(p.provenance),
      });
    }

    const seen = new Set<string>();
    const deduped = records.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    return {
      records: deduped,
      accessStatus: "AVAILABLE",
      fetchAttempts: 0,
      sourceFingerprint: `machinery-pilot:${deduped.length}`,
      notes: [
        "pilotSubcats=uretim-makinesi,kesim-makinesi,paketleme-makinesi",
        `records=${deduped.length}`,
      ],
    };
  },
};
