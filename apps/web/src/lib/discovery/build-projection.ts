/**
 * Build publish-time discovery projection from CanonicalRequestState.
 * Does not re-interpret intent — maps already-understood state.
 */

import {
  answerAuthorityOfProvenance,
  classifyAnswerAuthority,
  isDeliberateNonValueAnswer,
} from "@/lib/request-composer/answer-authority";
import type { CanonicalRequestState } from "@/lib/request-composer/types";
import { isGeneratedCommonField } from "@/lib/request-category-engine";
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
  type ProjectionFieldAuthority,
  type ProjectionFieldResponse,
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
  /**
   * DEĞERİN KAYNAĞI (D3c). Otorite, değerin kendisiyle AYNI döngüde ve AYNI
   * kanonik alan kaydından türetilir. Ayrı bir geçişte türetilseydi iki liste
   * sessizce ayrışabilirdi: bir alan torbaya girip haritaya girmeyebilir ya da
   * tersi olabilirdi. İç kanıt anahtarları döngünün başında elendiği için bu
   * haritaya da GİREMEZ.
   */
  const fieldAuthority: Record<string, ProjectionFieldAuthority> = {};
  /**
   * CEVAP DİSPOZİSYONU — DEĞER TORBALARINDAN AYRI (D3f Dilim 2).
   *
   * Bilinçli "Bilmiyorum" / "Uygulanamaz" ne bir ürün özelliğidir ne de bir
   * matching kısıtı; bu yüzden `attributes` ve `constraints` torbalarına
   * girmez. Aynı döngüde türetilir ki bir alan bir torbaya girip ötekine
   * girmesin.
   */
  const fieldResponses: Record<string, ProjectionFieldResponse> = {};

  for (const [key, field] of Object.entries(state.fields)) {
    /**
     * İÇ KANIT AYRIMI (D3c-b): `brandCandidate`/`brandEvidence` kullanıcı
     * beyanı değildir — firma tarafına dönük attribute/constraint torbasına
     * girmez. Değer AŞAĞIDA tipli `internalEvidence` kanalına yazılır;
     * atlamak silmek değildir.
     */
    if (isInternalEvidenceAttributeKey(key)) continue;

    /**
     * BİLİNÇLİ DEĞER TAŞIMAYAN CEVAP — KENDİ YÜZEYİ, TEK YÜZEY (D3f Dilim 2).
     *
     * `ANY` buraya GİRMEZ: onun kanalı aşağıdaki `constraints` kaydıdır ve
     * filtre sözleşmesini besler. `UNKNOWN` / `NOT_APPLICABLE` ise ne bir
     * ürün özelliği ne de bir kısıttır — döngü burada biter, böylece aynı
     * anahtar ikinci bir yüzeye YAZILAMAZ.
     */
    /**
     * ÜRETİLEN ALAN CEVAP TAŞIMAZ (D3f Dilim 3g, 2026-08-28).
     *
     * Başlık gibi üretilen bir etiket için "kullanıcı değer vermedi" kaydı
     * anlamsızdır: `Request.title` gerçek bir başlık taşırken projection'ın
     * bunun aksini söylemesi çelişkili bir çift yüzeydir. Karar alan adından
     * değil kanonik registry yeteneğinden okunur.
     */
    if (isGeneratedCommonField(key) && field.kind !== "VALUE") continue;

    if (field.kind === "UNKNOWN" || field.kind === "NOT_APPLICABLE") {
      /**
       * Otorite KANONİK MERDİVENDEN türetilir, elle yazılmaz. Yüzey yalnız
       * türetim `USER_EXPLICIT` verdiğinde oluşur; çıkarım ya da katalog
       * kaynaklı bir kayıt buraya giremez ve bu daralma tip düzeyinde de
       * gerçektir.
       */
      const responseAuthority = answerAuthorityOfProvenance(field.provenance);
      if (
        isDeliberateNonValueAnswer(field) &&
        responseAuthority === "USER_EXPLICIT"
      ) {
        fieldResponses[key] = {
          kind: field.kind,
          authority: responseAuthority,
        };
        continue;
      }
    }

    const authority: ProjectionFieldAuthority = {};

    if (field.kind === "VALUE" && field.value?.trim()) {
      attributes[key] = field.value.trim();
      /* Değer taşıyan alan: kanonik cevap otoritesi (`kind === "VALUE"` +
       * provenance). Burada ikinci bir sınıflandırma kurulmaz. */
      authority.attributes = classifyAnswerAuthority(field);
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
      /**
       * DEĞER TAŞIMAYAN CONSTRAINT'İN OTORİTESİ. `classifyAnswerAuthority`
       * yalnız `kind === "VALUE"` alanlara bakar ve tasarımı gereği ötekilere
       * `UNKNOWN` der — çünkü onun cevapladığı soru "bu değer soruyu
       * kapatabilir mi?"dir. Burada sorulan soru BAŞKADIR: "bu kaydı kim
       * koydu?". Kullanıcının gezinmeden açıkça seçtiği "Fark etmez"
       * (`kind: "ANY"`, `provenance: "EXPLICIT_BROWSE"`) bilinçli bir
       * cevaptır; `UNKNOWN` yazmak onu Talepo'nun bilgisizliğiyle aynı kovaya
       * atardı. Bu yüzden değer yokken merdivenin AYNI modülündeki dar
       * görünüm (`answerAuthorityOfProvenance`) okunur — yeni bir merdiven
       * değil, aynı sözleşmenin ikinci kapısı.
       */
      authority.constraints =
        authority.attributes ?? answerAuthorityOfProvenance(field.provenance);
    }

    if (authority.attributes || authority.constraints) {
      fieldAuthority[key] = authority;
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
    /* Additive: harita boşsa alan HİÇ üretilmez — eski okuyucular ve eski
     * kayıtlar için şekil aynen korunur. */
    ...(Object.keys(fieldAuthority).length ? { fieldAuthority } : {}),
    ...(Object.keys(fieldResponses).length ? { fieldResponses } : {}),
    matchContract,
    filterContract,
    builtAt: new Date().toISOString(),
  };
}
