import type { ExternalPriceObservation } from "@/lib/price-intelligence/types";

import { extractBrandFromText } from "./brand-extraction";
import { inferConditionFromText, normalizeCondition } from "./condition";
import { normalizeModelText } from "./model-normalization";
import type { NormalizedExternalProduct, ProductCondition } from "./types";
import { extractStorageFromText, extractWeightFromText } from "./unit-normalization";

export function normalizeExternalProduct(
  observation: ExternalPriceObservation,
): NormalizedExternalProduct {
  const title = observation.title?.trim() ?? "";
  const brandGuess = extractBrandFromText(title);

  const conditionRaw = observation.condition;
  const condition: ProductCondition =
    conditionRaw != null
      ? normalizeCondition(conditionRaw)
      : inferConditionFromText(title);

  const storage = extractStorageFromText(title);
  const weight = extractWeightFromText(title);

  const attributes: Record<string, string> = {};
  if (storage) attributes.storage = storage;
  if (weight) attributes.weight = weight;

  const meta = observation.rawMetadata ?? {};

  return {
    provider: observation.provider,
    externalId: observation.externalId,
    title,
    brand: brandGuess.brand,
    productType: null,
    model: brandGuess.remainder ? normalizeModelText(brandGuess.remainder) : null,
    series: null,
    variant: null,
    identifiers: {},
    condition,
    attributes,
    price: observation.price,
    currency: observation.currency,
    seller: (meta.seller as string | null) ?? null,
    url: observation.url,
    observedAt: observation.observedAt,
  };
}

export function normalizeExternalProducts(
  observations: ExternalPriceObservation[],
): NormalizedExternalProduct[] {
  return observations.map(normalizeExternalProduct);
}
