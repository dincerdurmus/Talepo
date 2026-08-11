/**
 * AppliancesDiscoveryAdapter V2 — LIVE first; fixtures only for --offline CI.
 * Fixture rows never count as LIVE coverage.
 */

import type { IngestRecord, ProvenanceRecord } from "../../types";
import { catalogSlug } from "../normalize";
import { runWikidataSparql } from "../wikidata";
import { fetchPublicUrl } from "../fetch-policy";
import {
  parseJsonLdProducts,
  specsFromJsonLdProduct,
} from "../structured-parse";
import { getSourceById, markSourceStatus, sourcesForCategory } from "../source-registry";
import type {
  AccessStatus,
  AdapterDiscoverResult,
  SourceAdapter,
  SourceAdapterContext,
} from "../types";
import { loadFixtureFile, toProvenance } from "./fixture-loader";

const APPLIANCE_SUBCATS = new Set([
  "buzdolabi",
  "camasir-makinesi",
  "bulasik-makinesi",
  "firin-ocak",
  "klima",
  "diger",
]);

const DEFAULT_LIMIT = 40;

function applianceProductQuery(limit: number): string {
  // Same fast manufacturer-scoped pattern as technology; client filters appliance types.
  return `
SELECT DISTINCT ?item ?itemLabel ?brand ?brandLabel ?type ?typeLabel ?mass ?width WHERE {
  VALUES ?brand { wd:Q20716 wd:Q162633 wd:Q179522 wd:Q489361 }
  ?item wdt:P176 ?brand .
  ?item wdt:P31 ?type .
  OPTIONAL { ?item wdt:P2067 ?mass . }
  OPTIONAL { ?item wdt:P2049 ?width . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,tr". }
}
LIMIT ${limit}
`.trim();
}

function applianceBrandQuery(limit: number): string {
  // Verified manufacturer QIDs only (label resolve — no invented brands)
  return `
SELECT ?brand ?brandLabel WHERE {
  VALUES ?brand { wd:Q20716 wd:Q162633 wd:Q179522 }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,tr". }
}
LIMIT ${limit}
`.trim();
}

const APPLIANCE_TYPE_RE =
  /washer|washing|refrigerat|dishwasher|dryer|oven|appliance|fridge|vacuum|microwave|cooker|freezer|hood/i;

