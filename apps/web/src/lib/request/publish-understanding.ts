import type { RequestDiscoveryProjection } from "@/lib/discovery";
import type { RequestUnderstandingResult } from "@/lib/request-understanding/types";
import { GENERIC_SUBJECT_PLACEHOLDER_RE } from "@/lib/request-understanding/types";
import { isVerifiedSource } from "@/lib/request-understanding/provenance";
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
   * ÜRÜN TÜRÜ KÖPRÜSÜ (Wave L, 2026-08-31). Routing envelope'un `product`
   * alanı `entities.product` bekler ama snapshot özneyi hiç taşımıyordu —
   * teknik keşif formülünün 3. bileşeni bu yüzden 0/108'di. Kaynak TEK
   * beynin `requestSubject` kaydıdır (ikinci çıkarıcı yok) ve kanıt
   * eşiklidir: provenance EXPLICIT ya da kaynak kanonik VERIFIED sınıfında.
   * Jenerik yer tutucu adlar (tek yetkili GENERIC_SUBJECT_PLACEHOLDER_RE)
   * ASLA taşınmaz; eşik altı kayıtta alan boş kalır — 0 hata değildir.
   */
  const subject = input.understanding.requestSubject;
  /**
   * KANIT BARINI GEÇEN İLK KAYIT SEÇİLİR (98+ Part II, 2026-09-01).
   * displayPhrase çoğu dalda NORMALIZED_EXPLICIT kaynaklıdır ve eşik onu
   * eliyordu; ad kaydı USER_EXPLICIT ve AYNI kullanıcı sözcüğü olduğu
   * hâlde ürün kanalı boş kalıyordu (ölçüldü: "1000 adet kartvizit" →
   * product YOK). Sabit displayPhrase??name yerine bar-geçen ilk aday
   * alınır; eşik ve yer tutucu kuralları DEĞİŞMEZ.
   */
  const subjectRecord =
    [subject?.displayPhrase, subject?.name].find(
      (r) =>
        r?.value != null &&
        r?.provenance === "EXPLICIT" &&
        (r?.source === "USER_EXPLICIT" || isVerifiedSource(r?.source)),
    ) ??
    subject?.displayPhrase ??
    subject?.name;
  const subjectValue = subjectRecord?.value != null ? String(subjectRecord.value).trim() : "";
  /*
   * Yalnız EXPLICIT provenance taşınır (açık kullanıcı beyanı USER_EXPLICIT
   * ya da kanonik VERIFIED sınıf kaynak). INFERRED özet — kaynağı
   * doğrulanmış olsa bile (ör. "koltuk takımı" → "koltuk") — taşınmaz:
   * zarf `entities.product`u projection'dan ÖNCE okur, buraya yazılan
   * indirgeme kanonik EXPLICIT_TEXT productType'ı ezerdi.
   * INFERRED-doğrulanmış tür zaten projection kanalından akar.
   */
  /*
   * ROL AYRIMI: özne adı kanonik marka/model kaydıyla aynıysa bu bir ürün
   * türü değil, rol sızıntısıdır ("Arçelik 55 inç televizyon" → özne
   * "Arçelik"). Marka kendi kanalında yaşar; product'a kopyalanırsa zarf
   * projection'daki gerçek türü ("televizyon") gölgeler.
   */
  const brandValue = brand?.value != null ? String(brand.value).trim().toLocaleLowerCase("tr") : "";
  const modelValue = model?.value != null ? String(model.value).trim().toLocaleLowerCase("tr") : "";
  const subjectLower = subjectValue.toLocaleLowerCase("tr");
  if (
    subjectValue &&
    !GENERIC_SUBJECT_PLACEHOLDER_RE.test(subjectValue) &&
    subjectLower !== brandValue &&
    subjectLower !== modelValue &&
    subjectRecord?.provenance === "EXPLICIT" &&
    (subjectRecord?.source === "USER_EXPLICIT" ||
      isVerifiedSource(subjectRecord?.source))
  ) {
    entities.product = {
      value: subjectValue,
      confidence: subjectRecord?.confidence,
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
