/**
 * Automotive transmission discovery — gap-driven + LIVE pilots.
 * Emits dry-run candidates only; never mutates production catalogs.
 * transmissionCode null unless explicit OEM code in source (not "DSG" alone).
 * Wikidata is discovery-only; EPA/official preferred for family labels.
 */

import { ensureAutomotiveCatalogRegistered } from "@/lib/catalog";
import { getAutomotiveIndexes } from "@/lib/catalog/automotive/indexes";
import { sanitizeTransmissionCode } from "@/lib/catalog/automotive/transmission-normalize";

import type { IngestRecord } from "../../types";
import {
  buildTransmissionCandidate,
} from "../automotive-transmission";
import { matchExistingAutomotive } from "../canonical-mapper";
import { catalogSlug } from "../normalize";
import { fetchPublicUrl } from "../fetch-policy";
import { runWikidataSparql } from "../wikidata";
import { markSourceStatus } from "../source-registry";
import type {
  AccessStatus,
  AdapterDiscoverResult,
  SourceAdapter,
  SourceAdapterContext,
} from "../types";

const DEFAULT_LIMIT = 40;

/** Controlled LIVE TX pilots — source reality decides which succeed. */
const TX_PILOTS: Array<{
  brand: string;
  model: string;
  marketingName: string;
  gearCount?: number;
  familyHint?: string;
  yearFrom?: number;
  yearTo?: number;
  marketScope?: string[];
}> = [
  {
    brand: "Volkswagen",
    model: "Golf",
    marketingName: "7-speed DSG",
    gearCount: 7,
    familyHint: "DSG",
    yearFrom: 2013,
    yearTo: 2020,
    marketScope: ["EU", "TR"],
  },
  {
    brand: "Volkswagen",
    model: "Golf",
    marketingName: "6-speed DSG",
    gearCount: 6,
    familyHint: "DSG",
    yearFrom: 2013,
    yearTo: 2017,
    marketScope: ["EU", "TR"],
  },
  {
    brand: "BMW",
    model: "3 Series",
    marketingName: "8AT",
    gearCount: 8,
    familyHint: "TORQUE_CONVERTER_AUTOMATIC",
    yearFrom: 2012,
    yearTo: 2019,
    marketScope: ["EU", "TR", "US"],
  },
  {
    brand: "BMW",
    model: "3 Series",
    marketingName: "6MT",
    gearCount: 6,
    familyHint: "MANUAL",
    yearFrom: 2012,
    yearTo: 2019,
    marketScope: ["EU", "TR"],
  },
  {
    brand: "Renault",
    model: "Clio",
    marketingName: "EDC",
    gearCount: 6,
    familyHint: "DCT",
    yearFrom: 2012,
    yearTo: 2019,
    marketScope: ["EU", "TR"],
  },
  {
    brand: "Toyota",
    model: "Corolla",
    marketingName: "e-CVT",
    familyHint: "E_CVT",
    yearFrom: 2019,
    yearTo: 2024,
    marketScope: ["EU", "TR", "US"],
  },
  {
    brand: "Toyota",
    model: "Corolla",
    marketingName: "CVT",
    familyHint: "CVT",
    yearFrom: 2019,
    yearTo: 2024,
    marketScope: ["US"],
  },
  {
    brand: "Hyundai",
    model: "i20",
    marketingName: "7DCT",
    gearCount: 7,
    familyHint: "DCT",
    yearFrom: 2014,
    yearTo: 2020,
    marketScope: ["EU", "TR"],
  },
  {
    brand: "Kia",
    model: "Sportage",
    marketingName: "6AT",
    gearCount: 6,
    familyHint: "TORQUE_CONVERTER_AUTOMATIC",
    yearFrom: 2016,
    yearTo: 2021,
    marketScope: ["EU", "TR"],
  },
];

function transmissionSparql(limit: number): string {
  return `
SELECT ?item ?itemLabel ?brandLabel ?tx ?txLabel ?gears ?driveLabel WHERE {
  VALUES ?modelLabel {
    "Volkswagen Golf"@en
    "BMW 3 Series"@en
    "Toyota Corolla"@en
    "Renault Clio"@en
    "Hyundai i20"@en
  }
  ?item rdfs:label ?modelLabel .
  OPTIONAL { ?item wdt:P176 ?brand . }
  OPTIONAL { ?item wdt:P3500 ?tx . }
  OPTIONAL { ?item wdt:P1247 ?gears . }
  OPTIONAL { ?item wdt:P516 ?drive . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,tr". }
}
LIMIT ${limit}
`.trim();
}

