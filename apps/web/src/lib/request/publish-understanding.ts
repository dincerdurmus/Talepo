import type { RequestDiscoveryProjection } from "@/lib/discovery";
import type { RequestUnderstandingResult } from "@/lib/request-understanding/types";
import {
  buildUnderstandingSnapshot,
  deriveCategoryResolutionStatus,
  isInternalEvidenceAttributeKey,
  type CategoryUserChoice,
  type InternalEvidenceSnapshot,
  type RequestUnderstandingSnapshot,
} from "@/lib/request/understanding-snapshot";

/**
 * Attach publish-time understanding audit block onto a discovery projection.
 * Does not invent missing values.
 *
 * İÇ KANIT TEKİLLİĞİ (D3c-b). Çıplak projection kendi tipli
 * `internalEvidence` kanalını taşır (snapshot eklenmeyen yollarda değer
 * kaybolmasın diye). Snapshot eklendiğinde aynı anahtarın daha zengin
 * nested kopyası (provenance/source ile) kazanır ve top-level kopya
 * DÜŞÜRÜLÜR; aynı veri iki kanalda birden persist edilmez. Snapshot'ın
 * taşımadığı bir anahtar varsa top-level kopyası korunur — düşürmek
 * silmek olurdu.
 */
export function withUnderstandingSnapshot(
  projection: RequestDiscoveryProjection | null | undefined,
  understanding: RequestUnderstandingSnapshot,
): RequestDiscoveryProjection | null {
  if (!projection) return null;
  const nested = understanding.internalEvidence ?? {};
  const remaining = Object.fromEntries(
    Object.entries(projection.internalEvidence ?? {}).filter(
      ([key]) => !nested[key]?.value,
    ),
  );
  const rest = { ...projection };
  delete rest.internalEvidence;
  return {
    ...rest,
    ...(Object.keys(remaining).length ? { internalEvidence: remaining } : {}),
    understanding,
  };
}

export function buildPublishUnderstandingSnapshot(input: {
  understanding: RequestUnderstandingResult;
  userSelected: boolean;
  userChoice?: CategoryUserChoice;
  confirmedFieldKeys?: string[];
  primarySlug: string | null;
}): RequestUnderstandingSnapshot {
  const cat = input.understanding.category;
  const primarySlug =
    input.primarySlug?.trim() ||
    (typeof cat.value === "string" ? cat.value : null);

  const candidates = [
    ...(primarySlug
      ? [
          {
            slug: primarySlug,
            confidence: cat.confidence,
            source: input.userSelected ? ("user" as const) : ("ai" as const),
          },
        ]
      : []),
    ...(cat.alternatives ?? []).map((alt) => ({
      slug: String(alt.value),
      confidence: alt.confidence,
      source: "ai" as const,
    })),
  ];

  const bySlug = new Map<string, (typeof candidates)[number]>();
  for (const c of candidates) {
    if (!c.slug) continue;
    const prev = bySlug.get(c.slug);
    if (!prev || c.confidence > prev.confidence) bySlug.set(c.slug, c);
  }
  const uniqueCandidates = [...bySlug.values()].sort(
    (a, b) => b.confidence - a.confidence,
  );

  const userChoice = input.userChoice ?? null;
  const status = deriveCategoryResolutionStatus({
    userSelected: input.userSelected,
    userChoice,
    primarySlug,
    primaryConfidence: cat.confidence,
    candidateCount: uniqueCandidates.length,
  });

  const entities: RequestUnderstandingSnapshot["entities"] = {};
  const brand = input.understanding.identity?.brand;
  const model = input.understanding.identity?.model;
  if (brand?.value) {
    entities.brand = {
      value: String(brand.value),
      confidence: brand.confidence,
    };
  }
  if (model?.value) {
    entities.model = {
      value: String(model.value),
      confidence: model.confidence,
    };
  }

  /**
   * İÇ KANIT AYRIMI (D3c-b). `brandCandidate`/`brandEvidence` Talepo'nun
   * kendi tahmin muhasebesidir; kullanıcı attribute'u gibi `attributes`a
   * yazılmaz. Değer, kanonik provenance/source/confidence bilgisiyle tipli
   * `internalEvidence` kanalına gider — anlama katmanındaki asıl kayıt
   * (`understanding.attributes`) değişmez, compose-text çapası oradan okur.
   */
  const attributes: RequestUnderstandingSnapshot["attributes"] = {};
  const internalEvidence: Record<string, InternalEvidenceSnapshot> = {};
  for (const [key, fact] of Object.entries(
    input.understanding.attributes ?? {},
  )) {
    if (fact?.value == null || fact.value === "") continue;
    if (isInternalEvidenceAttributeKey(key)) {
      internalEvidence[key] = {
        value: String(fact.value),
        confidence: fact.confidence,
        provenance: fact.provenance,
        source: fact.source,
        ...(fact.evidence?.length
          ? { evidence: fact.evidence.map((e) => String(e)) }
          : {}),
      };
      continue;
    }
    attributes[key] = {
      value: String(fact.value),
      confidence: fact.confidence,
    };
  }

  const unresolvedExpressions = [
    ...(input.understanding.ambiguities ?? [])
      .map((a) => a.message?.trim() || a.kind)
      .filter(Boolean),
    ...(input.understanding.unknownFields ?? []).map(
      (k) => `unknown_field:${k}`,
    ),
  ];

  return buildUnderstandingSnapshot({
    categoryResolution: {
      status,
      userSelected: input.userSelected,
      userChoice,
      primary: uniqueCandidates[0]
        ? {
            slug: uniqueCandidates[0].slug,
            confidence: uniqueCandidates[0].confidence,
            source: uniqueCandidates[0].source,
          }
        : null,
      candidates: uniqueCandidates,
    },
    entities,
    attributes,
    internalEvidence,
    /**
     * Anlaşılan tipli varlıklar kalıcı olur (1K). `entities` düz string
     * haritası geriye uyumlu kalır; platform/makine türü oraya marka gibi
     * sıkıştırılmaz, kendi tipli alanında yaşar.
     */
    resolvedEntities: input.understanding.resolvedEntities?.map((e) => ({
      canonicalId: e.canonicalId,
      entityType: e.entityType,
      canonicalLabel: e.canonicalLabel,
      domainId: e.domainId,
      ...(e.matchedAlias ? { matchedAlias: e.matchedAlias } : {}),
      confidence: e.confidence,
      source: e.source,
      verificationStatus: e.verificationStatus,
    })),
    /**
     * Kapsam kararı snapshot'a taşınır (kurucu kararı, 2026-08-25).
     * Yayın kapısı sunucuda metinden YENİDEN türetir; buradaki kayıt denetim
     * ve operasyon içindir, yetkinin kendisi değildir.
     */
    requestScope: input.understanding.requestScope?.value ?? undefined,
    unresolvedExpressions,
    confirmedFieldKeys: input.confirmedFieldKeys,
  });
}
