/**
 * Generic structured discovery adapter — tries public structured surfaces in order:
 * official JSON/API/feed → JSON-LD Product → sitemap/index → embedded JSON →
 * category/model index → conservative spec tables → detail fields.
 * Manufacturer-specific parsers belong in isolated modules when generic fails.
 */

import type { IngestRecord, ProvenanceRecord } from "../../types";
import { catalogSlug } from "../normalize";
import { fetchPublicUrl } from "../fetch-policy";
import { getSourceById, sourcesForCategory } from "../source-registry";
import {
  extractEmbeddedJsonBlobs,
  extractSitemapLocs,
  extractSpecTablePairs,
  parseJsonLdProducts,
  specsFromJsonLdProduct,
} from "../structured-parse";
import type {
  AccessStatus,
  AdapterDiscoverResult,
  DiscoveryMode,
  SourceAdapter,
  SourceAdapterContext,
} from "../types";

const DEFAULT_LIMIT = 20;

function tagLive(
  record: Omit<IngestRecord, "sourceMode">,
  fromCache: boolean,
): IngestRecord {
  return {
    ...record,
    sourceMode: fromCache ? "CACHE" : "LIVE",
  };
}

function productToRecords(
  categoryId: string,
  product: ReturnType<typeof parseJsonLdProducts>[number],
  provenance: ProvenanceRecord,
  sourceId: string,
  fromCache: boolean,
): IngestRecord[] {
  const brand = product.brand ?? "Unknown";
  const model =
    product.model ??
    product.mpn ??
    product.name ??
    null;
  if (!model || brand === "Unknown") return [];

  const specs = specsFromJsonLdProduct(product);
  const family = product.category ?? undefined;
  const records: IngestRecord[] = [];

  records.push(
    tagLive(
      {
        id: `gen-brand-${catalogSlug(brand)}`,
        categoryId,
        kind: "brand",
        payload: {
          brand,
          sourceId,
          canonicalKey: `${categoryId}|brand|${catalogSlug(brand)}`,
        },
        provenance,
      },
      fromCache,
    ),
  );

  if (family) {
    records.push(
      tagLive(
        {
          id: `gen-family-${catalogSlug(brand)}-${catalogSlug(family)}`,
          categoryId,
          kind: "product_family",
          payload: {
            brand,
            productFamily: family,
            family,
            sourceId,
            canonicalKey: `${categoryId}|family|${catalogSlug(brand)}|${catalogSlug(family)}`,
          },
          provenance,
        },
        fromCache,
      ),
    );
  }

  records.push(
    tagLive(
      {
        id: `gen-model-${catalogSlug(brand)}-${catalogSlug(model)}`,
        categoryId,
        kind: "model",
        payload: {
          brand,
          model,
          productFamily: family,
          family,
          officialModelCode: product.mpn ?? product.sku ?? null,
          specs,
          sourceId,
          structuredVia: "json-ld",
          canonicalKey: `${categoryId}|model|${catalogSlug(brand)}|${catalogSlug(model)}`,
        },
        provenance,
      },
      fromCache,
    ),
  );

  return records;
}

