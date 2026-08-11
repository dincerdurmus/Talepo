/**
 * Source Discovery Registry — metadata only (no credentials/secrets).
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import type { AuthorityLevel, RateLimitPolicy } from "./types";

export type SourceRegistryAccessMode =
  | "PUBLIC_HTTP"
  | "PUBLIC_API"
  | "PUBLIC_FEED"
  | "SPARQL"
  | "OFFLINE_FIXTURE"
  | "INTERNAL_AUDIT";

export type SourceRegistryStatus =
  | "ACTIVE"
  | "DEGRADED"
  | "ACCESS_BLOCKED"
  | "DISABLED"
  | "UNKNOWN";

export type SourceRegistryEntry = {
  sourceId: string;
  sourceName: string;
  sourceType: string;
  domain: string;
  supportedCategories: string[];
  baseUrl?: string;
  endpoint?: string;
  accessMode: SourceRegistryAccessMode;
  structuredDataTypes: string[];
  authorityLevel: AuthorityLevel;
  coverageEstimate: string;
  rateLimitPolicy: RateLimitPolicy;
  enabled: boolean;
  lastCheckedAt?: string | null;
  status: SourceRegistryStatus;
  notes?: string;
  /** Optional seed URLs for generic structured discovery (product index / detail). */
  seedUrls?: string[];
  robotsUrl?: string;
};

function registryRoots(): string[] {
  const cwd = process.cwd();
  return [
    path.resolve(cwd, "../../data/catalog-ingestion/sources"),
    path.resolve(cwd, "../data/catalog-ingestion/sources"),
    path.resolve(cwd, "data/catalog-ingestion/sources"),
    path.resolve(cwd, "../../../data/catalog-ingestion/sources"),
  ];
}

function resolveRegistryDir(): string | null {
  for (const root of registryRoots()) {
    if (existsSync(root)) return root;
  }
  return null;
}

