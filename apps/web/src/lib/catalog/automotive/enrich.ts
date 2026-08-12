import { isNegatedMention } from "@/lib/ai/parser/negation";
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
  findTransmissionsInText,
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

function catalogModelOnlyNegated(
  text: string,
  record: { name: string; aliases?: string[] },
): boolean {
  const surfaces = [record.name, ...(record.aliases ?? [])].filter(Boolean);
  let positive = false;
  let negative = false;
  for (const surface of surfaces) {
    const needle = surface.trim();
    if (!needle) continue;
    const re = new RegExp(
      `(?:^|[^a-zçğıöşü0-9])${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^a-zçğıöşü0-9])`,
      "gi",
    );
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (isNegatedMention(text, m.index, m[0].length)) negative = true;
      else positive = true;
    }
  }
  return negative && !positive;
}

function compactOrFamilyName(
  text: string,
  inferred: { record: { name: string }; matchedPhrase?: string },
): string {
  const phrase = (inferred.matchedPhrase ?? "").replace(/\s+/g, "");
  if (
    /^[a-z]?\d{2,3}[a-z]?$/i.test(phrase) ||
    /^\d{3}[ijd]$/i.test(phrase)
  ) {
    if (/^\d{3}[ijd]$/i.test(phrase)) {
      return `${phrase.slice(0, 3)}${phrase.slice(3).toLowerCase()}`;
    }
    return phrase.toUpperCase();
  }
  const compactInText = text.match(/\b(\d{3}[ijd]|[cesagl]\d{3})\b/i);
  if (compactInText?.[1]) {
    const tok = compactInText[1];
    if (/^\d{3}[ijd]$/i.test(tok)) {
      return `${tok.slice(0, 3)}${tok.slice(3).toLowerCase()}`;
    }
    return tok.toUpperCase();
  }
  return inferred.record.name;
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
 * Transmission is catalog-resolved only (brand→model→generation→engine scoped).
 * Soft family hints never invent transmissionCode. Does not invent OEM / compatibility.
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
  let modelHit = findModelInText(text, brandHit?.record.id ?? null);
  if (modelHit && catalogModelOnlyNegated(text, modelHit.record)) {
    modelHit = null;
  }

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
        matchedPhrase: "",
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

  const txHit = findTransmissionsInText(
    text,
    {
      brandId: inferredBrand?.record.id ?? null,
      modelId: inferredModel?.record.id ?? null,
      generationId:
        generation?.status === "resolved" ? generation.id ?? null : null,
      engineId: engine?.status === "resolved" ? engine.id ?? null : null,
    },
    year,
  );

  if (txHit.status === "unresolved" && txHit.raw) {
    if (!unresolved.includes(txHit.raw)) unresolved.push(txHit.raw);
  }

  let transmission: AutomotiveSubjectEnrichment["transmission"];
  if (txHit.status === "resolved" && txHit.record) {
    const rec = txHit.record;
    transmission = {
      id: rec.id,
      canonicalName: rec.canonicalName,
      marketingName: rec.marketingName,
      transmissionFamily: rec.transmissionFamily,
      transmissionType: rec.transmissionType,
      gearCount: rec.gearCount,
      transmissionCode: rec.transmissionCode,
      confidence: txHit.confidence,
      matchMode: txHit.matchMode,
      matchKind: txHit.matchKind,
      status: "resolved",
      yearConsistent: txHit.yearConsistent,
    };
  } else if (txHit.status === "ambiguous" && txHit.candidates?.length) {
    transmission = {
      marketingName: txHit.candidates[0]!.marketingName,
      transmissionFamily: txHit.candidates[0]!.transmissionFamily,
      gearCount: txHit.candidates[0]!.gearCount,
      confidence: "medium",
      matchMode: txHit.matchMode,
      matchKind: txHit.matchKind,
      status: "ambiguous",
      raw: txHit.raw,
      candidates: txHit.candidates.map((c) => ({
        id: c.id,
        marketingName: c.marketingName,
        transmissionFamily: c.transmissionFamily,
        gearCount: c.gearCount,
      })),
    };
  } else if (txHit.familyHint || txHit.raw) {
    // Soft hint only — no catalog id, code stays null unless verified hint.
    transmission = {
      marketingName: txHit.raw,
      transmissionFamily: txHit.familyHint,
      gearCount: txHit.gearCountHint ?? null,
      transmissionCode: txHit.transmissionCodeHint ?? null,
      confidence: "unverified",
      matchKind: "family_hint",
      status: "unverified",
      raw: txHit.raw,
    };
  }

  const resolved: CatalogConfidence[] = [];
  if (inferredBrand) resolved.push(inferredBrand.confidence);
  if (inferredModel) resolved.push(inferredModel.confidence);
  if (generation?.status === "resolved") resolved.push(generation.confidence);
  if (engine?.status === "resolved") resolved.push(engine.confidence);
  if (transmission?.status === "resolved") resolved.push(transmission.confidence);
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
      name: compactOrFamilyName(text, inferredModel),
      confidence: inferredModel.confidence,
      matchMode: inferredModel.matchMode,
    };
  }

  if (generation) result.generation = generation;
  if (year) result.modelYear = year;
  if (engine) result.engine = engine;
  if (transmission) result.transmission = transmission;

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
