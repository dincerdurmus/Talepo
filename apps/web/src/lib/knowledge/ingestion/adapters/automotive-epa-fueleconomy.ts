/**
 * US EPA Fuel Economy public API — structured LIVE source for automotive
 * transmission marketing names + engine displacement/fuel/power hints.
 *
 * Authority: TRUSTED_DATASET (not OEM code sheet). Codes stay null.
 * MarketScope: US (usable as corroboration for EU/TR family labels).
 * Never invents transmissionCode / engineCode.
 */

import { ensureAutomotiveCatalogRegistered } from "@/lib/catalog";
import { getAutomotiveIndexes } from "@/lib/catalog/automotive/indexes";
import {
  extractGearCount,
  inferTransmissionFamily,
  sanitizeTransmissionCode,
} from "@/lib/catalog/automotive/transmission-normalize";

import type { IngestRecord } from "../../types";
import { buildTransmissionCandidate } from "../automotive-transmission";
import { matchExistingAutomotive } from "../canonical-mapper";
import { catalogSlug } from "../normalize";
import { fetchPublicUrl } from "../fetch-policy";
import { markSourceStatus } from "../source-registry";
import type {
  AccessStatus,
  AdapterDiscoverResult,
  SourceAdapter,
  SourceAdapterContext,
} from "../types";

const DEFAULT_LIMIT = 40;

/** Controlled LIVE pilots — brand/model/year combinations with EPA coverage. */
const PILOTS: Array<{
  brand: string;
  model: string;
  year: number;
  entityBias: "transmission" | "engine" | "both";
}> = [
  { brand: "Volkswagen", model: "Golf", year: 2017, entityBias: "both" },
  { brand: "Volkswagen", model: "Golf", year: 2015, entityBias: "transmission" },
  { brand: "BMW", model: "320i", year: 2014, entityBias: "both" },
  { brand: "BMW", model: "328i", year: 2014, entityBias: "transmission" },
  { brand: "Toyota", model: "Corolla", year: 2020, entityBias: "both" },
  { brand: "Toyota", model: "Prius", year: 2018, entityBias: "transmission" },
  { brand: "Hyundai", model: "Elantra", year: 2019, entityBias: "both" },
  { brand: "Kia", model: "Forte", year: 2019, entityBias: "transmission" },
  { brand: "Renault", model: "Clio", year: 2018, entityBias: "both" },
];

function parseMenuJson(body: string): Array<{ text: string; value: string }> {
  try {
    const parsed = JSON.parse(body) as {
      menuItem?: Array<{ text?: string; value?: string }> | { text?: string; value?: string };
    };
    const item = parsed.menuItem;
    if (!item) return [];
    const rows = Array.isArray(item) ? item : [item];
    return rows
      .filter((r) => r.text && r.value)
      .map((r) => ({ text: String(r.text), value: String(r.value) }));
  } catch {
    // XML fallback: <text>…</text><value>…</value>
    const out: Array<{ text: string; value: string }> = [];
    const re = /<text>([^<]+)<\/text>\s*<value>([^<]+)<\/value>/gi;
    for (const m of body.matchAll(re)) {
      out.push({ text: m[1]!, value: m[2]! });
    }
    return out;
  }
}

function parseVehicleJson(body: string): Record<string, string> {
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v == null) continue;
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        out[k] = String(v);
      }
    }
    return out;
  } catch {
    const out: Record<string, string> = {};
    for (const m of body.matchAll(/<([a-zA-Z0-9]+)>([^<]*)<\/\1>/g)) {
      out[m[1]!] = m[2]!;
    }
    return out;
  }
}

function mapEpaTrany(trany: string): {
  marketingName: string;
  gearCount: number | null;
  family: ReturnType<typeof inferTransmissionFamily>;
} {
  // EPA often encodes gears as "(S6)", "(AM-S7)", "6-spd"
  const sMatch = trany.match(/\((?:AM-?)?S?(\d{1,2})\)/i);
  const gearCount =
    extractGearCount(trany) ??
    (sMatch ? Number(sMatch[1]) : null);
  let marketingName = trany;
  // Normalize common EPA strings without inventing OEM codes
  if (/variable gear ratios/i.test(trany)) {
    marketingName = /hybrid|e-?cvt|avs/i.test(trany) ? "e-CVT" : "CVT";
  } else if (/manual/i.test(trany)) {
    marketingName = gearCount ? `${gearCount}MT` : "Manual";
  } else if (/automatic.*AM|dual.?clutch|DCT|DSG/i.test(trany)) {
    marketingName = gearCount ? `${gearCount}-speed DCT` : "DCT";
  } else if (/automatic/i.test(trany)) {
    marketingName = gearCount ? `${gearCount}AT` : "Automatic";
  }
  const family = inferTransmissionFamily(marketingName);
  return { marketingName, gearCount, family };
}