async function discoverFromUrl(
  ctx: SourceAdapterContext,
  sourceId: string,
  url: string,
  robotsUrl: string | undefined,
  discoveryMode: DiscoveryMode,
  limit: number,
): Promise<{
  records: IngestRecord[];
  accessStatus: AccessStatus;
  fetchAttempts: number;
  notes: string[];
  fromCache: boolean;
}> {
  const entry = getSourceById(sourceId);
  const notes: string[] = [];
  const records: IngestRecord[] = [];
  let fetchAttempts = 0;
  let fromCache = false;

  const outcome = await fetchPublicUrl({
    sourceId,
    url,
    allowNetwork: ctx.allowNetwork,
    policy: entry?.rateLimitPolicy,
    robotsUrl,
    discoveryMode,
    useCache: true,
    ttlSeconds: discoveryMode === "INCREMENTAL" ? 7200 : 3600,
  });
  fetchAttempts += outcome.fetchAttempts;
  fromCache = outcome.fromCache;

  if (outcome.accessStatus !== "AVAILABLE" || !outcome.body) {
    notes.push(`${url} → ${outcome.accessStatus}:${outcome.errorMessage ?? ""}`);
    return {
      records,
      accessStatus: outcome.accessStatus,
      fetchAttempts,
      notes,
      fromCache,
    };
  }

  const provenance: ProvenanceRecord = {
    sourceType: "OFFICIAL_MANUFACTURER",
    sourceName: entry?.sourceName ?? sourceId,
    sourceRef: url,
    retrievedAt: new Date().toISOString(),
    confidence: "MEDIUM",
    verificationStatus: fromCache ? "cache-hit" : "live-structured",
  };

  // 1) Official JSON / feed
  const ct = (outcome.contentType ?? "").toLowerCase();
  if (ct.includes("application/json") || outcome.body.trim().startsWith("{")) {
    try {
      const json = JSON.parse(outcome.body) as unknown;
      notes.push("parsed=application/json");
      // Conservative: only accept arrays of objects with name/brand/model
      const arr = Array.isArray(json)
        ? json
        : json && typeof json === "object" && Array.isArray((json as { products?: unknown }).products)
          ? ((json as { products: unknown[] }).products)
          : [];
      for (const row of arr) {
        if (records.length >= limit) break;
        if (!row || typeof row !== "object") continue;
        const r = row as Record<string, unknown>;
        const brand = typeof r.brand === "string" ? r.brand : undefined;
        const model = typeof r.model === "string" ? r.model : typeof r.name === "string" ? r.name : undefined;
        if (!brand || !model) continue;
        records.push(
          ...productToRecords(
            ctx.categoryId,
            {
              name: typeof r.name === "string" ? r.name : model,
              brand,
              model,
              mpn: typeof r.mpn === "string" ? r.mpn : undefined,
              category: typeof r.category === "string" ? r.category : undefined,
              additionalProperty: undefined,
              raw: r,
            },
            provenance,
            sourceId,
            fromCache,
          ),
        );
      }
      if (records.length) {
        return { records, accessStatus: "AVAILABLE", fetchAttempts, notes, fromCache };
      }
    } catch {
      notes.push("json-parse-failed");
    }
  }

  // 2) JSON-LD Product
  const products = parseJsonLdProducts(outcome.body);
  if (products.length) {
    notes.push(`jsonldProducts=${products.length}`);
    for (const p of products) {
      if (records.length >= limit) break;
      records.push(
        ...productToRecords(ctx.categoryId, p, provenance, sourceId, fromCache),
      );
    }
    if (records.length) {
      return { records, accessStatus: "AVAILABLE", fetchAttempts, notes, fromCache };
    }
  }

  // 3) Sitemap / product index
  if (
    /<urlset|<sitemapindex/i.test(outcome.body) ||
    url.toLowerCase().includes("sitemap")
  ) {
    const locs = extractSitemapLocs(outcome.body, Math.min(limit, 15));
    notes.push(`sitemapLocs=${locs.length}`);
    if (!locs.length) {
      notes.push("sitemap-empty-or-blocked");
    }
    for (const loc of locs.slice(0, Math.min(5, limit))) {
      if (records.length >= limit) break;
      const child = await fetchPublicUrl({
        sourceId,
        url: loc,
        allowNetwork: ctx.allowNetwork,
        policy: entry?.rateLimitPolicy,
        robotsUrl,
        discoveryMode: "DETAIL_REFRESH",
        useCache: true,
      });
      fetchAttempts += child.fetchAttempts;
      if (child.accessStatus === "ACCESS_BLOCKED") {
        notes.push(`child ACCESS_BLOCKED ${loc}`);
        continue;
      }
      if (child.accessStatus !== "AVAILABLE" || !child.body) continue;
      const childProducts = parseJsonLdProducts(child.body);
      for (const p of childProducts) {
        if (records.length >= limit) break;
        records.push(
          ...productToRecords(
            ctx.categoryId,
            p,
            {
              ...provenance,
              sourceRef: loc,
              verificationStatus: child.fromCache ? "cache-hit" : "live-structured",
            },
            sourceId,
            child.fromCache,
          ),
        );
      }
    }
    if (records.length) {
      return { records, accessStatus: "AVAILABLE", fetchAttempts, notes, fromCache };
    }
  }

  // 4) Embedded structured JSON
  const blobs = extractEmbeddedJsonBlobs(outcome.body, 3);
  if (blobs.length) {
    notes.push(`embeddedJson=${blobs.length}`);
    for (const blob of blobs) {
      const text = JSON.stringify(blob);
      const embeddedProducts = parseJsonLdProducts(text);
      for (const p of embeddedProducts) {
        if (records.length >= limit) break;
        records.push(
          ...productToRecords(ctx.categoryId, p, provenance, sourceId, fromCache),
        );
      }
    }
    if (records.length) {
      return { records, accessStatus: "AVAILABLE", fetchAttempts, notes, fromCache };
    }
  }

  // 5–7) Spec tables on detail-like pages (conservative)
  const pairs = extractSpecTablePairs(outcome.body, 12);
  if (pairs.length >= 2) {
    notes.push(`specTablePairs=${pairs.length}`);
    // Only emit a model if title-like product name is present — do not invent brand/model
    const titleMatch = outcome.body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const title = titleMatch
      ? titleMatch[1]!.replace(/<[^>]+>/g, "").trim()
      : "";
    if (title && entry?.sourceName) {
      const brandGuess =
        entry.sourceName.split(/\s+/)[0] &&
        !/generic|public|talepo/i.test(entry.sourceName.split(/\s+/)[0]!)
          ? entry.domain === "appliances" || entry.domain === "technology"
            ? entry.sourceId.includes("bosch")
              ? "Bosch"
              : entry.sourceId.includes("samsung")
                ? "Samsung"
                : entry.sourceId.includes("arcelik")
                  ? "Arçelik"
                  : entry.sourceId.includes("beko")
                    ? "Beko"
                    : entry.sourceId.includes("apple")
                      ? "Apple"
                      : entry.sourceId.includes("lg")
                        ? "LG"
                        : null
            : null
          : null;
      if (brandGuess) {
        const specs: Record<string, string> = {};
        for (const p of pairs) specs[p.name] = p.value;
        records.push(
          tagLive(
            {
              id: `gen-spec-${catalogSlug(brandGuess)}-${catalogSlug(title)}`,
              categoryId: ctx.categoryId,
              kind: "model",
              payload: {
                brand: brandGuess,
                model: title,
                specs,
                sourceId,
                structuredVia: "spec-table",
                canonicalKey: `${ctx.categoryId}|model|${catalogSlug(brandGuess)}|${catalogSlug(title)}`,
              },
              provenance: {
                ...provenance,
                confidence: "LOW",
                verificationStatus: "spec-table-candidate",
              },
            },
            fromCache,
          ),
        );
      } else {
        notes.push("spec-table-skipped-no-verified-brand");
      }
    }
  }

  if (!records.length) {
    notes.push("no-structured-product-extracted");
  }

  return {
    records,
    accessStatus: "AVAILABLE",
    fetchAttempts,
    notes,
    fromCache,
  };
}

