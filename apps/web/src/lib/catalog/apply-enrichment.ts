import { uv } from "@/lib/request-understanding/provenance";
import { isKnownAutomotiveModelName } from "@/lib/ai/parser/brand-catalog";
import { looksLikeYearToken } from "@/lib/request-understanding/number-role";
import type { RequestUnderstandingResult } from "@/lib/request-understanding/types";
import {
  enrichAutomotiveSubject,
  hasAutomotiveCatalogSignal,
} from "./automotive/enrich";
import type { AutomotiveSubjectEnrichment } from "./automotive/types";
import type { CatalogConfidence } from "./types";

const FILLABLE: CatalogConfidence[] = ["exact", "high"];

function catalogNumericConfidence(level: CatalogConfidence): number {
  switch (level) {
    case "exact":
      return 0.95;
    case "high":
      return 0.85;
    case "medium":
      return 0.7;
    case "low":
      return 0.45;
    default:
      return 0.2;
  }
}

function fold(value: string): string {
  return value.toLocaleLowerCase("tr-TR");
}

function mayOverwrite(
  existing: { value?: unknown; provenance?: string } | undefined,
  nextLabel: string,
): boolean {
  if (!existing?.value) return true;
  const current = String(existing.value);
  if (fold(current) === fold(nextLabel)) return true;
  // Catalog parent brand may replace a model token that was mis-slotted as brand
  if (isKnownAutomotiveModelName(current)) return true;
  // Year tokens are never identity — catalog may replace them
  if (looksLikeYearToken(current)) return true;
  // Never replace a different EXPLICIT user token
  if (existing.provenance === "EXPLICIT") return false;
  return true;
}

/**
 * Non-destructive catalog layer.
 * Never throws. Never blocks request creation. Never invents OEM.
 * Generation/engine never copy onto requestSubject (sought part stays the subject).
 * Displayable generation/engine may soft-fill attributes when not EXPLICIT.
 * Catalog fuel is not written over request-understanding fuel.
 */