/** Built-in registry used when JSON files are missing (dev bootstrap). */
export const BUILTIN_SOURCE_REGISTRY: SourceRegistryEntry[] = [
  {
    sourceId: "wikidata-sparql",
    sourceName: "Wikidata SPARQL",
    sourceType: "STRUCTURED_DATASET",
    domain: "multi",
    supportedCategories: ["automotive", "appliances", "technology"],
    baseUrl: "https://query.wikidata.org/sparql",
    endpoint: "https://query.wikidata.org/sparql",
    accessMode: "SPARQL",
    structuredDataTypes: ["sparql-json", "wikibase"],
    authorityLevel: "DISCOVERY_ONLY",
    coverageEstimate: "Broad brand/model discovery; not sole SAFE for OEM critical.",
    rateLimitPolicy: { timeoutMs: 12_000, maxRequestsPerMinute: 10, minIntervalMs: 500 },
    enabled: true,
    lastCheckedAt: null,
    status: "UNKNOWN",
    notes: "CC0. Discovery/alias only for engines/transmissions/appliance SAFE.",
  },
  {
    sourceId: "generic-structured-http",
    sourceName: "Generic structured HTTP discovery",
    sourceType: "STRUCTURED_HTTP",
    domain: "multi",
    supportedCategories: ["automotive", "appliances", "technology", "machinery"],
    accessMode: "PUBLIC_HTTP",
    structuredDataTypes: [
      "application/json",
      "json-ld",
      "sitemap",
      "embedded-json",
      "html-spec-table",
    ],
    authorityLevel: "OFFICIAL",
    coverageEstimate: "Depends on manufacturer public pages; often partial.",
    rateLimitPolicy: { timeoutMs: 10_000, maxRequestsPerMinute: 6, minIntervalMs: 1000 },
    enabled: true,
    lastCheckedAt: null,
    status: "UNKNOWN",
    notes: "Tries JSON/API → JSON-LD → sitemap → embedded JSON → category index → spec tables.",
  },
  {
    sourceId: "appliances-bosch-home",
    sourceName: "Bosch Home (EU) public product pages",
    sourceType: "MANUFACTURER",
    domain: "appliances",
    supportedCategories: ["appliances"],
    baseUrl: "https://www.bosch-home.com",
    accessMode: "PUBLIC_HTTP",
    structuredDataTypes: ["json-ld", "html"],
    authorityLevel: "OFFICIAL",
    coverageEstimate: "EU appliance catalog; bot access often blocked.",
    rateLimitPolicy: { timeoutMs: 10_000, maxRequestsPerMinute: 4, minIntervalMs: 1500 },
    enabled: true,
    lastCheckedAt: null,
    status: "UNKNOWN",
    seedUrls: [
      "https://www.bosch-home.com/us/products/washers-and-dryers/",
      "https://www.bosch-home.com/us/product/WGA244A0UC",
    ],
    robotsUrl: "https://www.bosch-home.com/robots.txt",
    notes: "EU/global brand. Prefer JSON-LD Product if accessible.",
  },
  {
    sourceId: "appliances-samsung",
    sourceName: "Samsung Home Appliances public pages",
    sourceType: "MANUFACTURER",
    domain: "appliances",
    supportedCategories: ["appliances"],
    baseUrl: "https://www.samsung.com",
    accessMode: "PUBLIC_HTTP",
    structuredDataTypes: ["json-ld", "html"],
    authorityLevel: "OFFICIAL",
    coverageEstimate: "Global appliances; frequently ACCESS_BLOCKED for automated clients.",
    rateLimitPolicy: { timeoutMs: 10_000, maxRequestsPerMinute: 4, minIntervalMs: 1500 },
    enabled: true,
    lastCheckedAt: null,
    status: "UNKNOWN",
    seedUrls: [
      "https://www.samsung.com/us/home-appliances/refrigerators/",
      "https://www.samsung.com/us/washers-and-dryers/washers/",
    ],
    robotsUrl: "https://www.samsung.com/robots.txt",
    notes: "Asian/global brand for §29 acceptance mix.",
  },
  {
    sourceId: "appliances-arcelik",
    sourceName: "Arçelik public TR catalog",
    sourceType: "MANUFACTURER",
    domain: "appliances",
    supportedCategories: ["appliances"],
    baseUrl: "https://www.arcelik.com.tr",
    accessMode: "PUBLIC_HTTP",
    structuredDataTypes: ["json-ld", "html"],
    authorityLevel: "OFFICIAL",
    coverageEstimate: "TR market appliances; may require region/cookies.",
    rateLimitPolicy: { timeoutMs: 10_000, maxRequestsPerMinute: 4, minIntervalMs: 1500 },
    enabled: true,
    lastCheckedAt: null,
    status: "UNKNOWN",
    seedUrls: [
      "https://www.arcelik.com.tr/buzdolabi",
      "https://www.arcelik.com.tr/camasir-makinesi",
    ],
    robotsUrl: "https://www.arcelik.com.tr/robots.txt",
    notes: "TR manufacturer for §29 mix.",
  },
  {
    sourceId: "appliances-beko",
    sourceName: "Beko public TR/EU catalog",
    sourceType: "MANUFACTURER",
    domain: "appliances",
    supportedCategories: ["appliances"],
    baseUrl: "https://www.beko.com.tr",
    accessMode: "PUBLIC_HTTP",
    structuredDataTypes: ["json-ld", "html"],
    authorityLevel: "OFFICIAL",
    coverageEstimate: "TR/EU appliances.",
    rateLimitPolicy: { timeoutMs: 10_000, maxRequestsPerMinute: 4, minIntervalMs: 1500 },
    enabled: true,
    lastCheckedAt: null,
    status: "UNKNOWN",
    seedUrls: ["https://www.beko.com.tr/camasir-makineleri"],
    robotsUrl: "https://www.beko.com.tr/robots.txt",
  },
  {
    sourceId: "tech-apple",
    sourceName: "Apple product pages",
    sourceType: "MANUFACTURER",
    domain: "technology",
    supportedCategories: ["technology"],
    baseUrl: "https://www.apple.com",
    accessMode: "PUBLIC_HTTP",
    structuredDataTypes: ["json-ld", "html"],
    authorityLevel: "OFFICIAL",
    coverageEstimate: "Smartphone/computer; structured but bot-sensitive.",
    rateLimitPolicy: { timeoutMs: 10_000, maxRequestsPerMinute: 4, minIntervalMs: 1500 },
    enabled: true,
    lastCheckedAt: null,
    status: "UNKNOWN",
    seedUrls: [
      "https://www.apple.com/iphone-16-pro/",
      "https://www.apple.com/macbook-pro/",
    ],
    robotsUrl: "https://www.apple.com/robots.txt",
  },
  {
    sourceId: "tech-samsung-mobile",
    sourceName: "Samsung mobile public pages",
    sourceType: "MANUFACTURER",
    domain: "technology",
    supportedCategories: ["technology"],
    baseUrl: "https://www.samsung.com",
    accessMode: "PUBLIC_HTTP",
    structuredDataTypes: ["json-ld", "html"],
    authorityLevel: "OFFICIAL",
    coverageEstimate: "Smartphones/TVs; bot access variable.",
    rateLimitPolicy: { timeoutMs: 10_000, maxRequestsPerMinute: 4, minIntervalMs: 1500 },
    enabled: true,
    lastCheckedAt: null,
    status: "UNKNOWN",
    seedUrls: [
      "https://www.samsung.com/us/smartphones/galaxy-s24/",
      "https://www.samsung.com/us/tvs/",
    ],
    robotsUrl: "https://www.samsung.com/robots.txt",
  },
  {
    sourceId: "tech-lg",
    sourceName: "LG Electronics public pages",
    sourceType: "MANUFACTURER",
    domain: "technology",
    supportedCategories: ["technology"],
    baseUrl: "https://www.lg.com",
    accessMode: "PUBLIC_HTTP",
    structuredDataTypes: ["json-ld", "html"],
    authorityLevel: "OFFICIAL",
    coverageEstimate: "TV/computer peripherals; bot access variable.",
    rateLimitPolicy: { timeoutMs: 10_000, maxRequestsPerMinute: 4, minIntervalMs: 1500 },
    enabled: true,
    lastCheckedAt: null,
    status: "UNKNOWN",
    seedUrls: ["https://www.lg.com/us/tvs"],
    robotsUrl: "https://www.lg.com/robots.txt",
  },
  {
    sourceId: "auto-volkswagen-newsroom",
    sourceName: "Volkswagen Newsroom / public specs",
    sourceType: "MANUFACTURER",
    domain: "automotive",
    supportedCategories: ["automotive"],
    baseUrl: "https://www.volkswagen-newsroom.com",
    accessMode: "PUBLIC_HTTP",
    structuredDataTypes: ["html", "json-ld"],
    authorityLevel: "OFFICIAL",
    coverageEstimate: "Press specs for engines/transmissions; often blocked or sparse.",
    rateLimitPolicy: { timeoutMs: 10_000, maxRequestsPerMinute: 3, minIntervalMs: 2000 },
    enabled: true,
    lastCheckedAt: null,
    status: "UNKNOWN",
    seedUrls: [
      "https://www.volkswagen-newsroom.com/en/press-kits",
    ],
    robotsUrl: "https://www.volkswagen-newsroom.com/robots.txt",
    notes: "Preferred for SAFE engine/transmission; Wikidata not sole acceptance.",
  },
  {
    sourceId: "auto-bmw-press",
    sourceName: "BMW Group PressClub public",
    sourceType: "MANUFACTURER",
    domain: "automotive",
    supportedCategories: ["automotive"],
    baseUrl: "https://www.press.bmwgroup.com",
    accessMode: "PUBLIC_HTTP",
    structuredDataTypes: ["html"],
    authorityLevel: "OFFICIAL",
    coverageEstimate: "Press technical data; login/geo may block.",
    rateLimitPolicy: { timeoutMs: 10_000, maxRequestsPerMinute: 3, minIntervalMs: 2000 },
    enabled: true,
    lastCheckedAt: null,
    status: "UNKNOWN",
    seedUrls: ["https://www.press.bmwgroup.com/global"],
    robotsUrl: "https://www.press.bmwgroup.com/robots.txt",
    notes: "Preferred for BMW AT/manual SAFE corroboration; bot access often blocked.",
  },
  {
    sourceId: "auto-epa-fueleconomy",
    sourceName: "US EPA Fuel Economy web services",
    sourceType: "TRUSTED_DATASET",
    domain: "automotive",
    supportedCategories: ["automotive"],
    baseUrl: "https://www.fueleconomy.gov/ws/rest",
    endpoint: "https://www.fueleconomy.gov/ws/rest",
    accessMode: "PUBLIC_API",
    structuredDataTypes: ["application/json", "xml"],
    authorityLevel: "TRUSTED_DATASET",
    coverageEstimate:
      "Broad US market transmission marketing + displacement/fuel; no OEM TX codes.",
    rateLimitPolicy: { timeoutMs: 12_000, maxRequestsPerMinute: 20, minIntervalMs: 300 },
    enabled: true,
    lastCheckedAt: null,
    status: "UNKNOWN",
    seedUrls: [
      "https://www.fueleconomy.gov/ws/rest/vehicle/menu/make",
      "https://www.fueleconomy.gov/ws/rest/vehicle/menu/model?year=2017&make=Volkswagen",
    ],
    robotsUrl: "https://www.fueleconomy.gov/robots.txt",
    notes:
      "Authoritative structured US dataset for trany/drive/displ. Never invents DQ*/8HP codes. MarketScope=US.",
  },
  {
    sourceId: "auto-toyota-newsroom",
    sourceName: "Toyota USA Pressroom",
    sourceType: "MANUFACTURER",
    domain: "automotive",
    supportedCategories: ["automotive"],
    baseUrl: "https://pressroom.toyota.com",
    accessMode: "PUBLIC_HTTP",
    structuredDataTypes: ["html", "json-ld"],
    authorityLevel: "OFFICIAL",
    coverageEstimate: "CVT/e-CVT press specs; access variable.",
    rateLimitPolicy: { timeoutMs: 10_000, maxRequestsPerMinute: 3, minIntervalMs: 2000 },
    enabled: true,
    lastCheckedAt: null,
    status: "UNKNOWN",
    seedUrls: ["https://pressroom.toyota.com/"],
    robotsUrl: "https://pressroom.toyota.com/robots.txt",
  },
  {
    sourceId: "auto-renault-media",
    sourceName: "Renault Media",
    sourceType: "MANUFACTURER",
    domain: "automotive",
    supportedCategories: ["automotive"],
    baseUrl: "https://media.renault.com",
    accessMode: "PUBLIC_HTTP",
    structuredDataTypes: ["html"],
    authorityLevel: "OFFICIAL",
    coverageEstimate: "EDC / powertrain press; often geo/bot blocked.",
    rateLimitPolicy: { timeoutMs: 10_000, maxRequestsPerMinute: 3, minIntervalMs: 2000 },
    enabled: true,
    lastCheckedAt: null,
    status: "UNKNOWN",
    seedUrls: ["https://media.renault.com/"],
    robotsUrl: "https://media.renault.com/robots.txt",
  },
  {
    sourceId: "auto-hyundai-news",
    sourceName: "Hyundai Newsroom",
    sourceType: "MANUFACTURER",
    domain: "automotive",
    supportedCategories: ["automotive"],
    baseUrl: "https://www.hyundainews.com",
    accessMode: "PUBLIC_HTTP",
    structuredDataTypes: ["html"],
    authorityLevel: "OFFICIAL",
    coverageEstimate: "DCT/AT press kits; access variable.",
    rateLimitPolicy: { timeoutMs: 10_000, maxRequestsPerMinute: 3, minIntervalMs: 2000 },
    enabled: true,
    lastCheckedAt: null,
    status: "UNKNOWN",
    seedUrls: ["https://www.hyundainews.com/"],
    robotsUrl: "https://www.hyundainews.com/robots.txt",
  },
  {
    sourceId: "auto-zf-tech",
    sourceName: "ZF public transmission tech pages",
    sourceType: "MANUFACTURER",
    domain: "automotive",
    supportedCategories: ["automotive"],
    baseUrl: "https://www.zf.com",
    accessMode: "PUBLIC_HTTP",
    structuredDataTypes: ["html", "pdf"],
    authorityLevel: "OFFICIAL",
    coverageEstimate: "8HP/family OEM docs when public; PDF metadata only for SAFE codes.",
    rateLimitPolicy: { timeoutMs: 10_000, maxRequestsPerMinute: 3, minIntervalMs: 2000 },
    enabled: true,
    lastCheckedAt: null,
    status: "UNKNOWN",
    seedUrls: [
      "https://www.zf.com/products/en/cars/products_29336.html",
    ],
    robotsUrl: "https://www.zf.com/robots.txt",
    notes: "Transmission OEM; AI-inferred PDF content not SAFE.",
  },
  {
    sourceId: "fixtures-offline",
    sourceName: "Curated offline fixtures",
    sourceType: "FIXTURE",
    domain: "multi",
    supportedCategories: ["appliances", "technology", "machinery"],
    accessMode: "OFFLINE_FIXTURE",
    structuredDataTypes: ["json-fixture"],
    authorityLevel: "TRUSTED_DATASET",
    coverageEstimate: "CI only — never counts as LIVE coverage.",
    rateLimitPolicy: { timeoutMs: 1000 },
    enabled: true,
    lastCheckedAt: null,
    status: "ACTIVE",
    notes: "Used only with --offline / allowNetwork=false.",
  },
  {
    sourceId: "automotive-internal-audit",
    sourceName: "Talepo automotive CatalogRegistry audit",
    sourceType: "INTERNAL",
    domain: "automotive",
    supportedCategories: ["automotive"],
    accessMode: "INTERNAL_AUDIT",
    structuredDataTypes: ["catalog-index"],
    authorityLevel: "INTERNAL_AUDIT",
    coverageEstimate: "Coverage gap metrics only.",
    rateLimitPolicy: { timeoutMs: 1000 },
    enabled: true,
    lastCheckedAt: null,
    status: "ACTIVE",
  },
];