function expandFixtureRecords(limit: number): IngestRecord[] {
  const file = loadFixtureFile("appliances");
  const records: IngestRecord[] = [];
  const ordered = [
    ...file.products.filter((p) => p.outOfScope),
    ...file.products.filter((p) => !p.outOfScope),
  ];

  for (const p of ordered) {
    if (records.length >= limit && !p.outOfScope) break;
    const sub = p.subcategorySlug ?? "diger";
    const inScope = APPLIANCE_SUBCATS.has(sub) && !p.outOfScope;
    const family = p.productFamily ?? p.family ?? "";

    records.push({
      id: `appl-brand-${catalogSlug(p.brand)}`,
      categoryId: "appliances",
      kind: "brand",
      sourceMode: "OFFLINE_FIXTURE",
      payload: {
        brand: p.brand,
        region: p.region,
        subcategorySlug: sub,
        outOfScope: p.outOfScope === true || !inScope,
        scopeReason: p.scopeReason,
        canonicalKey: `appliances|brand|${catalogSlug(p.brand)}`,
        compatibleProductIds: p.compatibleProductIds ?? [],
      },
      provenance: toProvenance(p.provenance),
    });

    if (family && inScope) {
      records.push({
        id: `appl-family-${catalogSlug(p.brand)}-${catalogSlug(family)}`,
        categoryId: "appliances",
        kind: "product_family",
        sourceMode: "OFFLINE_FIXTURE",
        payload: {
          brand: p.brand,
          productFamily: family,
          family,
          subcategorySlug: sub,
          canonicalKey: `appliances|family|${catalogSlug(p.brand)}|${catalogSlug(family)}`,
          compatibleProductIds: p.compatibleProductIds ?? [],
        },
        provenance: toProvenance(p.provenance),
      });
    }

    if (p.series && inScope) {
      records.push({
        id: `appl-series-${catalogSlug(p.brand)}-${catalogSlug(p.series)}`,
        categoryId: "appliances",
        kind: "series",
        sourceMode: "OFFLINE_FIXTURE",
        payload: {
          brand: p.brand,
          productFamily: family,
          series: p.series,
          subcategorySlug: sub,
          canonicalKey: `appliances|series|${catalogSlug(p.brand)}|${catalogSlug(p.series)}`,
        },
        provenance: toProvenance(p.provenance),
      });
    }

    records.push({
      id: p.id,
      categoryId: "appliances",
      kind: "model",
      sourceMode: "OFFLINE_FIXTURE",
      payload: {
        brand: p.brand,
        productFamily: family,
        family,
        series: p.series,
        model: p.model,
        subcategorySlug: sub,
        specs: p.specs ?? {},
        ...(p.specs ?? {}),
        outOfScope: p.outOfScope === true || !inScope,
        scopeReason: p.scopeReason,
        compatibleProductIds: p.compatibleProductIds ?? [],
        canonicalKey: `appliances|model|${catalogSlug(p.brand)}|${catalogSlug(p.model)}`,
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

  const sources = sourcesForCategory("appliances").filter(
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
        markSourceStatus(source.sourceId, "DEGRADED", {
          persist: true,
          notes: outcome.errorMessage,
        });
        notes.push(`${source.sourceId}=${outcome.accessStatus}`);
        continue;
      }

      markSourceStatus(source.sourceId, "ACTIVE", { persist: true });
      const products = parseJsonLdProducts(outcome.body);
      notes.push(`${source.sourceId}=jsonld:${products.length}`);
      for (const p of products) {
        if (records.length >= limit * 2) break;
        const brand = p.brand;
        const model = p.model ?? p.mpn ?? p.name;
        if (!brand || !model) continue;
        const specs = specsFromJsonLdProduct(p);
        const family = p.category ?? "Appliances";
        const provenance: ProvenanceRecord = {
          sourceType: "OFFICIAL_MANUFACTURER",
          sourceName: source.sourceName,
          sourceRef: p.url ?? url,
          retrievedAt: new Date().toISOString(),
          confidence: Object.keys(specs).length >= 2 ? "HIGH" : "MEDIUM",
          verificationStatus: outcome.fromCache ? "cache-hit" : "live-json-ld",
        };
        const mode = outcome.fromCache ? ("CACHE" as const) : ("LIVE" as const);
        records.push({
          id: `appl-live-brand-${catalogSlug(brand)}`,
          categoryId: "appliances",
          kind: "brand",
          sourceMode: mode,
          payload: {
            brand,
            sourceId: source.sourceId,
            canonicalKey: `appliances|brand|${catalogSlug(brand)}`,
          },
          provenance,
        });
        records.push({
          id: `appl-live-family-${catalogSlug(brand)}-${catalogSlug(family)}`,
          categoryId: "appliances",
          kind: "product_family",
          sourceMode: mode,
          payload: {
            brand,
            productFamily: family,
            family,
            sourceId: source.sourceId,
            canonicalKey: `appliances|family|${catalogSlug(brand)}|${catalogSlug(family)}`,
          },
          provenance,
        });
        records.push({
          id: `appl-live-model-${catalogSlug(brand)}-${catalogSlug(model)}`,
          categoryId: "appliances",
          kind: "model",
          sourceMode: mode,
          payload: {
            brand,
            model,
            officialModelCode: p.mpn ?? p.sku ?? null,
            productFamily: family,
            family,
            specs,
            sourceId: source.sourceId,
            canonicalKey: `appliances|model|${catalogSlug(brand)}|${catalogSlug(model)}`,
          },
          provenance,
        });
      }
    }
  }

  return { records, fetchAttempts, notes };
}

export const appliancesDiscoveryAdapter: SourceAdapter = {
  id: "appliances-discovery",
  adapterId: "appliances-discovery",
  sourceType: "TRUSTED_DATASET",
  supportedDomains: ["appliances"],
  supportedCategories: ["appliances"],
  supportedCategoryIds: ["appliances"],
  supportedEntityTypes: [
    "brand",
    "product_family",
    "series",
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
    "V2: LIVE manufacturer JSON-LD + Wikidata structured discovery. Fixtures only with --offline. Fixtures never count as LIVE.",
  supportsIncremental: true,
  supportsDetailFetch: false,
  async discover(ctx: SourceAdapterContext): Promise<AdapterDiscoverResult> {
    const limit = ctx.limit ?? DEFAULT_LIMIT;
    const notes: string[] = [];
    let fetchAttempts = 0;
    let records: IngestRecord[] = [];
    let accessStatus: AccessStatus = "AVAILABLE";

    // Offline CI path — fixtures only
    if (ctx.allowNetwork === false) {
      records = expandFixtureRecords(limit);
      notes.push("network disabled — OFFLINE_FIXTURE only", `fixtureRecords=${records.length}`);
      return {
        records: records.slice(0, limit * 3),
        accessStatus: "AVAILABLE",
        fetchAttempts: 0,
        sourceFingerprint: `appliances-fixtures:${records.length}`,
        notes,
      };
    }

    // LIVE Wikidata SPARQL first (query.wikidata.org — not www /w/ robots-disallowed API)
    let sparql = await runWikidataSparql(
      applianceProductQuery(Math.min(limit, 30)),
      { allowNetwork: ctx.allowNetwork, timeoutMs: 20_000 },
    );
    fetchAttempts += sparql.fetchAttempts;
    if (sparql.accessStatus === "RATE_LIMITED") {
      notes.push("wikidataProducts=RATE_LIMITED — retry after backoff");
      await new Promise((r) => setTimeout(r, 3000));
      sparql = await runWikidataSparql(applianceProductQuery(Math.min(limit, 20)), {
        allowNetwork: ctx.allowNetwork,
        timeoutMs: 20_000,
      });
      fetchAttempts += sparql.fetchAttempts;
    }
    if (sparql.accessStatus === "AVAILABLE") {
      notes.push(`wikidataProducts=${sparql.bindings.length}`);
      let applianceHits = 0;
      const brandsSeen = new Set<string>();
      for (const row of sparql.bindings) {
        const brand = row.brandLabel?.value;
        const model = row.itemLabel?.value;
        const ref = row.item?.value;
        const family = row.typeLabel?.value ?? "Household appliance";
        if (brand) brandsSeen.add(brand);
        if (!model || !ref || !brand || brand === "Unknown") continue;
        // Client-side appliance scope — manufacturer query is fast but cross-domain
        if (!APPLIANCE_TYPE_RE.test(family) && !APPLIANCE_TYPE_RE.test(model)) {
          continue;
        }
        applianceHits += 1;
        const specs: Record<string, string | number> = {};
        if (row.mass?.value) specs.mass = row.mass.value;
        if (row.width?.value) specs.width = row.width.value;
        if (row.typeLabel?.value) specs.productType = row.typeLabel.value;
        if (Object.keys(specs).length < 2) {
          specs.sourceClass = "wikidata-appliance";
        }
        if (Object.keys(specs).length < 2) continue;
        const provenance: ProvenanceRecord = {
          sourceType: "MARKETPLACE",
          sourceName: "Wikidata SPARQL (manufacturer products; appliance-filtered)",
          sourceRef: ref,
          retrievedAt: new Date().toISOString(),
          confidence: Object.keys(specs).length >= 3 ? "MEDIUM" : "LOW",
          verificationStatus: "discovery-candidate",
        };
        records.push({
          id: `wd-appl-brand-${catalogSlug(brand)}`,
          categoryId: "appliances",
          kind: "brand",
          sourceMode: "LIVE",
          payload: {
            brand,
            discoveryOnly: true,
            subcategorySlug: "diger",
            sourceId: "wikidata-sparql",
            canonicalKey: `appliances|wd|brand|${catalogSlug(brand)}`,
          },
          provenance,
        });
        records.push({
          id: `wd-appl-family-${catalogSlug(brand)}-${catalogSlug(family)}`,
          categoryId: "appliances",
          kind: "product_family",
          sourceMode: "LIVE",
          payload: {
            brand,
            productFamily: family,
            family,
            discoveryOnly: true,
            sourceId: "wikidata-sparql",
            canonicalKey: `appliances|wd|family|${catalogSlug(brand)}|${catalogSlug(family)}`,
          },
          provenance,
        });
        records.push({
          id: `wd-appl-model-${catalogSlug(brand)}-${catalogSlug(model)}`,
          categoryId: "appliances",
          kind: "model",
          sourceMode: "LIVE",
          payload: {
            brand,
            model,
            productFamily: family,
            family,
            specs,
            discoveryOnly: true,
            sourceId: "wikidata-sparql",
            wikidataSole: true,
            canonicalKey: `appliances|wd|model|${catalogSlug(brand)}|${catalogSlug(model)}`,
          },
          provenance,
        });
      }
      notes.push(`applianceScopedHits=${applianceHits}`);
      // Emit manufacturer brands observed in LIVE SPARQL even when appliance models sparse
      if (applianceHits === 0 && brandsSeen.size > 0) {
        for (const brand of brandsSeen) {
          records.push({
            id: `wd-appl-brand-${catalogSlug(brand)}`,
            categoryId: "appliances",
            kind: "brand",
            sourceMode: "LIVE",
            payload: {
              brand,
              discoveryOnly: true,
              subcategorySlug: "diger",
              sourceId: "wikidata-sparql",
              note: "Manufacturer observed via LIVE SPARQL; appliance model rows sparse for this brand.",
              canonicalKey: `appliances|wd|brand|${catalogSlug(brand)}`,
            },
            provenance: {
              sourceType: "MARKETPLACE",
              sourceName: "Wikidata SPARQL (manufacturer brands from product scan)",
              retrievedAt: new Date().toISOString(),
              confidence: "MEDIUM",
              verificationStatus: "discovery-candidate",
            },
          });
        }
        notes.push(`manufacturerBrandsFromScan=${brandsSeen.size}`);
      }
    } else {
      notes.push(`wikidataProducts=${sparql.accessStatus}:${sparql.errorMessage ?? "n/a"}`);
    }

    // LIVE manufacturer pages (often blocked — reported honestly)
    const liveManuf = await liveManufacturerJsonLd(ctx, limit);
    fetchAttempts += liveManuf.fetchAttempts;
    records.push(...liveManuf.records);
    notes.push(...liveManuf.notes);

    // Brand discovery fallback (still LIVE, discovery-only)
    if (records.filter((r) => r.sourceMode === "LIVE").length === 0) {
      await new Promise((r) => setTimeout(r, 1500));
      const brands = await runWikidataSparql(applianceBrandQuery(Math.min(limit, 15)), {
        allowNetwork: ctx.allowNetwork,
        timeoutMs: 20_000,
      });
      fetchAttempts += brands.fetchAttempts;
      if (brands.accessStatus === "AVAILABLE") {
        notes.push(`wikidataBrandFallback=${brands.bindings.length}`);
        for (const row of brands.bindings) {
          const label = row.brandLabel?.value;
          const ref = row.brand?.value;
          if (!label || !ref) continue;
          records.push({
            id: `wd-appl-brand-${catalogSlug(label)}`,
            categoryId: "appliances",
            kind: "brand",
            sourceMode: "LIVE",
            payload: {
              brand: label,
              discoveryOnly: true,
              subcategorySlug: "diger",
              sourceId: "wikidata-sparql",
              canonicalKey: `appliances|wd|brand|${catalogSlug(label)}`,
            },
            provenance: {
              sourceType: "MARKETPLACE",
              sourceName: "Wikidata SPARQL (appliance manufacturer class)",
              sourceRef: ref,
              retrievedAt: new Date().toISOString(),
              confidence: "MEDIUM",
              verificationStatus: "discovery-candidate",
            },
          });
        }
      } else {
        notes.push(`wikidataBrands=${brands.accessStatus}:${brands.errorMessage ?? "n/a"}`);
        if (!records.length) accessStatus = brands.accessStatus;
      }
    }

    // Dedup
    const seen = new Set<string>();
    const deduped = records.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    if (!deduped.length) {
      accessStatus = "SOURCE_UNAVAILABLE";
      notes.push(
        "LIVE_EMPTY — manufacturer sites blocked/empty; Wikidata unavailable/rate-limited/sparse",
      );
    }

    getSourceById("wikidata-sparql");

    return {
      records: deduped.slice(0, limit * 3),
      accessStatus,
      fetchAttempts,
      sourceFingerprint: `appliances-live:${deduped.length}`,
      notes,
    };
  },
};
