/**
 * TechnologyDiscoveryAdapter V2 — LIVE first; fixtures only for --offline CI.
 * Variants as attributes (no SKU explosion). Fixtures never count as LIVE.
 */

import type { IngestRecord, ProvenanceRecord } from "../../types";
import { catalogSlug, normalizeStorageGb } from "../normalize";
import { runWikidataSparql } from "../wikidata";
import { fetchPublicUrl } from "../fetch-policy";
import {
  parseJsonLdProducts,
  specsFromJsonLdProduct,
} from "../structured-parse";
import { markSourceStatus, sourcesForCategory } from "../source-registry";
import type {
  AccessStatus,
  AdapterDiscoverResult,
  SourceAdapter,
  SourceAdapterContext,
} from "../types";
import { loadFixtureFile, toProvenance } from "./fixture-loader";

const DEFAULT_LIMIT = 40;

function techProductQuery(limit: number): string {
  // Manufacturer-scoped tech products (smartphone / computer / TV-ish types)
  return `
SELECT DISTINCT ?item ?itemLabel ?brand ?brandLabel ?type ?typeLabel ?mass ?width WHERE {
  VALUES ?brand { wd:Q312 wd:Q20716 wd:Q489361 wd:Q95 wd:Q388 }
  ?item wdt:P176 ?brand .
  ?item wdt:P31 ?type .
  ?type rdfs:label ?typeLabel .
  FILTER(LANG(?typeLabel) = "en")
  FILTER(REGEX(?typeLabel, "phone|smartphone|laptop|computer|television|TV|tablet", "i"))
  OPTIONAL { ?item wdt:P2067 ?mass . }
  OPTIONAL { ?item wdt:P2049 ?width . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,tr". }
}
LIMIT ${limit}
`.trim();
}

function expandFixtureRecords(limit: number): IngestRecord[] {
  const file = loadFixtureFile("technology");
  const records: IngestRecord[] = [];

  for (const p of file.products) {
    if (records.length >= limit * 4) break;
    const sub = p.subcategorySlug ?? "donanim";
    const hardwareOk = sub === "donanim" && !p.outOfScope;
    const family = p.productFamily ?? p.family ?? "";

    records.push({
      id: `tech-brand-${catalogSlug(p.brand)}`,
      categoryId: "technology",
      kind: "brand",
      sourceMode: "OFFLINE_FIXTURE",
      payload: {
        brand: p.brand,
        subcategorySlug: sub,
        outOfScope: !hardwareOk,
        scopeReason: p.scopeReason,
        canonicalKey: `technology|brand|${catalogSlug(p.brand)}`,
      },
      provenance: toProvenance(p.provenance),
    });

    if (family && hardwareOk) {
      records.push({
        id: `tech-family-${catalogSlug(p.brand)}-${catalogSlug(family)}`,
        categoryId: "technology",
        kind: "product_family",
        sourceMode: "OFFLINE_FIXTURE",
        payload: {
          brand: p.brand,
          productFamily: family,
          family,
          kind: p.kind,
          subcategorySlug: sub,
          canonicalKey: `technology|family|${catalogSlug(p.brand)}|${catalogSlug(family)}`,
        },
        provenance: toProvenance(p.provenance),
      });
    }

    const storageOptions = Array.isArray(p.variantAttributes?.storageOptions)
      ? (p.variantAttributes!.storageOptions as string[]).map(
          (s) => normalizeStorageGb(s) ?? s,
        )
      : undefined;

    records.push({
      id: p.id,
      categoryId: "technology",
      kind: "model",
      sourceMode: "OFFLINE_FIXTURE",
      payload: {
        brand: p.brand,
        productFamily: family,
        family,
        series: p.series,
        model: p.model,
        kind: p.kind,
        subcategorySlug: sub,
        specs: p.specs ?? {},
        variantAttributes: {
          ...(p.variantAttributes ?? {}),
          storageOptions,
        },
        variantExplosion: false,
        emitSeparateSkuPerVariant: false,
        outOfScope: !hardwareOk,
        scopeReason: p.scopeReason,
        canonicalKey: `technology|model|${catalogSlug(p.brand)}|${catalogSlug(p.model)}`,
      },
      provenance: toProvenance(p.provenance),
    });
  }

  const seen = new Set<string>();
  return records.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}

