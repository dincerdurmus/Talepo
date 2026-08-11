/**
 * Automotive transmission foundation — CatalogRegistry-compatible types.
 * Dry-run candidates only. Does NOT mutate production data/catalogs.
 * transmissionCode stays null unless explicitly present & verified in source.
 */

import type {
  AutomotiveTransmissionRecord,
  TransmissionFamily,
  TransmissionType,
} from "@/lib/catalog/automotive/types";
import {
  familyToType,
  inferTransmissionFamily,
  sanitizeTransmissionCode,
  commercialAliasesForFamily,
  normalizeTransmissionMention,
} from "@/lib/catalog/automotive/transmission-normalize";

export type { TransmissionFamily, TransmissionType, AutomotiveTransmissionRecord };
export {
  sanitizeTransmissionCode,
  inferTransmissionFamily,
  familyToType,
  normalizeTransmissionMention,
  commercialAliasesForFamily,
};

export type AutomotiveTransmissionCandidate = {
  id: string;
  brandId: string;
  modelId: string;
  generationId: string;
  engineId?: string | null;
  canonicalName: string;
  marketingName: string;
  aliases: string[];
  transmissionFamily: TransmissionFamily;
  transmissionType: TransmissionType;
  /** @deprecated use transmissionType — kept for V2 adapter compatibility */
  type: TransmissionType;
  gearCount: number | null;
  driveType?: string | null;
  clutchType?: string | null;
  manufacturerCode?: string | null;
  /** Never invent from marketing labels like "DSG" alone. */
  transmissionCode: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  marketScope: string[];
  provenance: {
    type: string;
    confidence: "HIGH" | "MEDIUM" | "LOW";
    verificationStatus?: string;
    sourceRef?: string;
    sourceMode?: "LIVE" | "OFFLINE_FIXTURE" | "CACHE";
  };
  confidence: "HIGH" | "MEDIUM" | "LOW";
  verificationStatus: string;
  notes?: string | null;
};

export type TransmissionSeedFile = {
  version: string;
  purpose: string;
  records: AutomotiveTransmissionCandidate[];
  notes: string[];
};

/** Empty seed — path for future apply; ingest dry-run must not write production catalogs. */
export const EMPTY_TRANSMISSION_SEED: TransmissionSeedFile = {
  version: "0.2.0-v2c",
  purpose:
    "CatalogRegistry-compatible transmission foundation. Empty until verified LIVE apply.",
  records: [],
  notes: [
    "Do not invent transmissionCode from marketing names (DSG/S-Tronic/etc.).",
    "Prefer generation/engine scoped records.",
    "Ingest adapters emit dry-run candidates only.",
    "CVT ≠ E_CVT. SINGLE_SPEED_EV for BEV — do not fake automatic.",
  ],
};

export function buildTransmissionCandidate(input: {
  brandId: string;
  modelId: string;
  generationId: string;
  engineId?: string | null;
  marketingName: string;
  canonicalName?: string;
  aliases?: string[];
  gearCount?: number | null;
  driveType?: string | null;
  clutchType?: string | null;
  manufacturerCode?: string | null;
  transmissionCode?: string | null;
  transmissionFamily?: TransmissionFamily | null;
  yearFrom?: number | null;
  yearTo?: number | null;
  marketScope?: string[];
  electrification?: string | null;
  provenance: AutomotiveTransmissionCandidate["provenance"];
  confidence?: "HIGH" | "MEDIUM" | "LOW";
  verificationStatus?: string;
  notes?: string | null;
}): AutomotiveTransmissionCandidate {
  const family =
    input.transmissionFamily ??
    inferTransmissionFamily(input.marketingName, {
      electrification: input.electrification,
    });
  const code = sanitizeTransmissionCode(input.transmissionCode);
  const manufacturerCode = sanitizeTransmissionCode(input.manufacturerCode);
  const aliases = [
    ...(input.aliases ?? []),
    ...commercialAliasesForFamily(family),
  ].filter((a, i, arr) => arr.findIndex((b) => b.toLowerCase() === a.toLowerCase()) === i);

  const idParts = [
    "tx",
    input.brandId.replace(/^brand_/, ""),
    input.modelId.replace(/^model_/, ""),
    input.generationId.replace(/^generation_/, "").slice(0, 48),
    input.marketingName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 40),
    input.gearCount != null ? `${input.gearCount}g` : "g?",
  ];

  const txType = familyToType(family);
  const verificationStatus =
    input.verificationStatus ??
    input.provenance.verificationStatus ??
    (code ? "code-present-unverified" : "marketing-label-only");

  return {
    id: idParts.join("_"),
    brandId: input.brandId,
    modelId: input.modelId,
    generationId: input.generationId,
    engineId: input.engineId ?? null,
    canonicalName: input.canonicalName ?? input.marketingName,
    marketingName: input.marketingName,
    aliases,
    transmissionFamily: family,
    transmissionType: txType,
    type: txType,
    gearCount: input.gearCount ?? null,
    driveType: input.driveType ?? null,
    clutchType: input.clutchType ?? null,
    manufacturerCode,
    transmissionCode: code,
    yearFrom: input.yearFrom ?? null,
    yearTo: input.yearTo ?? null,
    marketScope: input.marketScope ?? [],
    provenance: {
      ...input.provenance,
      verificationStatus,
    },
    confidence: input.confidence ?? "MEDIUM",
    verificationStatus,
    notes:
      input.notes ??
      (code == null && /dsg|s-tronic|pdk|edc|e-?cvt/i.test(input.marketingName)
        ? "Marketing transmission label only — transmissionCode left null."
        : null),
  };
}

/** Map candidate → production-shaped record (for dry-run delta preview). */
export function candidateToTransmissionRecord(
  c: AutomotiveTransmissionCandidate,
): AutomotiveTransmissionRecord {
  return {
    id: c.id,
    brandId: c.brandId,
    modelId: c.modelId,
    generationId: c.generationId,
    engineId: c.engineId ?? null,
    canonicalName: c.canonicalName,
    marketingName: c.marketingName,
    aliases: c.aliases,
    transmissionFamily: c.transmissionFamily,
    transmissionType: c.transmissionType,
    gearCount: c.gearCount,
    transmissionCode: c.transmissionCode,
    manufacturerCode: c.manufacturerCode ?? null,
    driveType: c.driveType ?? null,
    clutchType: c.clutchType ?? null,
    yearFrom: c.yearFrom,
    yearTo: c.yearTo,
    marketScope: c.marketScope,
    provenance: {
      type: c.provenance.type,
      confidence: c.provenance.confidence,
      verificationStatus: c.verificationStatus,
      sourceRef: c.provenance.sourceRef,
    },
    confidence: c.confidence,
    verificationStatus: c.verificationStatus,
    notes: c.notes ?? null,
  };
}
