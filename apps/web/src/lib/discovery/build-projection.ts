/**
 * Build publish-time discovery projection from CanonicalRequestState.
 * Does not re-interpret intent — maps already-understood state.
 */

import type { CanonicalRequestState } from "@/lib/request-composer/types";
import {
  INTERNAL_EVIDENCE_ATTRIBUTE_KEYS,
  isInternalEvidenceAttributeKey,
  type InternalEvidenceSnapshot,
} from "@/lib/request/understanding-snapshot";
import {
  toConstraintFilterContract,
  toConstraintMatchContract,
} from "@/lib/request-understanding/constraint-semantics";
import {
  findTaxonomyTypeUnderSubcategory,
  getTaxonomyAncestorIds,
  getTaxonomyChildren,
  getTaxonomyNode,
  resolveTaxonomyAlias,
} from "@/lib/taxonomy";

import {
  DISCOVERY_PROJECTION_VERSION,
  type DiscoveryFieldConstraint,
  type RequestDiscoveryProjection,
} from "./types";

function uniqueIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function fieldValue(
  state: CanonicalRequestState,
  key: string,
): string | null {
  const v = state.fields[key]?.value?.trim();
  return v || null;
}

/**
 * When hybrid state has category/attrs but no taxonomyNodeId yet,
 * resolve the deepest stable leaf from known tokens (publish projection only).
 */
function resolveLeafFromState(state: CanonicalRequestState): string | null {
  if (state.taxonomyNodeId && getTaxonomyNode(state.taxonomyNodeId)) {
    return state.taxonomyNodeId;
  }

  const categoryId = state.categoryId;
  const tokens = uniqueIds(
    [
      fieldValue(state, "part"),
      fieldValue(state, "productType"),
      fieldValue(state, "partType"),
      fieldValue(state, "boxType"),
      fieldValue(state, "partSystem"),
      // Prefer short distinctive tokens from compound part labels
      ...(fieldValue(state, "part")
        ?.split(/\s+/)
        .filter((t) => t.length >= 3) ?? []),
    ].filter((t): t is string => Boolean(t)),
  );

  // Alias resolution prefers deepest node under category
  for (const token of tokens) {
    const hit = resolveTaxonomyAlias(token, categoryId ?? undefined);
    if (hit?.node?.id) return hit.node.id;
  }

  if (categoryId && state.subcategorySlug) {
    for (const token of tokens) {
      const hit = findTaxonomyTypeUnderSubcategory(
        categoryId,
        state.subcategorySlug,
        token,
      );
      if (hit) return hit.id;
    }

    // partSystem → SYSTEM node under subcategory (e.g. Aydınlatma → lighting)
    const system = fieldValue(state, "partSystem");
    if (system) {
      const subId = `tax:${categoryId}:${state.subcategorySlug}`;
      const children = getTaxonomyChildren(subId);
      const folded = system.toLocaleLowerCase("tr-TR");
      const sysNode = children.find((n) => {
        const name = (n.canonicalName ?? "").toLocaleLowerCase("tr-TR");
        const idTail = n.id.split(":").pop() ?? "";
        return (
          name.includes(folded) ||
          folded.includes(name) ||
          (idTail === "lighting" &&
            /aydınlat|aydinlat|lighting/i.test(system))
        );
      });
      if (sysNode) {
        // Try to deepen with part token under system
        for (const token of tokens) {
          const deep = resolveTaxonomyAlias(token, categoryId);
          if (
            deep?.node?.id &&
            getTaxonomyAncestorIds(deep.node.id).includes(sysNode.id)
          ) {
            return deep.node.id;
          }
        }
        return sysNode.id;
      }
    }

    return `tax:${categoryId}:${state.subcategorySlug}`;
  }

  // Category-scoped alias from identity / evidence fragments
  if (categoryId) {
    const evidenceBits = (state.understanding.identity.model?.evidence ?? [])
      .concat(state.understanding.identity.brand?.evidence ?? [])
      .filter((x): x is string => typeof x === "string");
    const modelVal =
      typeof state.understanding.identity.model?.value === "string"
        ? state.understanding.identity.model.value
        : null;
    const textHints = uniqueIds(
      [
        ...tokens,
        fieldValue(state, "model"),
        modelVal,
        ...evidenceBits,
      ].filter((t): t is string => Boolean(t)),
    );
    const hay = textHints.join(" ").toLocaleLowerCase("tr-TR");

    // Scan known subcategory aliases under this category via alias index tokens in hay
    for (const phrase of extractCandidatePhrases(hay)) {
      const hit = resolveTaxonomyAlias(phrase, categoryId);
      if (hit?.node?.id && hit.node.id !== `tax:${categoryId}`) {
        return hit.node.id;
      }
    }
  }

  return null;
}