let cachedRegistry: SourceRegistryEntry[] | null = null;

export function loadSourceRegistry(opts?: {
  forceReload?: boolean;
}): SourceRegistryEntry[] {
  if (cachedRegistry && !opts?.forceReload) return cachedRegistry;

  const dir = resolveRegistryDir();
  const fromFiles: SourceRegistryEntry[] = [];
  if (dir) {
    const main = path.join(dir, "registry.json");
    if (existsSync(main)) {
      try {
        const parsed = JSON.parse(readFileSync(main, "utf8")) as {
          sources?: SourceRegistryEntry[];
        };
        if (Array.isArray(parsed.sources)) fromFiles.push(...parsed.sources);
      } catch {
        // fall through to builtin
      }
    }
  }

  const byId = new Map<string, SourceRegistryEntry>();
  for (const e of BUILTIN_SOURCE_REGISTRY) byId.set(e.sourceId, e);
  for (const e of fromFiles) byId.set(e.sourceId, { ...byId.get(e.sourceId), ...e });

  cachedRegistry = [...byId.values()];
  return cachedRegistry;
}

export function getSourceById(sourceId: string): SourceRegistryEntry | undefined {
  return loadSourceRegistry().find((s) => s.sourceId === sourceId);
}

export function sourcesForCategory(categoryId: string): SourceRegistryEntry[] {
  return loadSourceRegistry().filter(
    (s) =>
      s.enabled &&
      (s.supportedCategories.includes(categoryId) ||
        s.supportedCategories.includes("*") ||
        s.domain === "multi"),
  );
}

