import type { ExternalPriceObservation, NormalizedProduct } from "@/lib/price-intelligence/types";
import { normalizeExternalProduct } from "@/lib/product-identity/external-product";
import { matchProductToExternal } from "@/lib/product-identity/matching-engine";

/** @deprecated use normalizeModelText from product-identity */
export { normalizeModelText as normalizeProductText } from "@/lib/product-identity/model-normalization";

export {
  normalizeStorageValue as normalizeStorageToken,
  extractStorageFromText,
  storageValuesEquivalent,
} from "@/lib/product-identity/unit-normalization";

/** @deprecated alias */
export { extractStorageFromText as extractStorageFromTitle } from "@/lib/product-identity/unit-normalization";

/**
 * Rule-based match quality — delegates to provider-independent matching engine.
 * Threshold default 0.4 unchanged.
 */
export function computeExternalMatchQuality(
  normalized: NormalizedProduct,
  external: ExternalPriceObservation,
): number {
  const ext = normalizeExternalProduct(external);
  return matchProductToExternal(normalized, ext).score;
}

export function filterByMatchQuality(
  normalized: NormalizedProduct,
  results: ExternalPriceObservation[],
  minQuality: number,
): ExternalPriceObservation[] {
  return results
    .map((observation) => {
      const ext = normalizeExternalProduct(observation);
      const result = matchProductToExternal(normalized, ext, minQuality);
      return { observation, matchQuality: result.score, passed: result.passed };
    })
    .filter((r) => r.passed)
    .map((r) => ({
      ...r.observation,
      rawMetadata: {
        ...(r.observation.rawMetadata ?? {}),
        matchQuality: r.matchQuality,
      },
    }));
}