export const genericStructuredDiscoveryAdapter: SourceAdapter = {
  id: "generic-structured-discovery",
  adapterId: "generic-structured-discovery",
  sourceType: "OFFICIAL_MANUFACTURER",
  supportedDomains: ["automotive", "appliances", "technology", "machinery"],
  supportedCategories: ["automotive", "appliances", "technology", "machinery"],
  supportedCategoryIds: ["automotive", "appliances", "technology", "machinery"],
  supportedEntityTypes: ["brand", "product_family", "model", "entity", "spec"],
  authorityLevel: "OFFICIAL",
  discoveryCapability: "FULL_GRAPH",
  structuredDataCapability: "STRUCTURED_API",
  rateLimitPolicy: { timeoutMs: 10_000, maxRequestsPerMinute: 6, minIntervalMs: 1000 },
  licenseOrUsageNotes:
    "Generic public structured discovery only. Respects robots.txt. No captcha/login bypass.",
  supportsIncremental: true,
  supportsDetailFetch: true,
  async discover(ctx: SourceAdapterContext): Promise<AdapterDiscoverResult> {
    const limit = ctx.limit ?? DEFAULT_LIMIT;
    const discoveryMode: DiscoveryMode =
      ctx.allowNetwork === false ? "FULL_DISCOVERY" : "FULL_DISCOVERY";
    const notes: string[] = [`discoveryMode=${discoveryMode}`];
    const records: IngestRecord[] = [];
    let fetchAttempts = 0;
    let anyAvailable = false;
    let anyBlocked = false;
    let anyFailed = false;

    if (ctx.allowNetwork === false) {
      return {
        records: [],
        accessStatus: "SOURCE_UNAVAILABLE",
        fetchAttempts: 0,
        notes: ["network disabled — generic structured adapter idle"],
      };
    }

    const sources = sourcesForCategory(ctx.categoryId).filter(
      (s) =>
        s.enabled &&
        s.accessMode === "PUBLIC_HTTP" &&
        Array.isArray(s.seedUrls) &&
        s.seedUrls.length > 0 &&
        s.sourceId !== "generic-structured-http",
    );

    const capped = sources.slice(0, 6);
    for (const source of capped) {
      if (records.length >= limit * 3) break;
      for (const url of (source.seedUrls ?? []).slice(0, 2)) {
        if (records.length >= limit * 3) break;
        const result = await discoverFromUrl(
          ctx,
          source.sourceId,
          url,
          source.robotsUrl,
          discoveryMode,
          limit,
        );
        fetchAttempts += result.fetchAttempts;
        notes.push(...result.notes.map((n) => `${source.sourceId}:${n}`));
        if (result.accessStatus === "AVAILABLE") anyAvailable = true;
        if (result.accessStatus === "ACCESS_BLOCKED") anyBlocked = true;
        if (
          result.accessStatus === "FAILED" ||
          result.accessStatus === "SOURCE_UNAVAILABLE"
        ) {
          anyFailed = true;
        }
        records.push(...result.records);
      }
    }

    // Dedup by id
    const seen = new Set<string>();
    const deduped = records.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    let accessStatus: AccessStatus = "SOURCE_UNAVAILABLE";
    if (deduped.length > 0 || anyAvailable) accessStatus = "AVAILABLE";
    else if (anyBlocked) accessStatus = "ACCESS_BLOCKED";
    else if (anyFailed) accessStatus = "SOURCE_UNAVAILABLE";

    notes.push(`sourcesTried=${capped.length}`, `records=${deduped.length}`);

    return {
      records: deduped.slice(0, limit * 3),
      accessStatus,
      fetchAttempts,
      notes,
      sourceFingerprint: `generic-structured:${ctx.categoryId}:${deduped.length}`,
    };
  },
};
