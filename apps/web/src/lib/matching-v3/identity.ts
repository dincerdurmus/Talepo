/** Category / brand / model identity helpers — never equate cuid ↔ slug ↔ taxonomy. */

import type { RequestRoutingEnvelope, SupplierCapabilityProfile } from "./types";
import { foldText, includesToken } from "./text";

export function isTaxonomyId(value: string | null | undefined): boolean {
  return Boolean(value && value.startsWith("tax:"));
}

export function isLikelyCategoryDbId(value: string | null | undefined): boolean {
  if (!value) return false;
  if (isTaxonomyId(value)) return false;
  return (
    value.startsWith("cat_cuid_") ||
    /^c[a-z0-9]{20,}$/i.test(value) ||
    value.includes("_cuid_")
  );
}

export function isLikelyCategorySlug(value: string | null | undefined): boolean {
  if (!value) return false;
  if (isTaxonomyId(value) || isLikelyCategoryDbId(value)) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(value);
}

export function categoryDbIdsOverlap(
  requestDbId: string | null | undefined,
  supplierDbIds: string[],
): boolean {
  if (!requestDbId) return false;
  return supplierDbIds.includes(requestDbId);
}

export function categorySlugsOverlap(
  requestSlugs: string[],
  supplierSlugs: string[],
): boolean {
  const set = new Set(requestSlugs.map((s) => s.trim()).filter(Boolean));
  if (set.size === 0) return false;
  return supplierSlugs.some((s) => set.has(s));
}

export function brandEquals(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const x = foldText(a);
  const y = foldText(b);
  if (!x || !y) return false;
  return x === y || includesToken(x, y) || includesToken(y, x);
}

export function modelEquals(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  return brandEquals(a, b);
}

export type BrandModelHits = {
  brandHit: boolean;
  modelHit: boolean;
  familyHit: boolean;
  /** Same inventory row carries both brand and model. */
  inventoryBrandModelExact: boolean;
  /** Declared brandModelPairs row matches request brand+model. */
  declaredBrandModelPairExact: boolean;
  /**
   * High-confidence brand+model proof (inventory row OR brandModelPairs).
   * Separate brands[]×models[] cartesian is NOT sufficient.
   */
  verifiedBrandModelPair: boolean;
  /**
   * List-level brand∧model without verified pair — recall only, never EXACT proof.
   */
  cartesianListHit: boolean;
  /**
   * @deprecated Prefer verifiedBrandModelPair for EXACT/STRONG.
   * Kept as alias of verifiedBrandModelPair when both brand+model requested.
   */
  brandModelOk: boolean;
};

export function resolveBrandModelHits(
  envelope: RequestRoutingEnvelope,
  profile: SupplierCapabilityProfile,
): BrandModelHits {
  const brand = foldText(envelope.brand);
  const model = foldText(envelope.model);
  const family = foldText(envelope.family) || foldText(envelope.series);

  const listBrandHit = Boolean(
    brand && profile.brands.some((b) => brandEquals(b, brand)),
  );
  const invBrandHit = Boolean(
    brand &&
      profile.inventorySignals.some((inv) => brandEquals(inv.brand, brand)),
  );
  const brandHit = listBrandHit || invBrandHit;

  const listModelHit = Boolean(
    model && profile.models.some((m) => modelEquals(m, model)),
  );
  const invModelHit = Boolean(
    model &&
      profile.inventorySignals.some((inv) => modelEquals(inv.model, model)),
  );
  const modelHit = listModelHit || invModelHit;

  const familyHit = Boolean(
    family && profile.families.some((f) => brandEquals(f, family)),
  );

  const inventoryBrandModelExact = Boolean(
    brand &&
      model &&
      profile.inventorySignals.some(
        (inv) => brandEquals(inv.brand, brand) && modelEquals(inv.model, model),
      ),
  );

  const declaredBrandModelPairExact = Boolean(
    brand &&
      model &&
      (profile.brandModelPairs ?? []).some(
        (pair) =>
          brandEquals(pair.brand, brand) && modelEquals(pair.model, model),
      ),
  );

  const verifiedBrandModelPair =
    inventoryBrandModelExact || declaredBrandModelPairExact;

  const cartesianListHit = Boolean(
    brand && model && listBrandHit && listModelHit && !verifiedBrandModelPair,
  );

  // High-confidence OK only via verified pair when both are requested.
  let brandModelOk = true;
  if (brand && model) {
    brandModelOk = verifiedBrandModelPair;
  }

  return {
    brandHit,
    modelHit,
    familyHit,
    inventoryBrandModelExact,
    declaredBrandModelPairExact,
    verifiedBrandModelPair,
    cartesianListHit,
    brandModelOk,
  };
}

/** True when supplier has a verified pair for this model under a different brand. */
export function hasConflictingVerifiedModelPair(
  envelope: RequestRoutingEnvelope,
  profile: SupplierCapabilityProfile,
): boolean {
  const brand = foldText(envelope.brand);
  const model = foldText(envelope.model);
  if (!brand || !model) return false;
  if (
    profile.inventorySignals.some(
      (inv) => brandEquals(inv.brand, brand) && modelEquals(inv.model, model),
    )
  ) {
    return false;
  }
  if (
    (profile.brandModelPairs ?? []).some(
      (pair) =>
        brandEquals(pair.brand, brand) && modelEquals(pair.model, model),
    )
  ) {
    return false;
  }
  const otherInv = profile.inventorySignals.some(
    (inv) =>
      modelEquals(inv.model, model) &&
      inv.brand &&
      !brandEquals(inv.brand, brand),
  );
  const otherPair = (profile.brandModelPairs ?? []).some(
    (pair) =>
      modelEquals(pair.model, model) && !brandEquals(pair.brand, brand),
  );
  return otherInv || otherPair;
}