function entityFilterOf(ctx: SourceAdapterContext): string | null {
  return ctx.entityFilter ?? null;
}

export const automotiveTransmissionDiscoveryAdapter: SourceAdapter = {
  id: "automotive-transmission-discovery",
  adapterId: "automotive-transmission-discovery",
  sourceType: "TRUSTED_DATASET",
  supportedDomains: ["automotive"],
  supportedCategories: ["automotive"],
  supportedCategoryIds: ["automotive"],
  supportedEntityTypes: ["entity", "spec", "model", "generation"],
  authorityLevel: "DISCOVERY_ONLY",
  discoveryCapability: "MODEL",
  structuredDataCapability: "STRUCTURED_API",
  rateLimitPolicy: { timeoutMs: 12_000, maxRequestsPerMinute: 8, minIntervalMs: 600 },
  licenseOrUsageNotes:
    "Transmission gap fill: EPA/official preferred; Wikidata structured discovery only. Never invent transmissionCode.",
  supportsIncremental: true,
  supportsDetailFetch: false,
  async discover(ctx: SourceAdapterContext): Promise<AdapterDiscoverResult> {
    ensureAutomotiveCatalogRegistered();
    const idx = getAutomotiveIndexes();
    const limit = ctx.limit ?? DEFAULT_LIMIT;
    const entityFilter = entityFilterOf(ctx);
    if (entityFilter === "engine") {
      return {
        records: [],
        accessStatus: "AVAILABLE",
        fetchAttempts: 0,
        notes: ["entityFilter=engine — transmission adapter skipped"],
        sourceFingerprint: "auto-tx:skipped-entity",
      };
    }

    const records: IngestRecord[] = [];
    const notes: string[] = [
      `knownTransmissions=${idx.transmissions.length}`,
      `priority=TRANSMISSION→ENGINE→GENERATION→MODEL→BRAND`,
      `catalogEngines=${idx.engines.length}`,
    ];
    let fetchAttempts = 0;
    let accessStatus: AccessStatus = "AVAILABLE";

    const mapGolf = matchExistingAutomotive({ brand: "Volkswagen", model: "Golf" });
    records.push({
      id: "auto-tx-map-vw-golf",
      categoryId: "automotive",
      kind: "entity",
      sourceMode: ctx.allowNetwork === false ? "OFFLINE_FIXTURE" : "LIVE",
      payload: {
        brand: "Volkswagen",
        model: "Golf",
        matchStatus: mapGolf.status,
        existingCanonicalId: mapGolf.canonicalId,
        gapType: "transmission",
        mappingProbe: true,
        canonicalKey: "automotive|tx|map|vw-golf",
      },
      provenance: {
        sourceType: "TRUSTED_DATASET",
        sourceName: "Automotive transmission discovery mapping probe",
        confidence: "HIGH",
        verificationStatus: "existing-map",
      },
    });

    // Catalog-scoped pilot shells are OFFLINE_FIXTURE only — never count as LIVE.
    // Real LIVE TX comes from EPA / Wikidata / official pages below.
    for (const pilot of TX_PILOTS) {
      if (records.length >= limit) break;
      const mapped = matchExistingAutomotive({
        brand: pilot.brand,
        model: pilot.model,
      });
      if (mapped.status !== "EXISTING" || !mapped.canonicalId) {
        notes.push(`pilot-unmapped:${pilot.brand}/${pilot.model}`);
        continue;
      }
      const modelId = mapped.canonicalId;
      const brand =
        idx.brands.find((b) => b.name.toLowerCase() === pilot.brand.toLowerCase()) ??
        null;
      const brandId = brand?.id ?? `brand_${catalogSlug(pilot.brand)}`;
      const gens = idx.generationsByModel.get(modelId) ?? [];
      const yearGens = gens.filter((g) => {
        if (pilot.yearFrom != null && g.yearTo != null && pilot.yearFrom > g.yearTo) {
          return false;
        }
        if (pilot.yearTo != null && pilot.yearTo < g.yearFrom) return false;
        return true;
      });
      const generationId = yearGens[0]?.id ?? gens[0]?.id ?? null;
      if (!generationId) {
        notes.push(`pilot-no-generation:${pilot.brand}/${pilot.model}`);
        continue;
      }

      const candidate = buildTransmissionCandidate({
        brandId,
        modelId,
        generationId,
        marketingName: pilot.marketingName,
        transmissionFamily: (pilot.familyHint as
          | "MANUAL"
          | "TORQUE_CONVERTER_AUTOMATIC"
          | "DCT"
          | "DSG"
          | "CVT"
          | "E_CVT"
          | "AMT"
          | "SINGLE_SPEED_EV"
          | "OTHER"
          | "UNKNOWN"
          | undefined) ?? undefined,
        gearCount: pilot.gearCount ?? null,
        transmissionCode: null,
        yearFrom: pilot.yearFrom ?? null,
        yearTo: pilot.yearTo ?? null,
        marketScope: pilot.marketScope ?? [],
        provenance: {
          type: "CATALOG_SCOPED_PILOT",
          confidence: "LOW",
          sourceMode: "OFFLINE_FIXTURE",
          verificationStatus: "pilot-needs-source-corroboration",
        },
        confidence: "LOW",
        verificationStatus: "pilot-needs-source-corroboration",
        notes:
          "Catalog-scoped marketing pilot shell (FIXTURE) — not LIVE; awaits EPA/OEM corroboration. Code=null.",
      });

      records.push({
        id: `auto-tx-pilot-${catalogSlug(candidate.id)}`,
        categoryId: "automotive",
        kind: "entity",
        sourceMode: "OFFLINE_FIXTURE",
        payload: {
          ...candidate,
          brand: pilot.brand,
          model: pilot.model,
          gapType: "transmission",
          sourceId: "automotive-transmission-discovery",
          discoveryOnly: true,
          requiresOfficialCorroboration: true,
          matchStatus: mapped.status,
          existingCanonicalId: modelId,
          canonicalKey: `automotive|transmission|pilot|${candidate.id}`,
        },
        provenance: {
          sourceType: "INTERNAL_AUDIT",
          sourceName: "Automotive TX catalog-scoped pilot shell",
          confidence: "LOW",
          verificationStatus: "pilot-needs-source-corroboration",
        },
      });
    }

    if (ctx.allowNetwork !== false) {
      const official = await fetchPublicUrl({
        sourceId: "auto-volkswagen-newsroom",
        url: "https://www.volkswagen-newsroom.com/en/press-kits",
        allowNetwork: ctx.allowNetwork,
        robotsUrl: "https://www.volkswagen-newsroom.com/robots.txt",
        policy: { timeoutMs: 10_000, minIntervalMs: 2000 },
        discoveryMode: ctx.discoveryMode,
      });
      fetchAttempts += official.fetchAttempts;
      if (official.accessStatus === "ACCESS_BLOCKED") {
        markSourceStatus("auto-volkswagen-newsroom", "ACCESS_BLOCKED", {
          persist: true,
          notes: official.errorMessage,
        });
        notes.push(`officialVW=${official.accessStatus}`);
      } else if (official.accessStatus === "AVAILABLE") {
        markSourceStatus("auto-volkswagen-newsroom", "ACTIVE", { persist: true });
        notes.push("officialVW=AVAILABLE (no fabricated TX from HTML)");
      } else {
        markSourceStatus("auto-volkswagen-newsroom", "DEGRADED", {
          persist: true,
          notes: official.errorMessage,
        });
        notes.push(`officialVW=${official.accessStatus}`);
      }

      // BMW / Toyota / Renault press probes (honest ACCESS_BLOCKED)
      for (const probe of [
        {
          id: "auto-bmw-press",
          url: "https://www.press.bmwgroup.com/global",
          robots: "https://www.press.bmwgroup.com/robots.txt",
        },
        {
          id: "auto-toyota-newsroom",
          url: "https://pressroom.toyota.com/",
          robots: "https://pressroom.toyota.com/robots.txt",
        },
        {
          id: "auto-renault-media",
          url: "https://media.renault.com/",
          robots: "https://media.renault.com/robots.txt",
        },
      ] as const) {
        const res = await fetchPublicUrl({
          sourceId: probe.id,
          url: probe.url,
          allowNetwork: ctx.allowNetwork,
          robotsUrl: probe.robots,
          policy: { timeoutMs: 8_000, minIntervalMs: 1500 },
          discoveryMode: ctx.discoveryMode,
        });
        fetchAttempts += res.fetchAttempts;
        markSourceStatus(
          probe.id,
          res.accessStatus === "AVAILABLE"
            ? "ACTIVE"
            : res.accessStatus === "ACCESS_BLOCKED"
              ? "ACCESS_BLOCKED"
              : "DEGRADED",
          { persist: true, notes: res.errorMessage },
        );
        notes.push(`${probe.id}=${res.accessStatus}`);
      }

      const sparql = await runWikidataSparql(transmissionSparql(Math.min(limit, 20)), {
        allowNetwork: ctx.allowNetwork,
        timeoutMs: 12_000,
      });
      fetchAttempts += sparql.fetchAttempts;
      if (sparql.accessStatus !== "AVAILABLE") {
        notes.push(`wikidata=${sparql.accessStatus}:${sparql.errorMessage ?? ""}`);
        if (records.length === 0) accessStatus = sparql.accessStatus;
      } else {
        notes.push(`wikidataBindings=${sparql.bindings.length}`);
        for (const row of sparql.bindings) {
          if (records.length >= limit) break;
          const modelLabel = row.itemLabel?.value;
          const brandLabel = row.brandLabel?.value ?? "Volkswagen";
          const txLabel = row.txLabel?.value;
          const gearsRaw = row.gears?.value;
          const gears = gearsRaw && /^\d+$/.test(gearsRaw) ? Number(gearsRaw) : null;
          const driveLabel = row.driveLabel?.value;
          if (!modelLabel) continue;
          if (!txLabel && gears == null) continue;

          const marketingName =
            txLabel ?? (gears != null ? `${gears}-speed transmission` : null);
          if (!marketingName) continue;

          const mapped = matchExistingAutomotive({
            brand: brandLabel,
            model:
              modelLabel.replace(/^(Volkswagen|BMW|Toyota|Renault|Hyundai)\s+/i, "") ||
              modelLabel,
          });
          if (mapped.status !== "EXISTING" || !mapped.canonicalId) continue;
          const modelId = mapped.canonicalId;
          const brand = idx.brands.find(
            (b) => foldEq(b.name, brandLabel),
          );
          const brandId = brand?.id ?? `brand_${catalogSlug(brandLabel)}`;
          const gens = idx.generationsByModel.get(modelId) ?? [];
          const generationId = gens[0]?.id ?? `${modelId}|generation-unknown`;
          const code = sanitizeTransmissionCode(txLabel);

          const candidate = buildTransmissionCandidate({
            brandId,
            modelId,
            generationId,
            marketingName,
            gearCount: gears,
            driveType: driveLabel ?? null,
            transmissionCode: code,
            marketScope: [],
            provenance: {
              type: "WIKIDATA_STRUCTURED",
              confidence: "MEDIUM",
              sourceRef: row.tx?.value ?? row.item?.value,
              sourceMode: "LIVE",
              verificationStatus: "transmission-discovery-candidate",
            },
            confidence: code ? "MEDIUM" : "LOW",
            notes: code
              ? null
              : "Structured transmission evidence without verified OEM code — code=null",
          });

          records.push({
            id: `auto-tx-${catalogSlug(candidate.id)}`,
            categoryId: "automotive",
            kind: "entity",
            sourceMode: "LIVE",
            payload: {
              ...candidate,
              brand: brandLabel,
              model: modelLabel,
              gapType: "transmission",
              sourceId: "wikidata-sparql",
              discoveryOnly: true,
              wikidataSole: true,
              matchStatus: mapped.status,
              existingCanonicalId: mapped.canonicalId,
              canonicalKey: `automotive|transmission|${candidate.id}`,
              requiresOfficialCorroboration: true,
            },
            provenance: {
              sourceType: "MARKETPLACE",
              sourceName: "Wikidata SPARQL (transmission/gears)",
              sourceRef: row.tx?.value ?? row.item?.value,
              retrievedAt: new Date().toISOString(),
              confidence: candidate.confidence,
              verificationStatus: "transmission-discovery-candidate",
            },
          });
        }
      }
    } else {
      notes.push("network disabled — transmission discovery idle (pilot shells may be FIXTURE)");
      accessStatus = "SOURCE_UNAVAILABLE";
    }

    const seen = new Set<string>();
    const deduped = records.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    return {
      records: deduped.slice(0, limit),
      accessStatus,
      fetchAttempts,
      notes,
      sourceFingerprint: `auto-tx:${deduped.length}`,
    };
  },
};

function foldEq(a: string, b: string): boolean {
  return a.toLocaleLowerCase("tr-TR") === b.toLocaleLowerCase("tr-TR");
}