export function enabledLiveSources(categoryId?: string): SourceRegistryEntry[] {
  return loadSourceRegistry().filter((s) => {
    if (!s.enabled) return false;
    if (s.accessMode === "OFFLINE_FIXTURE") return false;
    if (s.accessMode === "INTERNAL_AUDIT") return false;
    if (categoryId && !s.supportedCategories.includes(categoryId) && s.domain !== "multi") {
      return false;
    }
    return true;
  });
}

export function markSourceStatus(
  sourceId: string,
  status: SourceRegistryStatus,
  opts?: { persist?: boolean; notes?: string },
): void {
  const list = loadSourceRegistry({ forceReload: true });
  const hit = list.find((s) => s.sourceId === sourceId);
  if (!hit) return;
  hit.status = status;
  hit.lastCheckedAt = new Date().toISOString();
  if (opts?.notes) hit.notes = `${hit.notes ?? ""}; ${opts.notes}`.trim();
  cachedRegistry = list;

  if (opts?.persist) {
    const dir = resolveRegistryDir();
    if (!dir) return;
    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        path.join(dir, "registry.status.json"),
        JSON.stringify(
          {
            updatedAt: hit.lastCheckedAt,
            statuses: list.map((s) => ({
              sourceId: s.sourceId,
              status: s.status,
              lastCheckedAt: s.lastCheckedAt,
            })),
          },
          null,
          2,
        ),
        "utf8",
      );
    } catch {
      // non-fatal
    }
  }
}
