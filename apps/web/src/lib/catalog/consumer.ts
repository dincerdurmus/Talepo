/**
 * Canonical catalog consumer — the only place matching / price / alerts
 * should read catalog facts later. Does not re-understand the request.
 *
 * Persistence: Request has no metadata JSON bag. Full facts (ids, confidence)
 * stay on the understanding result this phase. Display labels may soft-fill
 * existing form fields and persist via RequestFieldValue on publish.
 */
import type { RequestUnderstandingResult } from "@/lib/request-understanding/types";

import type { CatalogConfidence, CatalogDomainId } from "./types";

const FILLABLE: CatalogConfidence[] = ["exact", "high"];

export type CanonicalCatalogBrand = { id: string; label: string };
export type CanonicalCatalogModel = { id: string; label: string };
export type CanonicalCatalogGeneration = { id: string; label: string };
export type CanonicalCatalogEngine = {
  id: string;
  marketingName: string;
  powerKw?: number;
  fuelType?: string;
};
export type CanonicalCatalogPart = { id: string; label: string };
export type CanonicalCatalogPosition = { id: string; label: string };

export type CanonicalCatalogFacts = {
  domainId: CatalogDomainId;
  brand?: CanonicalCatalogBrand;
  model?: CanonicalCatalogModel;
  generation?: CanonicalCatalogGeneration;
  modelYear?: number;
  engine?: CanonicalCatalogEngine;
  part?: CanonicalCatalogPart;
  position?: CanonicalCatalogPosition;
  confidence: CatalogConfidence;
  unresolvedTokens?: string[];
  source: "FUTURE_KNOWLEDGE";
};

export type CatalogPreviewBlock = {
  label: string;
  title: string;
  detail?: string;
};

export type CatalogPreviewModel = {
  vehicle?: CatalogPreviewBlock;
  soughtPart?: CatalogPreviewBlock;
};

function fold(value: string): string {
  return value.toLocaleLowerCase("tr-TR");
}

function isFillable(
  confidence: CatalogConfidence | undefined,
  allowMedium = false,
): boolean {
  if (!confidence) return false;
  if (FILLABLE.includes(confidence)) return true;
  return allowMedium && confidence === "medium";
}

export function titleCaseTr(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const head = word.charAt(0).toLocaleUpperCase("tr-TR");
      const tail = word.slice(1).toLocaleLowerCase("tr-TR");
      return `${head}${tail}`;
    })
    .join(" ");
}

/** Compose "Ön Sağ Far" from position + part without repeating ön/arka. */
export function composeSoughtPartLabel(
  facts: Pick<CanonicalCatalogFacts, "part" | "position">,
): string | undefined {
  if (!facts.part && !facts.position) return undefined;
  if (!facts.part) return titleCaseTr(facts.position!.label);
  const part = titleCaseTr(facts.part.label);
  if (!facts.position) return part;

  const pos = titleCaseTr(facts.position.label);
  const partFold = ` ${fold(part)} `;
  const posFold = fold(pos);
  if (partFold.includes(` ${posFold} `)) return part;

  let rest = part;
  for (const side of ["ön", "arka", "sol", "sağ"]) {
    const restFold = fold(rest);
    if (!posFold.includes(side)) continue;
    if (restFold === side) {
      rest = "";
      continue;
    }
    if (restFold.startsWith(`${side} `)) {
      rest = rest.slice(side.length).trim();
    }
  }
  return [pos, rest].filter(Boolean).join(" ");
}

/**
 * Displayable / fillable catalog facts only.
 * Generation + engine require resolved + EXACT/HIGH.
 * Part may include MEDIUM (same rule as apply-enrichment).
 * Never invents engineCode. Never promotes unverified engines.
 */
export function toCanonicalCatalogFacts(
  result: RequestUnderstandingResult,
): CanonicalCatalogFacts | null {
  const enrichment = result.catalogEnrichment;
  if (!enrichment) return null;

  const facts: CanonicalCatalogFacts = {
    domainId: enrichment.domainId,
    confidence: enrichment.confidence,
    source: "FUTURE_KNOWLEDGE",
  };

  if (enrichment.brand && isFillable(enrichment.brand.confidence) && enrichment.brand.id) {
    facts.brand = { id: enrichment.brand.id, label: enrichment.brand.name };
  }
  if (enrichment.model && isFillable(enrichment.model.confidence) && enrichment.model.id) {
    facts.model = { id: enrichment.model.id, label: enrichment.model.name };
  }

  const generation = enrichment.generation;
  if (
    generation?.status === "resolved" &&
    generation.id &&
    generation.name &&
    isFillable(generation.confidence)
  ) {
    facts.generation = { id: generation.id, label: generation.name };
  }

  if (typeof enrichment.modelYear === "number" && Number.isFinite(enrichment.modelYear)) {
    facts.modelYear = enrichment.modelYear;
  }

  const engine = enrichment.engine;
  if (
    engine?.status === "resolved" &&
    engine.id &&
    engine.marketingName &&
    isFillable(engine.confidence)
  ) {
    facts.engine = {
      id: engine.id,
      marketingName: engine.marketingName,
      ...(engine.powerKw != null ? { powerKw: engine.powerKw } : {}),
      ...(engine.fuelType ? { fuelType: engine.fuelType } : {}),
    };
  }

  if (
    enrichment.part &&
    isFillable(enrichment.part.confidence, true) &&
    enrichment.part.id
  ) {
    facts.part = { id: enrichment.part.id, label: enrichment.part.name };
  }

  if (
    enrichment.position &&
    isFillable(enrichment.position.confidence) &&
    enrichment.position.id
  ) {
    facts.position = {
      id: enrichment.position.id,
      label: enrichment.position.name,
    };
  }

  if (enrichment.unresolvedTokens?.length) {
    facts.unresolvedTokens = [...enrichment.unresolvedTokens];
  }

  if (
    !facts.brand &&
    !facts.model &&
    !facts.generation &&
    facts.modelYear == null &&
    !facts.engine &&
    !facts.part &&
    !facts.position
  ) {
    return null;
  }

  return facts;
}

