/**
 * Automotive engine expansion — attach LIVE candidates to brand→model→generation.
 * engineCode only if explicit in source; ambiguous power variants → REVIEW.
 */

import { ensureAutomotiveCatalogRegistered } from "@/lib/catalog";
import { getAutomotiveIndexes } from "@/lib/catalog/automotive/indexes";

import type { IngestRecord } from "../../types";
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

const DEFAULT_LIMIT = 30;

function engineSparql(limit: number): string {
  return `
SELECT ?car ?carLabel ?engine ?engineLabel ?power ?code ?disp WHERE {
  VALUES ?carLabelEn {
    "Volkswagen Golf"@en
    "BMW 3 Series"@en
    "Toyota Corolla"@en
    "Renault Clio"@en
    "Hyundai i20"@en
  }
  ?car rdfs:label ?carLabelEn .
  OPTIONAL { ?car wdt:P516 ?engine . }
  OPTIONAL { ?engine wdt:P2102 ?power . }
  OPTIONAL { ?engine wdt:P2598 ?code . }
  OPTIONAL { ?engine wdt:P1247 ?disp . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,tr". }
}
LIMIT ${limit}
`.trim();
}

export const automotiveEngineExpansionAdapter: SourceAdapter = {
  id: "automotive-engine-expansion",
  adapterId: "automotive-engine-expansion",
  sourceType: "TRUSTED_DATASET",
  supportedDomains: ["automotive"],
  supportedCategories: ["automotive"],
  supportedCategoryIds: ["automotive"],
  supportedEntityTypes: ["entity", "spec", "generation", "model"],
  authorityLevel: "DISCOVERY_ONLY",
  discoveryCapability: "MODEL",
  structuredDataCapability: "STRUCTURED_API",
  rateLimitPolicy: { timeoutMs: 12_000, maxRequestsPerMinute: 8, minIntervalMs: 600 },
  licenseOrUsageNotes:
    "Engine expansion candidates. Official preferred; Wikidata discovery-only for codes. Never invent engineCode.",
  supportsIncremental: true,
  supportsDetailFetch: false,
  async discover(ctx: SourceAdapterContext): Promise<AdapterDiscoverResult> {
    ensureAutomotiveCatalogRegistered();
    const idx = getAutomotiveIndexes();
    const limit = ctx.limit ?? DEFAULT_LIMIT;
    if (ctx.entityFilter === "transmission") {
      return {
        records: [],
        accessStatus: "AVAILABLE",
        fetchAttempts: 0,
        notes: ["entityFilter=transmission — engine adapter skipped"],
        sourceFingerprint: "auto-eng:skipped-entity",
      };
    }
    const records: IngestRecord[] = [];
    const notes: string[] = [
      `knownEngines=${idx.engines.length}`,
      `knownGenerations=${idx.generations.length}`,
    ];
    let fetchAttempts = 0;
    let accessStatus: AccessStatus = "AVAILABLE";

    const mapBmw = matchExistingAutomotive({ brand: "BMW", model: "3 Series" });
    records.push({
      id: "auto-eng-map-bmw-3",
      categoryId: "automotive",
      kind: "entity",
      sourceMode: ctx.allowNetwork === false ? "OFFLINE_FIXTURE" : "LIVE",
      payload: {
        brand: "BMW",
        model: "3 Series",
        matchStatus: mapBmw.status,
        existingCanonicalId: mapBmw.canonicalId,
        gapType: "engine",
        mappingProbe: true,
        canonicalKey: "automotive|engine|map|bmw-3",
      },
      provenance: {
        sourceType: "TRUSTED_DATASET",
        sourceName: "Automotive engine expansion mapping probe",
        confidence: "HIGH",
        verificationStatus: "existing-map",
      },
    });

    if (ctx.allowNetwork === false) {
      return {
        records,
        accessStatus: "SOURCE_UNAVAILABLE",
        fetchAttempts: 0,
        notes: [...notes, "network disabled"],
        sourceFingerprint: `auto-eng-offline:${records.length}`,
      };
    }

    const bmwPress = await fetchPublicUrl({
      sourceId: "auto-bmw-press",
      url: "https://www.press.bmwgroup.com/global",
      allowNetwork: ctx.allowNetwork,
      robotsUrl: "https://www.press.bmwgroup.com/robots.txt",
      policy: { timeoutMs: 10_000, minIntervalMs: 2000 },
    });
    fetchAttempts += bmwPress.fetchAttempts;
    if (bmwPress.accessStatus === "ACCESS_BLOCKED") {
      markSourceStatus("auto-bmw-press", "ACCESS_BLOCKED", {
        persist: true,
        notes: bmwPress.errorMessage,
      });
    }
    notes.push(`officialBMW=${bmwPress.accessStatus}`);

    const sparql = await runWikidataSparql(engineSparql(Math.min(limit, 25)), {
      allowNetwork: ctx.allowNetwork,
      timeoutMs: 12_000,
    });
    fetchAttempts += sparql.fetchAttempts;

    if (sparql.accessStatus !== "AVAILABLE") {
      notes.push(`wikidata=${sparql.accessStatus}:${sparql.errorMessage ?? ""}`);
      accessStatus =
        bmwPress.accessStatus === "AVAILABLE" ? "AVAILABLE" : sparql.accessStatus;
    } else {
      notes.push(`wikidataBindings=${sparql.bindings.length}`);
      // Group by engine label + power to detect ambiguous power variants
      const byKey = new Map<string, typeof sparql.bindings>();
      for (const row of sparql.bindings) {
        const label = row.engineLabel?.value ?? row.carLabel?.value;
        if (!label) continue;
        const power = row.power?.value ?? "";
        const key = `${label}|${power}`;
        const list = byKey.get(key) ?? [];
        list.push(row);
        byKey.set(key, list);
      }

      // Detect same marketing name with multiple powers → REVIEW ambiguous
      const namePowers = new Map<string, Set<string>>();
      for (const [key] of byKey) {
        const [name, power] = key.split("|");
        if (!name) continue;
        const set = namePowers.get(name) ?? new Set();
        if (power) set.add(power);
        namePowers.set(name, set);
      }

      for (const [key, rows] of byKey) {
        if (records.length >= limit) break;
        const row = rows[0]!;
        const carLabel = row.carLabel?.value ?? "";
        const engineLabel = row.engineLabel?.value ?? key.split("|")[0]!;
        const brand = /bmw/i.test(carLabel)
          ? "BMW"
          : /volkswagen|vw/i.test(carLabel)
            ? "Volkswagen"
            : /toyota/i.test(carLabel)
              ? "Toyota"
              : /renault/i.test(carLabel)
                ? "Renault"
                : /hyundai/i.test(carLabel)
                  ? "Hyundai"
                  : "Unknown";
        if (brand === "Unknown") continue;
        // Reject non-automotive Wikidata noise (wrong property bindings)
        if (
          !engineLabel ||
          /hydrogen|iodide|chloride|oxide|acid|compound/i.test(engineLabel) ||
          engineLabel.length < 2
        ) {
          continue;
        }

        const modelName =
          carLabel
            .replace(/^(Volkswagen|BMW|Toyota|Renault|Hyundai)\s+/i, "")
            .trim() || carLabel;
        const mapped = matchExistingAutomotive({ brand, model: modelName });
        if (mapped.status !== "EXISTING") continue;
        const modelId =
          mapped.canonicalId && mapped.status === "EXISTING"
            ? mapped.canonicalId
            : `model_candidate_${catalogSlug(brand)}_${catalogSlug(modelName)}`;
        const gens = idx.generationsByModel.get(modelId) ?? [];
        const generationId = gens[0]?.id ?? null;

        const codeRaw = row.code?.value ?? null;
        // engineCode only if explicit alphanumeric code with digit
        const engineCode =
          codeRaw && /[0-9]/.test(codeRaw) && codeRaw.length >= 2 && codeRaw.length <= 16
            ? codeRaw.toUpperCase()
            : null;

        const powerKw = row.power?.value ? Number(row.power.value) : null;
        const ambiguous =
          (namePowers.get(engineLabel)?.size ?? 0) > 1 || !generationId;

        records.push({
          id: `auto-eng-${catalogSlug(brand)}-${catalogSlug(engineLabel)}-${powerKw ?? "x"}`,
          categoryId: "automotive",
          kind: "entity",
          sourceMode: "LIVE",
          payload: {
            brand,
            model: modelName,
            brandId: `brand_${catalogSlug(brand)}`,
            modelId,
            generationId,
            marketingName: engineLabel,
            engineCode,
            powerKw: Number.isFinite(powerKw as number) ? powerKw : null,
            displacementCc: row.disp?.value ? Number(row.disp.value) : null,
            gapType: "engine",
            discoveryOnly: true,
            wikidataSole: true,
            ambiguous,
            requiresOfficialCorroboration: true,
            matchStatus: mapped.status,
            existingCanonicalId: mapped.canonicalId,
            canonicalKey: `automotive|engine|${catalogSlug(brand)}|${catalogSlug(engineLabel)}|${powerKw ?? "x"}`,
          },
          provenance: {
            sourceType: "MARKETPLACE",
            sourceName: "Wikidata SPARQL (engine/power)",
            sourceRef: row.engine?.value ?? row.car?.value,
            retrievedAt: new Date().toISOString(),
            confidence: engineCode ? "MEDIUM" : "LOW",
            verificationStatus: ambiguous
              ? "engine-ambiguous-review"
              : "engine-discovery-candidate",
          },
        });
      }
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
      sourceFingerprint: `auto-eng:${deduped.length}`,
    };
  },
};
