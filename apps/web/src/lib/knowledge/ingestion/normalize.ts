/**
 * Ingestion normalize — wraps catalog normalize utilities.
 * No parallel normalizer system.
 */

import {
  catalogSlug,
  foldCatalogKey,
  normalizeCatalogKey,
} from "@/lib/catalog/normalize";

import type { IngestRecord } from "../types";
import type { NormalizeResult } from "./types";

export { catalogSlug, foldCatalogKey, normalizeCatalogKey };

/** Storage tokens → canonical attribute (no SKU explosion). */
export function normalizeStorageGb(raw: string | number | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const folded = foldCatalogKey(s).replace(/\s+/g, "");
  const tb = folded.match(/^(\d+(?:\.\d+)?)tb$/);
  if (tb) return `${Math.round(Number(tb[1]) * 1024)}GB`;
  const gb = folded.match(/^(\d+(?:\.\d+)?)gb$/);
  if (gb) return `${Number(gb[1])}GB`;
  const bare = folded.match(/^(\d+)$/);
  if (bare) return `${bare[1]}GB`;
  return null;
}

export function normalizeRamGb(raw: string | number | null | undefined): string | null {
  return normalizeStorageGb(raw)?.replace(/GB$/i, "GB") ?? null;
}

export function normalizeMeasurement(
  raw: string | number | null | undefined,
  unitHint?: string,
): { value: number; unit: string } | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const m = s.match(/(-?\d+(?:[.,]\d+)?)\s*([a-zA-Zµμ°/%]+)?/);
  if (!m) return null;
  const value = Number(m[1].replace(",", "."));
  if (!Number.isFinite(value)) return null;
  const unit = (m[2] || unitHint || "").trim();
  return { value, unit };
}

export function scopedNormalizedKey(parts: Array<string | null | undefined>): string {
  return parts
    .map((p) => (p == null ? "" : foldCatalogKey(String(p))))
    .filter(Boolean)
    .join("|");
}

export function normalizeIngestRecord(record: IngestRecord): NormalizeResult {
  const payload = { ...record.payload };
  const brand =
    typeof payload.brand === "string" ? payload.brand : undefined;
  const model =
    typeof payload.model === "string" ? payload.model : undefined;
  const family =
    typeof payload.family === "string"
      ? payload.family
      : typeof payload.productFamily === "string"
        ? payload.productFamily
        : undefined;
  const series =
    typeof payload.series === "string" ? payload.series : undefined;
  const generation =
    typeof payload.generation === "string" ? payload.generation : undefined;

  const brandNorm = brand ? normalizeCatalogKey(brand) : undefined;
  const brandFold = brand ? foldCatalogKey(brand) : undefined;
  const modelNorm = model ? normalizeCatalogKey(model) : undefined;
  const modelFold = model ? foldCatalogKey(model) : undefined;
  const familyNorm = family ? normalizeCatalogKey(family) : undefined;
  const seriesNorm = series ? normalizeCatalogKey(series) : undefined;
  const generationNorm = generation
    ? normalizeCatalogKey(generation)
    : undefined;

  if (payload.storage != null) {
    const storage = normalizeStorageGb(payload.storage as string | number);
    if (storage) payload.storageNormalized = storage;
  }
  if (payload.ram != null) {
    const ram = normalizeRamGb(payload.ram as string | number);
    if (ram) payload.ramNormalized = ram;
  }

  const canonicalKey =
    typeof payload.canonicalKey === "string" && payload.canonicalKey.trim()
      ? payload.canonicalKey
      : scopedNormalizedKey([
          record.categoryId,
          brandFold,
          familyNorm,
          seriesNorm,
          modelFold,
          generationNorm,
        ]) || record.id;

  const normalized: Record<string, unknown> = {
    ...payload,
    brandNorm,
    brandFold,
    modelNorm,
    modelFold,
    familyNorm,
    seriesNorm,
    generationNorm,
    canonicalKey,
    slug: catalogSlug(
      [brand, family, series, model, generation].filter(Boolean).join(" "),
    ),
  };

  const next: IngestRecord = {
    ...record,
    payload: {
      ...payload,
      canonicalKey,
      brandNorm,
      brandFold,
      modelNorm,
      modelFold,
      familyNorm,
      seriesNorm,
      generationNorm,
    },
  };

  return {
    record: next,
    normalized,
    stage: "NORMALIZED",
  };
}

export function toCanonicalCandidate(
  normalized: NormalizeResult,
  opts?: { existingCanonicalId?: string; matchStatus?: string },
): NormalizeResult {
  return {
    record: {
      ...normalized.record,
      payload: {
        ...normalized.record.payload,
        ...normalized.normalized,
        existingCanonicalId: opts?.existingCanonicalId,
        matchStatus: opts?.matchStatus,
        stage: "CANONICAL_CANDIDATE",
      },
    },
    normalized: {
      ...normalized.normalized,
      existingCanonicalId: opts?.existingCanonicalId,
      matchStatus: opts?.matchStatus,
      stage: "CANONICAL_CANDIDATE",
    },
    stage: "CANONICAL_CANDIDATE",
  };
}
