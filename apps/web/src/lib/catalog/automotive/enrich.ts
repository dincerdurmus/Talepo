import type { CatalogConfidence } from "../types";
import { foldCatalogKey } from "../normalize";
import {
  extractChassisLikeTokens,
  extractModelYear,
  extractOemCandidates,
  extractUnverifiedGenerationRaw,
  findBrandInText,
  findEnginesInText,
  findGenerationInText,
  findModelInText,
  findPartsInText,
  findPositionInText,
  getAutomotiveIndexes,
} from "./indexes";
import { lookupAutomotiveOem } from "./oem";
import type { AutomotiveSubjectEnrichment } from "./types";

const GENERIC_PART_FOLDS = new Set([
  "filtre",
  "kapak",
  "motor",
  "kart",
  "kablo",
  "pompa",
  "hortum",
  "sensor",
  "sensör",
]);

function normalizeConsumed(phrase: string): string[] {
  return phrase
    .toLocaleLowerCase("tr-TR")
    .split(/[^a-z0-9çğıöşü]+/i)
    .filter(Boolean);
}

function rankConfidence(values: CatalogConfidence[]): CatalogConfidence {
  if (values.includes("exact") && !values.includes("medium") && !values.includes("low")) {
    return values.every((v) => v === "exact" || v === "high") ? "exact" : "high";
  }
  if (values.includes("high") || values.includes("exact")) return "high";
  if (values.includes("medium")) return "medium";
  if (values.includes("low")) return "low";
  return "unverified";
}

export type AutomotiveEnrichInput = {
  rawText: string;
  /** When true, short/generic part aliases may match. */
  automotiveContext?: boolean;
};

/**
 * Precision-first automotive enrichment from catalog indexes.
 * Generation is catalog-resolved only (never year-selected, never global).
 * Engine is catalog-resolved only (generation/model scoped, never invented).
 * Does not invent OEM / compatibility.
 */
