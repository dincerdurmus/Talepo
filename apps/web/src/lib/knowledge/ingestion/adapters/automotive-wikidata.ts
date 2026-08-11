/**
 * AutomotiveWikidataOrStructuredAdapter — optional structured discovery.
 * Brands/models as discovery/alias candidates only — cannot alone SAFE OEM/engines.
 */

import type { IngestRecord } from "../../types";
import { runWikidataSparql } from "../wikidata";
import type {
  AdapterDiscoverResult,
  SourceAdapter,
  SourceAdapterContext,
} from "../types";

const DEFAULT_LIMIT = 30;

function brandQuery(limit: number): string {
  return `
SELECT ?brand ?brandLabel WHERE {
  ?brand wdt:P31/wdt:P279* wd:Q3362856 .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,tr". }
}
LIMIT ${limit}
`.trim();
}

export const automotiveWikidataAdapter: SourceAdapter = {
  id: "automotive-wikidata",
  adapterId: "automotive-wikidata",
  sourceType: "MARKETPLACE",
  supportedDomains: ["automotive"],
  supportedCategories: ["automotive"],
  supportedCategoryIds: ["automotive"],
  supportedEntityTypes: ["brand", "model", "entity"],
  authorityLevel: "DISCOVERY_ONLY",
  discoveryCapability: "BRAND",
  structuredDataCapability: "STRUCTURED_API",
  rateLimitPolicy: {
    maxRequestsPerMinute: 10,
    timeoutMs: 12_000,
    minIntervalMs: 500,
  },
  licenseOrUsageNotes:
    "Wikidata CC0 structured data. Discovery/alias only — insufficient for SAFE critical OEM/engine.",
  supportsIncremental: true,
  supportsDetailFetch: false,
  async discover(ctx: SourceAdapterContext): Promise<AdapterDiscoverResult> {
    const limit = Math.min(ctx.limit ?? DEFAULT_LIMIT, 50);
    const sparql = await runWikidataSparql(brandQuery(limit), {
      allowNetwork: ctx.allowNetwork,
      timeoutMs: 12_000,
    });

    if (sparql.accessStatus !== "AVAILABLE") {
      return {
        records: [],
        accessStatus: sparql.accessStatus,
        fetchAttempts: sparql.fetchAttempts,
        errorMessage: sparql.errorMessage,
        notes: ["Wikidata unavailable — pipeline continues with other adapters."],
      };
    }

    const records: IngestRecord[] = [];
    for (const row of sparql.bindings) {
      const label = row.brandLabel?.value;
      const ref = row.brand?.value;
      if (!label || !ref) continue;
      records.push({
        id: `wd-auto-brand-${label.toLowerCase().replace(/\s+/g, "-").slice(0, 64)}`,
        categoryId: "automotive",
        kind: "brand",
        sourceMode: "LIVE",
        payload: {
          brand: label,
          wikidataIri: ref,
          discoveryOnly: true,
          canonicalKey: `automotive|wd|brand|${label.toLowerCase()}`,
          aliases: [label],
        },
        provenance: {
          sourceType: "MARKETPLACE",
          sourceName: "Wikidata SPARQL (automobile manufacturer)",
          sourceRef: ref,
          retrievedAt: new Date().toISOString(),
          confidence: "MEDIUM",
          verificationStatus: "discovery-candidate",
        },
      });
    }

    return {
      records,
      accessStatus: "AVAILABLE",
      fetchAttempts: sparql.fetchAttempts,
      sourceFingerprint: sparql.fingerprint,
      notes: [`wikidata brands=${records.length}`, "authority=DISCOVERY_ONLY"],
    };
  },
};