async function fetchEpaJson(
  pathSuffix: string,
  ctx: SourceAdapterContext,
): Promise<{ body: string | null; accessStatus: AccessStatus; fetchAttempts: number; errorMessage?: string }> {
  const url = `https://www.fueleconomy.gov/ws/rest/${pathSuffix}`;
  const res = await fetchPublicUrl({
    sourceId: "auto-epa-fueleconomy",
    url,
    allowNetwork: ctx.allowNetwork,
    robotsUrl: "https://www.fueleconomy.gov/robots.txt",
    policy: { timeoutMs: 12_000, minIntervalMs: 400 },
    accept: "application/json",
    discoveryMode: ctx.discoveryMode,
  });
  return {
    body: res.body ?? null,
    accessStatus: res.accessStatus,
    fetchAttempts: res.fetchAttempts,
    errorMessage: res.errorMessage,
  };
}

export const automotiveEpaFuelEconomyAdapter: SourceAdapter = {
  id: "automotive-epa-fueleconomy",
  adapterId: "automotive-epa-fueleconomy",
  sourceType: "TRUSTED_DATASET",
  supportedDomains: ["automotive"],
  supportedCategories: ["automotive"],
  supportedCategoryIds: ["automotive"],
  supportedEntityTypes: ["entity", "spec", "model", "generation"],
  authorityLevel: "TRUSTED_DATASET",
  discoveryCapability: "MODEL",
  structuredDataCapability: "STRUCTURED_API",
  rateLimitPolicy: { timeoutMs: 12_000, maxRequestsPerMinute: 20, minIntervalMs: 300 },
  licenseOrUsageNotes:
    "US EPA Fuel Economy web services (public). Marketing transmission/engine fields only — not OEM code authority.",
  supportsIncremental: true,
  supportsDetailFetch: true,
  async discover(ctx: SourceAdapterContext): Promise<AdapterDiscoverResult> {
    ensureAutomotiveCatalogRegistered();
    const idx = getAutomotiveIndexes();
    const limit = ctx.limit ?? DEFAULT_LIMIT;
    const entityFilter = ctx.entityFilter ?? null;
    const records: IngestRecord[] = [];
    const notes: string[] = ["source=EPA_FuelEconomy", "marketScope=US"];
    let fetchAttempts = 0;
    let accessStatus: AccessStatus = "AVAILABLE";

    if (ctx.allowNetwork === false) {
      return {
        records: [],
        accessStatus: "SOURCE_UNAVAILABLE",
        fetchAttempts: 0,
        notes: [...notes, "network disabled — EPA idle"],
        sourceFingerprint: "auto-epa:offline",
      };
    }

    for (const pilot of PILOTS) {
      if (records.length >= limit) break;
      if (entityFilter === "transmission" && pilot.entityBias === "engine") continue;
      if (entityFilter === "engine" && pilot.entityBias === "transmission") continue;

      const catalogModel =
        pilot.brand === "BMW" && /^3\d{2}/i.test(pilot.model)
          ? "3 Series"
          : pilot.model;
      const mapped = matchExistingAutomotive({
        brand: pilot.brand,
        model: catalogModel,
      });
      if (mapped.status !== "EXISTING" || !mapped.canonicalId) {
        notes.push(`skip-unmapped:${pilot.brand}/${catalogModel}`);
        continue;
      }
      const modelId = mapped.canonicalId;
      const modelName = catalogModel;

      const brandId = `brand_${catalogSlug(pilot.brand === "Volkswagen" ? "volkswagen" : pilot.brand)}`;
      const brandRec = idx.brands.find(
        (b) => b.name.toLowerCase() === pilot.brand.toLowerCase(),
      );
      const resolvedBrandId = brandRec?.id ?? brandId;

      const gens = (idx.generationsByModel.get(modelId) ?? []).filter((g) => {
        if (pilot.year < g.yearFrom) return false;
        if (g.yearTo != null && pilot.year > g.yearTo) return false;
        return true;
      });
      const generationId = gens[0]?.id ?? null;

      const optionsPath = `vehicle/menu/options?year=${pilot.year}&make=${encodeURIComponent(pilot.brand)}&model=${encodeURIComponent(pilot.model)}`;
      const optionsRes = await fetchEpaJson(optionsPath, ctx);
      fetchAttempts += optionsRes.fetchAttempts;
      if (optionsRes.accessStatus !== "AVAILABLE" || !optionsRes.body) {
        accessStatus =
          optionsRes.accessStatus === "ACCESS_BLOCKED"
            ? "ACCESS_BLOCKED"
            : accessStatus === "AVAILABLE"
              ? optionsRes.accessStatus
              : accessStatus;
        notes.push(
          `epa-options ${pilot.brand}/${pilot.model}/${pilot.year}=${optionsRes.accessStatus}`,
        );
        continue;
      }

      markSourceStatus("auto-epa-fueleconomy", "ACTIVE", { persist: true });
      const options = parseMenuJson(optionsRes.body).slice(0, 4);
      for (const opt of options) {
        if (records.length >= limit) break;
        const vehicleRes = await fetchEpaJson(`vehicle/${opt.value}`, ctx);
        fetchAttempts += vehicleRes.fetchAttempts;
        if (vehicleRes.accessStatus !== "AVAILABLE" || !vehicleRes.body) continue;
        const v = parseVehicleJson(vehicleRes.body);
        const trany = v.trany ?? v.trans ?? "";
        const drive = v.drive ?? null;
        const fuelType = v.fuelType1 ?? v.fuelType ?? null;
        const displ = v.displ ? Number(v.displ) : null;
        const city = v.city08 ? Number(v.city08) : null;

        if (trany && entityFilter !== "engine") {
          const mappedTx = mapEpaTrany(trany);
          const code = sanitizeTransmissionCode(trany); // almost always null — correct
          const candidate = buildTransmissionCandidate({
            brandId: resolvedBrandId,
            modelId,
            generationId: generationId ?? `${modelId}|generation-unknown`,
            marketingName: mappedTx.marketingName,
            transmissionFamily: mappedTx.family,
            gearCount: mappedTx.gearCount,
            driveType: drive,
            transmissionCode: code,
            yearFrom: pilot.year,
            yearTo: pilot.year,
            marketScope: ["US"],
            provenance: {
              type: "EPA_FUELECONOMY",
              confidence: generationId ? "MEDIUM" : "LOW",
              sourceRef: `https://www.fueleconomy.gov/ws/rest/vehicle/${opt.value}`,
              sourceMode: "LIVE",
              verificationStatus: "epa-structured-marketing",
            },
            confidence: generationId && mappedTx.family !== "UNKNOWN" ? "MEDIUM" : "LOW",
            verificationStatus: "epa-structured-marketing",
            notes: `EPA trany="${trany}"; code not invented from marketing.`,
          });

          records.push({
            id: `auto-epa-tx-${catalogSlug(candidate.id)}-${opt.value}`,
            categoryId: "automotive",
            kind: "entity",
            sourceMode: "LIVE",
            payload: {
              ...candidate,
              brand: pilot.brand,
              model: modelName,
              gapType: "transmission",
              sourceId: "auto-epa-fueleconomy",
              epaVehicleId: opt.value,
              epaOptionText: opt.text,
              discoveryOnly: !generationId,
              requiresOfficialCorroboration: Boolean(code),
              wikidataSole: false,
              matchStatus: mapped.status,
              existingCanonicalId: modelId,
              canonicalKey: `automotive|transmission|epa|${candidate.id}|${opt.value}`,
              year: pilot.year,
            },
            provenance: {
              sourceType: "TRUSTED_DATASET",
              sourceName: "US EPA Fuel Economy API",
              sourceRef: `https://www.fueleconomy.gov/ws/rest/vehicle/${opt.value}`,
              retrievedAt: new Date().toISOString(),
              confidence: candidate.confidence,
              verificationStatus: "epa-transmission-candidate",
            },
          });
        }

        if (entityFilter !== "transmission" && (displ != null || fuelType)) {
          const marketingName =
            displ != null && Number.isFinite(displ)
              ? `${displ.toFixed(1)}L`
              : opt.text.split(" ")[0] ?? "engine";
          const powerHint = city; // not kW — leave powerKw null rather than invent
          records.push({
            id: `auto-epa-eng-${catalogSlug(pilot.brand)}-${catalogSlug(modelName)}-${opt.value}`,
            categoryId: "automotive",
            kind: "entity",
            sourceMode: "LIVE",
            payload: {
              brand: pilot.brand,
              model: modelName,
              brandId: resolvedBrandId,
              modelId,
              generationId,
              marketingName,
              engineCode: null,
              displacementCc:
                displ != null && Number.isFinite(displ)
                  ? Math.round(displ * 1000)
                  : null,
              fuelType,
              powerKw: null,
              powerHp: powerHint,
              yearFrom: pilot.year,
              yearTo: pilot.year,
              gapType: "engine",
              sourceId: "auto-epa-fueleconomy",
              epaVehicleId: opt.value,
              marketScope: ["US"],
              discoveryOnly: !generationId,
              requiresOfficialCorroboration: true,
              wikidataSole: false,
              matchStatus: mapped.status,
              existingCanonicalId: modelId,
              canonicalKey: `automotive|engine|epa|${catalogSlug(pilot.brand)}|${catalogSlug(modelName)}|${opt.value}`,
              year: pilot.year,
              notes: "EPA displacement/fuel; engineCode null (not in EPA vehicle sheet).",
            },
            provenance: {
              sourceType: "TRUSTED_DATASET",
              sourceName: "US EPA Fuel Economy API",
              sourceRef: `https://www.fueleconomy.gov/ws/rest/vehicle/${opt.value}`,
              retrievedAt: new Date().toISOString(),
              confidence: generationId ? "MEDIUM" : "LOW",
              verificationStatus: "epa-engine-candidate",
            },
          });
        }
      }
    }

    const seen = new Set<string>();
    const deduped = records.filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    notes.push(`epaRecords=${deduped.length}`);
    return {
      records: deduped.slice(0, limit),
      accessStatus: deduped.length > 0 ? "AVAILABLE" : accessStatus,
      fetchAttempts,
      notes,
      sourceFingerprint: `auto-epa:${deduped.length}`,
    };
  },
};