export function enrichAutomotiveSubject(
  input: AutomotiveEnrichInput,
): AutomotiveSubjectEnrichment {
  const text = input.rawText.trim();
  const unresolved: string[] = [];
  const idx = getAutomotiveIndexes();

  const oemTokens = extractOemCandidates(text);
  const oem =
    oemTokens.length > 0
      ? lookupAutomotiveOem(oemTokens[0])
      : undefined;

  const brandHit = findBrandInText(text);
  const modelHit = findModelInText(text, brandHit?.record.id ?? null);

  let inferredBrand = brandHit;
  if (!inferredBrand && modelHit) {
    const brand = idx.brandById.get(modelHit.record.brand_id);
    if (brand) {
      inferredBrand = {
        record: brand,
        confidence: "high",
        matchMode: "normalized",
      };
    }
  }

  const year = extractModelYear(text);
  const genHit = findGenerationInText(
    text,
    {
      brandId: inferredBrand?.record.id ?? null,
      modelId: modelHit?.record.id ?? null,
    },
    year,
  );

  let inferredModel = modelHit;
  if (!inferredModel && genHit) {
    const model = idx.modelById.get(genHit.record.modelId);
    if (model) {
      inferredModel = {
        record: model,
        confidence: "high",
        matchMode: "normalized",
      };
    }
  }
  if (!inferredBrand && genHit) {
    const brand = idx.brandById.get(genHit.record.brandId);
    if (brand) {
      inferredBrand = {
        record: brand,
        confidence: "high",
        matchMode: "normalized",
      };
    }
  }

  const positionHit = findPositionInText(text);
  const partHits = findPartsInText(text);

  const autoContext =
    Boolean(input.automotiveContext) ||
    Boolean(brandHit) ||
    Boolean(modelHit) ||
    Boolean(genHit) ||
    Boolean(oem);

  let usableParts = partHits.filter((p) => {
    const fold = foldCatalogKey(p.record.name);
    const generic = [...GENERIC_PART_FOLDS].some(
      (g) => fold === g || fold.endsWith(` ${g}`),
    );
    if (generic && !autoContext) return false;
    if (p.record.name.length < 4 && p.matchMode === "alias" && !autoContext) {
      return false;
    }
    return true;
  });

  // Position-disambiguated lamp fallback (ön/arka + lamba)
  if (
    usableParts.length === 0 &&
    positionHit &&
    /(?:^|[^\p{L}\p{N}])(?:lamba|lambas[ıi]|headlamp)(?=[^\p{L}\p{N}]|$)/iu.test(
      text,
    )
  ) {
    const idxParts = idx.partByCanonicalFold;
    const front = positionHit.record.id.startsWith("front");
    const rear = positionHit.record.id.startsWith("rear");
    const lamp = front
      ? idxParts.get(foldCatalogKey("ön far"))
      : rear
        ? idxParts.get(foldCatalogKey("arka stop"))
        : null;
    if (lamp) {
      usableParts = [
        {
          record: lamp,
          confidence: "high",
          matchMode: "alias",
        },
      ];
    }
  }

  const topPart = usableParts[0];
  const sameLengthAlts =
    topPart
      ? usableParts.filter(
          (p) =>
            p.record.id !== topPart.record.id &&
            foldCatalogKey(p.record.name) !== foldCatalogKey(topPart.record.name),
        )
      : [];

  // Ambiguous equal aliases (xenon beyni → far beyni + xenon balast)
  const ambiguous =
    Boolean(topPart) &&
    sameLengthAlts.some((p) => p.matchMode === "alias" && topPart.matchMode === "alias");

  const consumed = new Set<string>();
  if (genHit) {
    const surfaces = [
      genHit.matchedPhrase,
      genHit.record.name,
      ...(genHit.record.aliases ?? []),
      ...(genHit.record.platformCodes ?? []),
    ];
    for (const surface of surfaces) {
      for (const tok of normalizeConsumed(surface)) consumed.add(tok);
    }
  }

  const leftoverChassis = extractChassisLikeTokens(text).filter((tok) => {
    return !consumed.has(tok.toLocaleLowerCase("tr-TR"));
  });
  for (const tok of leftoverChassis) {
    if (!unresolved.includes(tok)) unresolved.push(tok);
  }

  let generation: AutomotiveSubjectEnrichment["generation"];
  if (genHit) {
    generation = {
      id: genHit.record.id,
      name: genHit.record.name,
      raw: genHit.matchedPhrase,
      confidence: genHit.confidence,
      matchMode: genHit.matchMode,
      matchKind: genHit.matchKind,
      status: "resolved",
      yearConsistent: genHit.yearConsistent,
    };
  } else if (leftoverChassis.length > 0) {
    generation = {
      raw: leftoverChassis[0],
      confidence: "unverified",
      status: "unverified",
    };
  } else if (inferredModel) {
    const rawGen = extractUnverifiedGenerationRaw(text, inferredModel.record.name);
    if (rawGen) {
      generation = {
        raw: rawGen,
        confidence: "unverified",
        status: "unverified",
      };
      if (!unresolved.includes(rawGen)) unresolved.push(rawGen);
    }
  }

  const engineHit = findEnginesInText(
    text,
    {
      brandId: inferredBrand?.record.id ?? null,
      modelId: inferredModel?.record.id ?? null,
      generationId:
        generation?.status === "resolved" ? generation.id ?? null : null,
    },
    year,
  );

  if (engineHit.status === "unresolved" && engineHit.raw) {
    if (!unresolved.includes(engineHit.raw)) unresolved.push(engineHit.raw);
  }

  let engine: AutomotiveSubjectEnrichment["engine"];
  if (engineHit.status === "resolved" && engineHit.record) {
    const rec = engineHit.record;
    engine = {
      id: rec.id,
      marketingName: rec.marketingName,
      engineCode: rec.engineCode,
      displacementCc: rec.displacementCc,
      fuelType: rec.fuelType,
      powerKw: rec.powerKw,
      powerHp: rec.powerHp,
      electrification: rec.electrification,
      confidence: engineHit.confidence,
      matchMode: engineHit.matchMode,
      matchKind: engineHit.matchKind,
      status: "resolved",
      yearConsistent: engineHit.yearConsistent,
    };
  } else if (engineHit.status === "ambiguous" && engineHit.candidates?.length) {
    engine = {
      marketingName: engineHit.candidates[0].marketingName,
      confidence: "medium",
      matchMode: engineHit.matchMode,
      matchKind: engineHit.matchKind,
      status: "ambiguous",
      raw: engineHit.raw,
      candidates: engineHit.candidates.map((c) => ({
        id: c.id,
        marketingName: c.marketingName,
        powerKw: c.powerKw,
        powerHp: c.powerHp,
      })),
    };
  } else if (engineHit.raw) {
    engine = {
      raw: engineHit.raw,
      confidence: "unverified",
      status: "unverified",
    };
  }

  const resolved: CatalogConfidence[] = [];
  if (inferredBrand) resolved.push(inferredBrand.confidence);
  if (inferredModel) resolved.push(inferredModel.confidence);
  if (generation?.status === "resolved") resolved.push(generation.confidence);
  if (engine?.status === "resolved") resolved.push(engine.confidence);
  if (topPart) resolved.push(ambiguous ? "medium" : topPart.confidence);
  if (positionHit) resolved.push(positionHit.confidence);
  if (oem) resolved.push(oem.confidence);

  if (!inferredBrand && /[a-zçğıöşü]/i.test(text) && !inferredModel) {
    // leftover brand-like tokens are not marked unless we have a candidate
  }

  const result: AutomotiveSubjectEnrichment = {
    domainId: "automotive",
    confidence:
      inferredBrand || inferredModel || topPart || oem || generation?.status === "resolved"
        ? rankConfidence(resolved.length ? resolved : ["unverified"])
        : "unverified",
    unresolvedTokens: unresolved.length ? unresolved : undefined,
  };

  if (inferredBrand) {
    result.brand = {
      id: inferredBrand.record.id,
      name: inferredBrand.record.name,
      confidence: inferredBrand.confidence,
      matchMode: inferredBrand.matchMode,
    };
  } else if (text.trim() && !oem && (topPart || inferredModel)) {
    result.brand = undefined;
  }

  if (inferredModel) {
    result.model = {
      id: inferredModel.record.id,
      name: inferredModel.record.name,
      confidence: inferredModel.confidence,
      matchMode: inferredModel.matchMode,
    };
  }

  if (generation) result.generation = generation;
  if (year) result.modelYear = year;
  if (engine) result.engine = engine;

  if (topPart) {
    result.part = {
      id: topPart.record.id,
      name: topPart.record.name,
      systemId: topPart.record.systemId,
      systemNameTr: topPart.record.systemNameTr,
      confidence: ambiguous ? "medium" : topPart.confidence,
      matchMode: topPart.matchMode,
      alternatives: ambiguous
        ? sameLengthAlts.slice(0, 3).map((p) => ({
            id: p.record.id,
            name: p.record.name,
          }))
        : undefined,
    };
  }

  if (positionHit) {
    result.position = {
      id: positionHit.record.id,
      name: positionHit.record.tr,
      confidence: positionHit.confidence,
      matchMode: positionHit.matchMode,
    };
  }

  if (oem) {
    result.oem = {
      number: oem.number,
      status: oem.status,
      confidence: oem.confidence,
    };
  }

  return result;
}

export function hasAutomotiveCatalogSignal(
  enrichment: AutomotiveSubjectEnrichment,
): boolean {
  return Boolean(
    enrichment.brand ||
      enrichment.model ||
      enrichment.part ||
      enrichment.oem ||
      enrichment.position,
  );
}