/** Pull short n-grams that may match taxonomy aliases (bounded). */
function extractCandidatePhrases(hay: string): string[] {
  const cleaned = hay.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const words = cleaned.split(" ").filter(Boolean);
  const out: string[] = [];
  for (let n = 3; n >= 1; n--) {
    for (let i = 0; i + n <= words.length && out.length < 24; i++) {
      const phrase = words.slice(i, i + n).join(" ");
      if (phrase.length >= 3) out.push(phrase);
    }
  }
  return uniqueIds(out);
}

/**
 * Publish-time read model from hybrid canonical state.
 */
export function buildDiscoveryProjectionFromState(
  state: CanonicalRequestState,
): RequestDiscoveryProjection {
  const leafId = resolveLeafFromState(state);
  const ancestors = leafId ? getTaxonomyAncestorIds(leafId) : [];
  // ancestors are leaf→root; reverse for root→leaf readability, keep all
  const taxonomyNodeIds = uniqueIds([...ancestors].reverse());

  // Ensure subcategory node present when known
  if (state.categoryId && state.subcategorySlug) {
    const subId = `tax:${state.categoryId}:${state.subcategorySlug}`;
    if (getTaxonomyNode(subId) && !taxonomyNodeIds.includes(subId)) {
      taxonomyNodeIds.push(subId);
    }
  }
  if (state.categoryId) {
    const rootId = `tax:${state.categoryId}`;
    if (getTaxonomyNode(rootId) && !taxonomyNodeIds.includes(rootId)) {
      taxonomyNodeIds.unshift(rootId);
    }
  }

  const attributes: Record<string, string> = {};
  const constraints: Record<string, DiscoveryFieldConstraint> = {};

  for (const [key, field] of Object.entries(state.fields)) {
    /**
     * İÇ KANIT AYRIMI (D3c-b): `brandCandidate`/`brandEvidence` kullanıcı
     * beyanı değildir — firma tarafına dönük attribute/constraint torbasına
     * girmez. Değer AŞAĞIDA tipli `internalEvidence` kanalına yazılır;
     * atlamak silmek değildir.
     */
    if (isInternalEvidenceAttributeKey(key)) continue;
    if (field.kind === "VALUE" && field.value?.trim()) {
      attributes[key] = field.value.trim();
    }

    const c: DiscoveryFieldConstraint = {};
    if (field.kind === "ANY") c.mode = "ANY";
    else if (field.kind === "VALUE") c.mode = "VALUE";
    else if (field.kind === "UNKNOWN") c.mode = "UNKNOWN";

    if (field.value != null) c.value = field.value;
    if (field.preferredValues?.length) c.preferred = [...field.preferredValues];
    if (field.allowedValues?.length) c.include = [...field.allowedValues];
    if (field.excludedValues?.length) c.excluded = [...field.excludedValues];
    if (field.strength) c.strength = field.strength;
    if (field.range) c.range = { ...field.range };

    if (
      c.mode === "ANY" ||
      c.excluded?.length ||
      c.preferred?.length ||
      c.include?.length ||
      c.strength ||
      c.range ||
      (c.mode === "VALUE" && c.value)
    ) {
      constraints[key] = c;
    }
  }

  const u = state.understanding;

  /**
   * İÇ KANIT TİPLİ KANALI (D3c-b). Snapshot HER ZAMAN eklenmez: sunucu
   * yeniden kurulumu ve `hybrid.state == null` dalı çıplak projection
   * persist eder. Bu yüzden değer, kanonik anlama kaydından provenance'ıyla
   * birlikte burada da tipli kanala yazılır — böylece "taşı, silme"
   * sözleşmesi snapshot'ın eklenmesine bağlı kalmaz. Snapshot sonradan
   * eklendiğinde daha zengin nested kanal kazanır ve bu kopya
   * `withUnderstandingSnapshot` tarafından düşürülür (çift yazım yok).
   */
  const internalEvidence: Record<string, InternalEvidenceSnapshot> = {};
  for (const key of INTERNAL_EVIDENCE_ATTRIBUTE_KEYS) {
    const fact = (u.attributes as Record<string, unknown> | undefined)?.[key] as
      | {
          value?: unknown;
          confidence?: number;
          provenance?: InternalEvidenceSnapshot["provenance"];
          source?: InternalEvidenceSnapshot["source"];
          evidence?: string[];
        }
      | undefined;
    const value =
      fact?.value == null ? "" : String(fact.value).trim();
    if (!value) continue;
    internalEvidence[key] = {
      value,
      ...(fact?.confidence === undefined ? {} : { confidence: fact.confidence }),
      ...(fact?.provenance ? { provenance: fact.provenance } : {}),
      ...(fact?.source ? { source: fact.source } : {}),
      ...(fact?.evidence?.length
        ? { evidence: fact.evidence.map((e) => String(e)) }
        : {}),
    };
  }

  const entityRefs: Record<string, string> = {};
  if (u.identity.brand?.value) {
    entityRefs.brand = String(u.identity.brand.value);
  }
  if (u.identity.model?.value) {
    entityRefs.model = String(u.identity.model.value);
  }
  if (u.identity.series?.value) {
    entityRefs.series = String(u.identity.series.value);
  }
  if (u.identity.variant?.value) {
    entityRefs.variant = String(u.identity.variant.value);
  }
  const enrichment = u.catalogEnrichment;
  if (enrichment?.brand?.id) entityRefs.brandId = enrichment.brand.id;
  if (enrichment?.model?.id) entityRefs.modelId = enrichment.model.id;
  if (enrichment?.generation?.id) {
    entityRefs.generationId = enrichment.generation.id;
  }

  const matchContract = toConstraintMatchContract(u.constraints);
  const filterContract = toConstraintFilterContract(u.constraints);

  // Merge hybrid field exclusions into filter contract when RU bundle missed them
  for (const [key, c] of Object.entries(constraints)) {
    if (c.excluded?.length) {
      filterContract.exclude[key] = uniqueIds([
        ...(filterContract.exclude[key] ?? []),
        ...c.excluded,
      ]);
    }
    if (c.preferred?.length) {
      filterContract.preferred[key] = uniqueIds([
        ...(filterContract.preferred[key] ?? []),
        ...c.preferred,
      ]);
    }
    if (c.mode === "ANY" && !filterContract.any.includes(key)) {
      filterContract.any.push(key);
    }
    if (c.range) {
      filterContract.range[key] = c.range;
    }
  }

  return {
    version: DISCOVERY_PROJECTION_VERSION,
    kind: "discovery_projection",
    taxonomyNodeIds,
    primaryLeafId: leafId,
    categoryId: state.categoryId,
    subcategorySlug: state.subcategorySlug,
    entityRefs: Object.keys(entityRefs).length ? entityRefs : undefined,
    attributes,
    ...(Object.keys(internalEvidence).length ? { internalEvidence } : {}),
    constraints,
    matchContract,
    filterContract,
    builtAt: new Date().toISOString(),
  };
}
