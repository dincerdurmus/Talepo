/**
 * Precision-first canonical matching against existing catalogs / in-run indexes.
 * No aggressive fuzzy matching.
 */

import { ensureAutomotiveCatalogRegistered } from "@/lib/catalog";
import { getAutomotiveIndexes } from "@/lib/catalog/automotive/indexes";
import { foldCatalogKey, normalizeCatalogKey } from "@/lib/catalog/normalize";

import type { IngestRecord } from "../types";
import type { CanonicalMapResult, CanonicalMatchStatus } from "./types";

export type GenericEntityIndex = {
  byId: Map<string, { id: string; brand?: string; model?: string; family?: string }>;
  byAlias: Map<string, string[]>;
  byScoped: Map<string, string[]>;
};

export function createEmptyGenericIndex(): GenericEntityIndex {
  return {
    byId: new Map(),
    byAlias: new Map(),
    byScoped: new Map(),
  };
}

export function registerGenericEntity(
  index: GenericEntityIndex,
  entity: {
    id: string;
    brand?: string;
    model?: string;
    family?: string;
    aliases?: string[];
    categoryId?: string;
  },
): void {
  index.byId.set(entity.id, entity);
  const scoped = [
    entity.categoryId ?? "",
    entity.brand ? foldCatalogKey(entity.brand) : "",
    entity.family ? foldCatalogKey(entity.family) : "",
    entity.model ? foldCatalogKey(entity.model) : "",
  ]
    .filter(Boolean)
    .join("|");
  if (scoped) {
    const list = index.byScoped.get(scoped) ?? [];
    list.push(entity.id);
    index.byScoped.set(scoped, list);
  }
  for (const alias of entity.aliases ?? []) {
    const key = foldCatalogKey(alias);
    if (!key) continue;
    const list = index.byAlias.get(key) ?? [];
    list.push(entity.id);
    index.byAlias.set(key, list);
  }
  if (entity.model) {
    const key = foldCatalogKey(entity.model);
    const list = index.byAlias.get(key) ?? [];
    list.push(entity.id);
    index.byAlias.set(key, list);
  }
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

export function matchExistingAutomotive(input: {
  brand?: string | null;
  model?: string | null;
  generation?: string | null;
  existingId?: string | null;
}): CanonicalMapResult {
  ensureAutomotiveCatalogRegistered();
  const idx = getAutomotiveIndexes();
  const reasons: CanonicalMapResult["reasons"] = [];

  if (input.existingId) {
    if (
      idx.brandById.has(input.existingId) ||
      idx.modelById.has(input.existingId) ||
      idx.generationById.has(input.existingId) ||
      idx.engineById.has(input.existingId)
    ) {
      return {
        record: {
          id: input.existingId,
          categoryId: "automotive",
          kind: "entity",
          payload: {},
          provenance: {
            sourceType: "TRUSTED_DATASET",
            sourceName: "automotive-catalog",
            confidence: "HIGH",
            verificationStatus: "exact_id",
          },
        },
        status: "EXISTING",
        canonicalId: input.existingId,
        matchMode: "exact_id",
      };
    }
  }

  let brandId: string | undefined;
  if (input.brand) {
    const brandFold = foldCatalogKey(input.brand);
    const brandNorm = normalizeCatalogKey(input.brand);
    const exact = idx.brands.filter(
      (b) =>
        foldCatalogKey(b.name) === brandFold ||
        normalizeCatalogKey(b.name) === brandNorm ||
        (b.aliases ?? []).some(
          (a) =>
            foldCatalogKey(a) === brandFold || normalizeCatalogKey(a) === brandNorm,
        ),
    );
    if (exact.length === 1) brandId = exact[0].id;
    else if (exact.length > 1) {
      return {
        record: dummyAutomotiveRecord(input),
        status: "AMBIGUOUS",
        reasons: ["AMBIGUOUS"],
        matchMode: "alias",
      };
    }
  }

  let modelId: string | undefined;
  if (input.model) {
    const modelFold = foldCatalogKey(input.model);
    const modelNorm = normalizeCatalogKey(input.model);
    const pool = brandId
      ? (idx.modelsByBrand.get(brandId) ?? [])
      : idx.models;
    const hits = pool.filter(
      (m) =>
        foldCatalogKey(m.name) === modelFold ||
        normalizeCatalogKey(m.name) === modelNorm ||
        (m.aliases ?? []).some(
          (a) =>
            foldCatalogKey(a) === modelFold || normalizeCatalogKey(a) === modelNorm,
        ),
    );
    if (hits.length === 1) {
      modelId = hits[0].id;
      brandId = brandId ?? hits[0].brand_id;
    } else if (hits.length > 1) {
      return {
        record: dummyAutomotiveRecord(input),
        status: "AMBIGUOUS",
        reasons: ["AMBIGUOUS_MODEL"],
        matchMode: "alias",
      };
    }
  }

  let generationId: string | undefined;
  if (input.generation && modelId) {
    const genFold = foldCatalogKey(input.generation);
    const gens = idx.generationsByModel.get(modelId) ?? [];
    const hits = gens.filter(
      (g) =>
        foldCatalogKey(g.name) === genFold ||
        (g.aliases ?? []).some((a) => foldCatalogKey(a) === genFold) ||
        (g.platformCodes ?? []).some((c) => foldCatalogKey(c) === genFold),
    );
    if (hits.length === 1) generationId = hits[0].id;
    else if (hits.length > 1) {
      return {
        record: dummyAutomotiveRecord(input),
        status: "AMBIGUOUS",
        reasons: ["AMBIGUOUS"],
      };
    }
  }

  const canonicalId = generationId ?? modelId ?? brandId;
  if (canonicalId) {
    return {
      record: dummyAutomotiveRecord(input),
      status: "EXISTING",
      canonicalId,
      matchMode: modelId || brandId ? "alias" : "exact_id",
      relations: [
        ...(brandId ? [{ type: "brand", targetId: brandId }] : []),
        ...(modelId ? [{ type: "model", targetId: modelId }] : []),
        ...(generationId
          ? [{ type: "generation", targetId: generationId }]
          : []),
      ],
    };
  }

  if (input.brand || input.model) {
    return {
      record: dummyAutomotiveRecord(input),
      status: "NEW_CANDIDATE",
      reasons,
    };
  }

  return {
    record: dummyAutomotiveRecord(input),
    status: "NEW_CANDIDATE",
    reasons,
  };
}

function dummyAutomotiveRecord(input: {
  brand?: string | null;
  model?: string | null;
  generation?: string | null;
}): IngestRecord {
  return {
    id: "tmp-auto-match",
    categoryId: "automotive",
    kind: "entity",
    payload: {
      brand: input.brand ?? undefined,
      model: input.model ?? undefined,
      generation: input.generation ?? undefined,
    },
    provenance: {
      sourceType: "TRUSTED_DATASET",
      sourceName: "canonical-mapper",
      confidence: "HIGH",
      verificationStatus: "internal",
    },
  };
}

export function matchExistingGeneric(
  record: IngestRecord,
  index: GenericEntityIndex,
  opts?: { inScope?: boolean },
): CanonicalMapResult {
  if (opts?.inScope === false) {
    return {
      record,
      status: "OUT_OF_SCOPE",
      reasons: ["OUT_OF_SCOPE"],
    };
  }

  const existingId =
    typeof record.payload.existingCanonicalId === "string"
      ? record.payload.existingCanonicalId
      : typeof record.payload.canonicalId === "string"
        ? record.payload.canonicalId
        : undefined;
  if (existingId && index.byId.has(existingId)) {
    return {
      record,
      status: "EXISTING",
      canonicalId: existingId,
      matchMode: "exact_id",
    };
  }

  const brand =
    typeof record.payload.brand === "string" ? record.payload.brand : "";
  const model =
    typeof record.payload.model === "string" ? record.payload.model : "";
  const family =
    typeof record.payload.family === "string"
      ? record.payload.family
      : typeof record.payload.productFamily === "string"
        ? record.payload.productFamily
        : "";

  const scoped = [
    record.categoryId,
    brand ? foldCatalogKey(brand) : "",
    family ? foldCatalogKey(family) : "",
    model ? foldCatalogKey(model) : "",
  ]
    .filter(Boolean)
    .join("|");

  if (scoped) {
    const scopedHits = uniqueIds(index.byScoped.get(scoped) ?? []);
    if (scopedHits.length === 1) {
      return {
        record,
        status: "EXISTING",
        canonicalId: scopedHits[0],
        matchMode: "scoped_normalized",
      };
    }
    if (scopedHits.length > 1) {
      return {
        record,
        status: "AMBIGUOUS",
        reasons: ["AMBIGUOUS", "POSSIBLE_DUPLICATE"],
        matchMode: "scoped_normalized",
      };
    }
  }

  if (model) {
    const aliasHits = uniqueIds(index.byAlias.get(foldCatalogKey(model)) ?? []);
    if (aliasHits.length === 1) {
      return {
        record,
        status: "EXISTING",
        canonicalId: aliasHits[0],
        matchMode: "alias",
      };
    }
    if (aliasHits.length > 1) {
      return {
        record,
        status: "AMBIGUOUS",
        reasons: ["AMBIGUOUS_MODEL"],
        matchMode: "alias",
      };
    }
  }

  return { record, status: "NEW_CANDIDATE" };
}

export function mapIngestRecord(
  record: IngestRecord,
  genericIndex: GenericEntityIndex,
): CanonicalMapResult {
  if (record.payload.outOfScope === true) {
    return {
      record,
      status: "OUT_OF_SCOPE",
      reasons: ["OUT_OF_SCOPE"],
    };
  }

  if (record.categoryId === "automotive") {
    const mapped = matchExistingAutomotive({
      brand:
        typeof record.payload.brand === "string" ? record.payload.brand : null,
      model:
        typeof record.payload.model === "string" ? record.payload.model : null,
      generation:
        typeof record.payload.generation === "string"
          ? record.payload.generation
          : null,
      existingId:
        typeof record.payload.existingCanonicalId === "string"
          ? record.payload.existingCanonicalId
          : typeof record.payload.canonicalId === "string"
            ? record.payload.canonicalId
            : null,
    });
    return { ...mapped, record };
  }

  return matchExistingGeneric(record, genericIndex);
}

export function statusToClassificationHints(status: CanonicalMatchStatus): {
  ambiguous?: boolean;
  duplicate?: boolean;
  outOfScope?: boolean;
} {
  if (status === "AMBIGUOUS") return { ambiguous: true };
  if (status === "EXISTING") return { duplicate: false };
  if (status === "OUT_OF_SCOPE") return { outOfScope: true };
  return {};
}