async function liveManufacturerJsonLd(
  ctx: SourceAdapterContext,
  limit: number,
): Promise<{ records: IngestRecord[]; fetchAttempts: number; notes: string[] }> {
  const notes: string[] = [];
  const records: IngestRecord[] = [];
  let fetchAttempts = 0;

  const sources = sourcesForCategory("technology").filter(
    (s) => s.accessMode === "PUBLIC_HTTP" && s.seedUrls?.length,
  );

  for (const source of sources.slice(0, 4)) {
    if (records.length >= limit * 2) break;
    for (const url of (source.seedUrls ?? []).slice(0, 1)) {
      const outcome = await fetchPublicUrl({
        sourceId: source.sourceId,
        url,
        allowNetwork: ctx.allowNetwork,
        policy: source.rateLimitPolicy,
        robotsUrl: source.robotsUrl,
      });
      fetchAttempts += outcome.fetchAttempts;
      if (outcome.accessStatus === "ACCESS_BLOCKED") {
        markSourceStatus(source.sourceId, "ACCESS_BLOCKED", {
          persist: true,
          notes: outcome.errorMessage,
        });
        notes.push(`${source.sourceId}=ACCESS_BLOCKED`);
        continue;
      }
      if (outcome.accessStatus !== "AVAILABLE" || !outcome.body) {
        notes.push(`${source.sourceId}=${outcome.accessStatus}`);
        continue;
      }
      markSourceStatus(source.sourceId, "ACTIVE", { persist: true });
      const products = parseJsonLdProducts(outcome.body);
      notes.push(`${source.sourceId}=jsonld:${products.length}`);
      for (const p of products) {
        if (records.length >= limit * 2) break;
        const brand = p.brand;
        const model = p.model ?? p.name;
        if (!brand || !model) continue;
        const specs = specsFromJsonLdProduct(p);
        const family = p.category ?? "Hardware";
        const provenance: ProvenanceRecord = {
          sourceType: "OFFICIAL_MANUFACTURER",
          sourceName: source.sourceName,
          sourceRef: p.url ?? url,
          retrievedAt: new Date().toISOString(),
          confidence: "MEDIUM",
          verificationStatus: outcome.fromCache ? "cache-hit" : "live-json-ld",
        };
        const mode = outcome.fromCache ? ("CACHE" as const) : ("LIVE" as const);
        records.push({
          id: `tech-live-brand-${catalogSlug(brand)}`,
          categoryId: "technology",
          kind: "brand",
          sourceMode: mode,
          payload: {
            brand,
            subcategorySlug: "donanim",
            sourceId: source.sourceId,
            canonicalKey: `technology|brand|${catalogSlug(brand)}`,
          },
          provenance,
        });
        records.push({
          id: `tech-live-family-${catalogSlug(brand)}-${catalogSlug(family)}`,
          categoryId: "technology",
          kind: "product_family",
          sourceMode: mode,
          payload: {
            brand,
            productFamily: family,
            family,
            subcategorySlug: "donanim",
            sourceId: source.sourceId,
            canonicalKey: `technology|family|${catalogSlug(brand)}|${catalogSlug(family)}`,
          },
          provenance,
        });
        records.push({
          id: `tech-live-model-${catalogSlug(brand)}-${catalogSlug(model)}`,
          categoryId: "technology",
          kind: "model",
          sourceMode: mode,
          payload: {
            brand,
            model,
            productFamily: family,
            family,
            subcategorySlug: "donanim",
            specs,
            variantAttributes: {},
            variantExplosion: false,
            emitSeparateSkuPerVariant: false,
            sourceId: source.sourceId,
            canonicalKey: `technology|model|${catalogSlug(brand)}|${catalogSlug(model)}`,
          },
          provenance,
        });
      }
    }
  }
  return { records, fetchAttempts, notes };
}