const EXPLICIT_GENERIC_PARTS = new Set(["parça", "parca", "yedek parça", "yedek parca"]);

function isStructuredOverride(
  existing: { provenance?: string; source?: string; value?: unknown } | undefined,
): boolean {
  if (!existing?.value || existing.source !== "STRUCTURED_FIELD") return false;
  return Boolean(String(existing.value).trim());
}

function isProtectedExplicit(
  existing: { provenance?: string; source?: string; value?: unknown } | undefined,
  catalogLabel: string,
  opts?: { allowGenericPart?: boolean },
): boolean {
  if (!isStructuredOverride(existing)) return false;
  const current = String(existing!.value).trim();
  if (opts?.allowGenericPart && EXPLICIT_GENERIC_PARTS.has(fold(current))) {
    return false;
  }
  if (fold(current) === fold(catalogLabel)) return false;
  return true;
}

function joinUniqueLabels(parts: Array<string | undefined>): string {
  const out: string[] = [];
  for (const part of parts) {
    if (!part?.trim()) continue;
    const prev = out[out.length - 1];
    if (prev && fold(prev) === fold(part)) continue;
    out.push(part.trim());
  }
  return out.join(" ");
}

/** Soft-fill empty / non-EXPLICIT draft fields. Never overwrites EXPLICIT user values. */
export function seedCatalogFactsIntoFields(
  result: RequestUnderstandingResult,
  seeded: Record<string, string>,
): Record<string, string> {
  const facts = toCanonicalCatalogFacts(result);
  if (!facts) return seeded;

  const fill = (
    key: string,
    value: string | undefined,
    existing?: { provenance?: string; source?: string; value?: unknown },
    opts?: { allowGenericPart?: boolean },
  ) => {
    if (!value) return;
    if (isProtectedExplicit(existing, value, opts)) {
      if (existing?.value != null && String(existing.value).trim()) {
        seeded[key] = String(existing.value).trim();
      }
      return;
    }
    if (
      key === "part" &&
      existing?.provenance === "EXPLICIT" &&
      existing.source === "STRUCTURED_FIELD"
    ) {
      return;
    }
    if (key === "part") {
      seeded[key] = value;
      return;
    }
    seeded[key] = value;
  };

  fill(
    "brand",
    facts.brand?.label,
    result.attributes.brand ?? result.identity.brand,
  );
  fill(
    "model",
    facts.model?.label,
    result.attributes.model ?? result.identity.model,
  );
  fill("generation", facts.generation?.label, result.attributes.generation);
  fill(
    "modelYear",
    facts.modelYear != null ? String(facts.modelYear) : undefined,
    result.attributes.modelYear,
  );
  fill("engine", facts.engine?.marketingName, result.attributes.engine);
  fill(
    "part",
    composeSoughtPartLabel(facts),
    result.attributes.part,
    { allowGenericPart: true },
  );
  fill(
    "partPosition",
    facts.position ? titleCaseTr(facts.position.label) : undefined,
    result.requestSubject?.position,
  );

  return seeded;
}

/**
 * Premium /talep preview blocks. No IDs, no confidence, no sources.
 * Unknown catalog facts simply omit the line — never block publish.
 */
export function toCatalogPreviewModel(
  result: RequestUnderstandingResult,
): CatalogPreviewModel | null {
  const facts = toCanonicalCatalogFacts(result);
  if (!facts) return null;

  const structuredBrand = result.attributes.brand;
  const structuredModel = result.attributes.model;
  const brandLabel = isStructuredOverride(structuredBrand)
    ? String(structuredBrand!.value)
    : facts.brand?.label;
  const modelLabel = isStructuredOverride(structuredModel)
    ? String(structuredModel!.value)
    : facts.model?.label;

  const title = joinUniqueLabels([brandLabel, modelLabel]);
  const detail = [
    facts.generation?.label,
    facts.modelYear != null ? String(facts.modelYear) : null,
    facts.engine?.marketingName,
  ]
    .filter(Boolean)
    .join(" · ");

  const vehicle =
    title || detail
      ? {
          label: "Araç",
          title: title || detail,
          ...(title && detail ? { detail } : {}),
        }
      : undefined;

  const partTitle = composeSoughtPartLabel(facts);
  const soughtPart = partTitle
    ? { label: "Aranan parça", title: partTitle }
    : undefined;

  if (!vehicle && !soughtPart) return null;
  return { vehicle, soughtPart };
}

export const CATALOG_PREVIEW_CHIP_KEYS = new Set([
  "brand",
  "model",
  "modelYear",
  "generation",
  "engine",
  "part",
  "partPosition",
]);
