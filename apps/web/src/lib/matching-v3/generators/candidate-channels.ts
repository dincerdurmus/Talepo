/**
 * Candidate generation — recall-first channel union + companyId dedupe.
 * DB id ↔ slug ↔ taxonomy never cross-compared.
 */

import type {
  CandidateChannel,
  GeneratedCandidate,
  RequestRoutingEnvelope,
  SupplierCapabilityProfile,
} from "../types";
import {
  brandEquals,
  categoryDbIdsOverlap,
  categorySlugsOverlap,
  modelEquals,
  resolveBrandModelHits,
} from "../identity";
import { foldText, includesToken, productsCompatible, tokenize } from "../text";

function pushChannel(
  map: Map<string, Set<CandidateChannel>>,
  companyId: string,
  channel: CandidateChannel,
) {
  const set = map.get(companyId) ?? new Set<CandidateChannel>();
  set.add(channel);
  map.set(companyId, set);
}

function hasExplicitNegative(
  envelope: RequestRoutingEnvelope,
  profile: SupplierCapabilityProfile,
): boolean {
  const brand = foldText(envelope.brand);
  if (brand && profile.excluded.brands?.includes(brand)) return true;
  const product = foldText(envelope.product);
  if (
    product &&
    profile.excluded.products?.some(
      (p) => includesToken(product, p) || includesToken(p, product),
    )
  ) {
    return true;
  }
  const dbId = envelope.categoryResolution.primaryCategoryDbId;
  if (dbId && profile.excluded.categoryDbIds?.includes(dbId)) return true;
  const slug = envelope.categoryResolution.primaryCategorySlug;
  if (slug && profile.excluded.categorySlugs?.includes(slug)) return true;
  const city = foldText(envelope.location.city);
  if (
    city &&
    !envelope.location.nationwide &&
    profile.excluded.cities?.includes(city)
  ) {
    return true;
  }
  return false;
}

export function channelPrimaryCategory(
  envelope: RequestRoutingEnvelope,
  profiles: SupplierCapabilityProfile[],
): string[] {
  const dbId = envelope.categoryResolution.primaryCategoryDbId;
  const slug = envelope.categoryResolution.primaryCategorySlug;
  return profiles
    .filter((p) => {
      if (dbId && categoryDbIdsOverlap(dbId, p.categoryDbIds)) return true;
      if (slug && categorySlugsOverlap([slug], p.categorySlugs)) return true;
      return false;
    })
    .map((p) => p.companyId);
}

export function channelCandidateCategories(
  envelope: RequestRoutingEnvelope,
  profiles: SupplierCapabilityProfile[],
): string[] {
  const slugs = envelope.categoryResolution.candidateCategorySlugs;
  if (slugs.length === 0) return [];
  return profiles
    .filter((p) => categorySlugsOverlap(slugs, p.categorySlugs))
    .map((p) => p.companyId);
}

export function channelTaxonomyLeaf(
  envelope: RequestRoutingEnvelope,
  profiles: SupplierCapabilityProfile[],
): string[] {
  const leaf = envelope.categoryResolution.primaryLeafId;
  if (!leaf) return [];
  return profiles
    .filter((p) => p.taxonomyNodeIds.includes(leaf))
    .map((p) => p.companyId);
}

export function channelTaxonomyAncestor(
  envelope: RequestRoutingEnvelope,
  profiles: SupplierCapabilityProfile[],
): string[] {
  const nodes = new Set([
    ...envelope.categoryResolution.ancestors,
    ...envelope.categoryResolution.taxonomyNodeIds,
  ]);
  if (nodes.size === 0) return [];
  return profiles
    .filter((p) => p.taxonomyNodeIds.some((id) => nodes.has(id)))
    .map((p) => p.companyId);
}

export function channelProductEntity(
  envelope: RequestRoutingEnvelope,
  profiles: SupplierCapabilityProfile[],
): string[] {
  const product = foldText(envelope.product);
  if (!product) return [];
  return profiles
    .filter(
      (p) =>
        p.products.some((x) => productsCompatible(product, x)) ||
        p.inventorySignals.some(
          (inv) => inv.product && productsCompatible(product, inv.product),
        ),
    )
    .map((p) => p.companyId);
}