export const technologyDiscoveryAdapter: SourceAdapter = {
  id: "technology-discovery",
  adapterId: "technology-discovery",
  sourceType: "TRUSTED_DATASET",
  supportedDomains: ["technology"],
  supportedCategories: ["technology"],
  supportedCategoryIds: ["technology"],
  supportedEntityTypes: [
    "brand",
    "product_family",
    "model",
    "variant",
    "entity",
    "spec",
  ],
  authorityLevel: "TRUSTED_DATASET",
  discoveryCapability: "FULL_GRAPH",
  structuredDataCapability: "STRUCTURED_API",
  rateLimitPolicy: { timeoutMs: 12_000, maxRequestsPerMinute: 10 },
  licenseOrUsageNotes:
    "V2: LIVE manufacturer JSON-LD + Wikidata. Fixtures only with --offline. No SKU explosion.",
  supportsIncremental: true,
  supportsDetailFetch: false,
  async discover(ctx: SourceAdapterContext): Promise<AdapterDiscoverResult> {
    const limit = ctx.limit ?? DEFAULT_LIMIT;
    const notes: string[] = ["variantMode=attributes-on-model"];
    let fetchAttempts = 0;
    let records: IngestRecord[] = [];
    let accessStatus: AccessStatus = "AVAILABLE";

    if (ctx.allowNetwork === false) {
      records = expandFixtureRecords(limit);
      notes.push("network disabled — OFFLINE_FIXTURE only", `fixtureRecords=${records.length}`);
      return {
        records,
        accessStatus: "AVAILABLE",
        fetchAttempts: 0,
        sourceFingerprint: `technology-fixtures:${records.length}`,
        notes,
      };
    }

    const liveManuf = await liveManufacturerJsonLd(ctx, limit);
    fetchAttempts += liveManuf.fetchAttempts;
    records.push(...liveManuf.records);
    notes.push(...liveManuf.notes);

    const sparql = await runWikidataSparql(techProductQuery(Math.min(limit, 30)), {
      allowNetwork: ctx.allowNetwork,
      timeoutMs: 20_000,
    });
    fetchAttempts += sparql.fetchAttempts;
    if (sparql.accessStatus === "AVAILABLE") {
      notes.push(`wikidataProducts=${sparql.bindings.length}`);
      for (const row of sparql.bindings) {
        const brand = row.brandLabel?.value;
        const model = row.itemLabel?.value;
        const ref = row.item?.value;
        const family = row.typeLabel?.value ?? "Hardware";
        if (!brand || !model || !ref) continue;
        const specs: Record<string, string | number> = {};
        if (row.mass?.value) specs.mass = row.mass.value;
        if (row.width?.value) specs.width = row.width.value;
        if (row.typeLabel?.value) specs.productType = row.typeLabel.value;
        if (Object.keys(specs).length < 2) continue;
        const provenance: ProvenanceRecord = {
          sourceType: "MARKETPLACE",
          sourceName: "Wikidata SPARQL (phone/computer/TV manufacturer products)",
          sourceRef: ref,
          retrievedAt: new Date().toISOString(),
          confidence: "MEDIUM",
          verificationStatus: "discovery-candidate",
        };
        records.push({
          id: `wd-tech-brand-${catalogSlug(brand)}`,
          categoryId: "technology",
          kind: "brand",
          sourceMode: "LIVE",
          payload: {
            brand,
            discoveryOnly: true,
            subcategorySlug: "donanim",
            sourceId: "wikidata-sparql",
            canonicalKey: `technology|wd|brand|${catalogSlug(brand)}`,
          },
          provenance,
        });
        records.push({
          id: `wd-tech-family-${catalogSlug(brand)}-${catalogSlug(family)}`,
          categoryId: "technology",
          kind: "product_family",
          sourceMode: "LIVE",
          payload: {
            brand,
            productFamily: family,
            family,
            subcategorySlug: "donanim",
            discoveryOnly: true,
            sourceId: "wikidata-sparql",
            canonicalKey: `technology|wd|family|${catalogSlug(brand)}|${catalogSlug(family)}`,
          },
          provenance,
        });
        records.push({
          id: `wd-tech-model-${catalogSlug(brand)}-${catalogSlug(model)}`,
          categoryId: "technology",
          kind: "model",
          sourceMode: "LIVE",
          payload: {
            brand,
            model,
            productFamily: family,
            family,
            subcategorySlug: "donanim",
            specs,
            variantAttributes: {},
            variantExplosion: false,
            emitSeparateSkuPerVariant: false,
            discoveryOnly: true,
            sourceId: "wikidata-sparql",
            wikidataSole: true,
            canonicalKey: `technology|wd|model|${catalogSlug(brand)}|${catalogSlug(model)}`,
          },
          provenance,
        });
      }
    } else {
      notes.push(`wikidata=${sparql.accessStatus}:${sparql.errorMessage ?? "n/a"}`);
      if (!records.length) accessStatus = sparql.accessStatus;
    }

    const seen = new Set<string>();
    const deduped = records.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    if (!deduped.length) {
      accessStatus = "SOURCE_UNAVAILABLE";
      notes.push("LIVE_EMPTY");
    }

    return {
      records: deduped.slice(0, limit * 3),
      accessStatus,
      fetchAttempts,
      sourceFingerprint: `technology-live:${deduped.length}`,
      notes,
    };
  },
};