export function applyCatalogEnrichment(
  result: RequestUnderstandingResult,
): RequestUnderstandingResult {
  try {
    const automotiveContext =
      result.category.value === "automotive" ||
      result.requestSubject.kind.value === "VEHICLE" ||
      result.requestSubject.parentEntity?.kind === "VEHICLE" ||
      result.subject.kind.value === "VEHICLE" ||
      result.subject.kind.value === "PART";

    const enrichment = enrichAutomotiveSubject({
      rawText: result.rawInput,
      automotiveContext,
    });

    const next: RequestUnderstandingResult = {
      ...result,
      catalogEnrichment: enrichment,
    };

    if (!hasAutomotiveCatalogSignal(enrichment)) {
      return next;
    }

    const identity = { ...next.identity };
    const attributes = { ...next.attributes };
    let requestSubject = { ...next.requestSubject };

    if (
      enrichment.brand &&
      FILLABLE.includes(enrichment.brand.confidence) &&
      mayOverwrite(identity.brand, enrichment.brand.name)
    ) {
      identity.brand = uv(enrichment.brand.name, {
        provenance: "INFERRED",
        source: "FUTURE_KNOWLEDGE",
        confidence: catalogNumericConfidence(enrichment.brand.confidence),
        evidence: [`catalog:${enrichment.brand.id}`, enrichment.brand.matchMode],
      });
    }

    if (
      enrichment.model &&
      FILLABLE.includes(enrichment.model.confidence) &&
      mayOverwrite(identity.model, enrichment.model.name)
    ) {
      identity.model = uv(enrichment.model.name, {
        provenance: "INFERRED",
        source: "FUTURE_KNOWLEDGE",
        confidence: catalogNumericConfidence(enrichment.model.confidence),
        evidence: [`catalog:${enrichment.model.id}`, enrichment.model.matchMode],
      });
    }

    if (enrichment.modelYear && !attributes.modelYear) {
      attributes.modelYear = uv(enrichment.modelYear, {
        provenance: "EXPLICIT",
        source: "USER_EXPLICIT",
        confidence: 0.9,
        evidence: [String(enrichment.modelYear)],
      });
    }

    if (
      enrichment.generation?.status === "resolved" &&
      enrichment.generation.name &&
      FILLABLE.includes(enrichment.generation.confidence) &&
      mayOverwrite(attributes.generation, enrichment.generation.name)
    ) {
      attributes.generation = uv(enrichment.generation.name, {
        provenance: "INFERRED",
        source: "FUTURE_KNOWLEDGE",
        confidence: catalogNumericConfidence(enrichment.generation.confidence),
        evidence: enrichment.generation.id
          ? [`catalog:${enrichment.generation.id}`]
          : ["catalog:generation"],
      });
    }

    if (
      enrichment.engine?.status === "resolved" &&
      enrichment.engine.marketingName &&
      FILLABLE.includes(enrichment.engine.confidence) &&
      mayOverwrite(attributes.engine, enrichment.engine.marketingName)
    ) {
      attributes.engine = uv(enrichment.engine.marketingName, {
        provenance: "INFERRED",
        source: "FUTURE_KNOWLEDGE",
        confidence: catalogNumericConfidence(enrichment.engine.confidence),
        evidence: enrichment.engine.id
          ? [`catalog:${enrichment.engine.id}`]
          : ["catalog:engine"],
      });
    }

    // Transmission soft-fill: never overwrite EXPLICIT user tokens (mayOverwrite).
    // Unresolved/family-hint transmissions do not write attributes.
    if (
      enrichment.transmission?.status === "resolved" &&
      enrichment.transmission.marketingName &&
      FILLABLE.includes(enrichment.transmission.confidence) &&
      mayOverwrite(
        attributes.transmission,
        enrichment.transmission.marketingName,
      )
    ) {
      attributes.transmission = uv(enrichment.transmission.marketingName, {
        provenance: "INFERRED",
        source: "FUTURE_KNOWLEDGE",
        confidence: catalogNumericConfidence(enrichment.transmission.confidence),
        evidence: enrichment.transmission.id
          ? [`catalog:${enrichment.transmission.id}`]
          : ["catalog:transmission"],
      });
    }

    if (
      enrichment.part &&
      (FILLABLE.includes(enrichment.part.confidence) ||
        enrichment.part.confidence === "medium")
    ) {
      const partLabel = enrichment.part.name;
      attributes.part = uv(partLabel, {
        provenance: "INFERRED",
        source: "FUTURE_KNOWLEDGE",
        confidence: catalogNumericConfidence(enrichment.part.confidence),
        evidence: [`catalog:${enrichment.part.id}`],
      });
      if (enrichment.part.systemNameTr) {
        attributes.partSystem = uv(enrichment.part.systemNameTr, {
          provenance: "INFERRED",
          source: "FUTURE_KNOWLEDGE",
          confidence: catalogNumericConfidence(enrichment.part.confidence),
          evidence: [enrichment.part.systemId],
        });
      }
      requestSubject = {
        ...requestSubject,
        name: uv(partLabel.toLocaleLowerCase("tr-TR"), {
          provenance: "INFERRED",
          source: "FUTURE_KNOWLEDGE",
          confidence: catalogNumericConfidence(enrichment.part.confidence),
          evidence: [`catalog:${enrichment.part.id}`],
        }),
        displayPhrase: uv(
          [enrichment.position?.name, partLabel.toLocaleLowerCase("tr-TR")]
            .filter(Boolean)
            .join(" "),
          {
            provenance: "INFERRED",
            source: "FUTURE_KNOWLEDGE",
            confidence: catalogNumericConfidence(enrichment.part.confidence),
            evidence: [`catalog:${enrichment.part.id}`],
          },
        ),
      };
    }

    if (enrichment.position && FILLABLE.includes(enrichment.position.confidence)) {
      attributes.partPosition = uv(enrichment.position.name, {
        provenance: "INFERRED",
        source: "FUTURE_KNOWLEDGE",
        confidence: catalogNumericConfidence(enrichment.position.confidence),
        evidence: [`catalog:${enrichment.position.id}`],
      });
      requestSubject = {
        ...requestSubject,
        position: uv(enrichment.position.name, {
          provenance: "INFERRED",
          source: "FUTURE_KNOWLEDGE",
          confidence: catalogNumericConfidence(enrichment.position.confidence),
          evidence: [`catalog:${enrichment.position.id}`],
        }),
      };
    }

    if (
      requestSubject.parentEntity &&
      (requestSubject.parentEntity.kind === "VEHICLE" ||
        requestSubject.kind.value === "PART")
    ) {
      const parent = { ...requestSubject.parentEntity };
      if (identity.brand) parent.brand = identity.brand;
      if (identity.model) parent.model = identity.model;
      requestSubject = { ...requestSubject, parentEntity: parent };
    } else if (
      (enrichment.brand || enrichment.model) &&
      (requestSubject.kind.value === "PART" ||
        requestSubject.kind.value === "VEHICLE")
    ) {
      requestSubject = {
        ...requestSubject,
        parentEntity: {
          kind: "VEHICLE",
          brand: identity.brand,
          model: identity.model,
        },
      };
    }

    return {
      ...next,
      identity,
      attributes,
      requestSubject,
    };
  } catch {
    return result;
  }
}