/**
 * Brand+model together: recall via verified pair OR list hits.
 * Cartesian list hits are NOT high-confidence proof (see resolveBrandModelHits).
 */
export function channelBrandModelFamily(
  envelope: RequestRoutingEnvelope,
  profiles: SupplierCapabilityProfile[],
): string[] {
  const brand = foldText(envelope.brand);
  const model = foldText(envelope.model);
  const family = foldText(envelope.family) || foldText(envelope.series);
  if (!brand && !model && !family) return [];

  return profiles
    .filter((p) => {
      const hits = resolveBrandModelHits(envelope, p);
      if (brand && model) {
        return (
          hits.verifiedBrandModelPair ||
          hits.cartesianListHit ||
          (hits.brandHit && hits.modelHit)
        );
      }
      if (brand) return hits.brandHit;
      if (model) return hits.modelHit;
      return hits.familyHit;
    })
    .map((p) => p.companyId);
}

export function channelAliasKeyword(
  envelope: RequestRoutingEnvelope,
  profiles: SupplierCapabilityProfile[],
): string[] {
  const phrases = [envelope.product, envelope.brand, envelope.model]
    .map(foldText)
    .filter((p) => p.length >= 4);
  const tokens = tokenize(envelope.rawInput).filter((t) => t.length >= 5);
  if (phrases.length === 0 && tokens.length === 0) return [];

  return profiles
    .filter((p) => {
      const bag = [...p.aliases, ...p.keywords, ...p.products, ...p.brands];
      if (
        phrases.some((ph) =>
          bag.some((b) => productsCompatible(ph, b) || includesToken(b, ph)),
        )
      ) {
        return true;
      }
      return tokens.some((t) =>
        bag.some((b) => includesToken(b, t) || includesToken(t, b)),
      );
    })
    .map((p) => p.companyId);
}

export function channelInventory(
  envelope: RequestRoutingEnvelope,
  profiles: SupplierCapabilityProfile[],
): string[] {
  return profiles
    .filter((p) => {
      if (p.inventorySignals.length === 0) return false;
      const product = foldText(envelope.product);
      const brand = foldText(envelope.brand);
      const model = foldText(envelope.model);
      const catDb = envelope.categoryResolution.primaryCategoryDbId;
      return p.inventorySignals.some((inv) => {
        if (product && inv.product && productsCompatible(product, inv.product)) {
          return true;
        }
        if (brand && model) {
          if (brandEquals(inv.brand, brand) && modelEquals(inv.model, model)) {
            return true;
          }
          return false;
        }
        if (brand && brandEquals(inv.brand, brand)) return true;
        if (model && modelEquals(inv.model, model)) return true;
        if (catDb && inv.categoryDbId === catDb) return true;
        if (
          envelope.categoryResolution.primaryLeafId &&
          inv.taxonomyNodeId === envelope.categoryResolution.primaryLeafId
        ) {
          return true;
        }
        return false;
      });
    })
    .map((p) => p.companyId);
}

export function channelAlertSavedSearch(
  envelope: RequestRoutingEnvelope,
  profiles: SupplierCapabilityProfile[],
): string[] {
  const slugs = new Set(
    [
      ...envelope.categoryResolution.candidateCategorySlugs,
      envelope.categoryResolution.primaryCategorySlug,
    ].filter(Boolean) as string[],
  );
  const dbId = envelope.categoryResolution.primaryCategoryDbId;
  const product = foldText(envelope.product);
  const brand = foldText(envelope.brand);
  const tokens = tokenize(envelope.rawInput);

  return profiles
    .filter((p) => {
      const signals = [...p.alertSignals, ...p.savedSearchSignals];
      if (signals.length === 0) return false;
      return signals.some((s) => {
        if (dbId && s.categoryDbIds?.includes(dbId)) return true;
        if (s.categorySlugs?.some((c) => slugs.has(c))) return true;
        if (
          s.taxonomyNodeIds?.some((id) =>
            envelope.categoryResolution.taxonomyNodeIds.includes(id),
          )
        ) {
          return true;
        }
        if (brand && s.brands?.some((b) => brandEquals(b, brand))) return true;
        if (product && s.products?.some((x) => productsCompatible(x, product))) {
          return true;
        }
        if (s.keywords?.some((k) => tokens.some((t) => includesToken(k, t)))) {
          return true;
        }
        return false;
      });
    })
    .map((p) => p.companyId);
}

export function channelLexicalSemantic(
  envelope: RequestRoutingEnvelope,
  profiles: SupplierCapabilityProfile[],
): string[] {
  if (
    (envelope.categoryResolution.status === "unresolved" ||
      envelope.categoryResolution.status === "user_deferred") &&
    !envelope.product &&
    !envelope.brand &&
    !envelope.categoryResolution.primaryCategoryDbId &&
    !envelope.categoryResolution.primaryCategorySlug
  ) {
    return [];
  }

  const tokens = tokenize(
    [envelope.rawInput, envelope.product, envelope.brand, envelope.model]
      .filter(Boolean)
      .join(" "),
  ).filter((t) => t.length >= 5);
  if (tokens.length === 0) return [];

  return profiles
    .filter((p) => {
      const bag = [
        ...p.products,
        ...p.brands,
        ...p.models,
        ...p.aliases,
        ...p.keywords,
        ...p.families,
      ].join(" ");
      return tokens.some((t) => includesToken(bag, t));
    })
    .map((p) => p.companyId);
}

export type SemanticAdapterContract = {
  kind: "lexical_semantic_adapter";
  vectorEnabled: false;
  implement: typeof channelLexicalSemantic;
};

export const LEXICAL_SEMANTIC_ADAPTER: SemanticAdapterContract = {
  kind: "lexical_semantic_adapter",
  vectorEnabled: false,
  implement: channelLexicalSemantic,
};

const CHANNEL_RUNNERS: Array<{
  channel: CandidateChannel;
  run: (
    envelope: RequestRoutingEnvelope,
    profiles: SupplierCapabilityProfile[],
  ) => string[];
}> = [
  { channel: "primary_category", run: channelPrimaryCategory },
  { channel: "candidate_categories", run: channelCandidateCategories },
  { channel: "taxonomy_leaf", run: channelTaxonomyLeaf },
  { channel: "taxonomy_ancestor", run: channelTaxonomyAncestor },
  { channel: "product_entity", run: channelProductEntity },
  { channel: "brand_model_family", run: channelBrandModelFamily },
  { channel: "alias_keyword", run: channelAliasKeyword },
  { channel: "inventory", run: channelInventory },
  { channel: "alert_saved_search", run: channelAlertSavedSearch },
  { channel: "lexical_semantic", run: channelLexicalSemantic },
];

export function generateCandidates(
  envelope: RequestRoutingEnvelope,
  profiles: SupplierCapabilityProfile[],
): GeneratedCandidate[] {
  const map = new Map<string, Set<CandidateChannel>>();
  const byId = new Map(profiles.map((p) => [p.companyId, p]));

  for (const { channel, run } of CHANNEL_RUNNERS) {
    for (const companyId of run(envelope, profiles)) {
      const profile = byId.get(companyId);
      if (!profile) continue;
      if (hasExplicitNegative(envelope, profile)) continue;
      pushChannel(map, companyId, channel);
    }
  }

  return Array.from(map.entries()).map(([companyId, channels]) => ({
    companyId,
    channels: Array.from(channels),
  }));
}

export function dedupeCandidates(
  candidates: GeneratedCandidate[],
): GeneratedCandidate[] {
  const map = new Map<string, Set<CandidateChannel>>();
  for (const c of candidates) {
    const set = map.get(c.companyId) ?? new Set<CandidateChannel>();
    for (const ch of c.channels) set.add(ch);
    map.set(c.companyId, set);
  }
  return Array.from(map.entries()).map(([companyId, channels]) => ({
    companyId,
    channels: Array.from(channels),
  }));
}
