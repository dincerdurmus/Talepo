import type { PriceStrategyKey } from "@/lib/price-intelligence/price-strategy-registry";

export type UnderstandingProvenance = "EXPLICIT" | "INFERRED";

export type UnderstandingSource =
  | "USER_EXPLICIT"
  | "NORMALIZED_EXPLICIT"
  | "DETERMINISTIC_INFERENCE"
  | "PRODUCT_IDENTITY"
  | "CATEGORY_INFERENCE"
  | "STRATEGY_INFERENCE"
  | "STRUCTURED_FIELD"
  | "FUTURE_KNOWLEDGE"
  | "FUTURE_LLM";

export type UnderstandingValue<T> = {
  value: T;
  confidence: number;
  provenance: UnderstandingProvenance;
  source: UnderstandingSource;
  evidence?: string[];
};

export type DecisionStatus = "CONFIDENT" | "TENTATIVE" | "UNKNOWN";

export type UnderstandingDecision<T> = {
  value: T | null;
  confidence: number;
  status: DecisionStatus;
  evidence?: string[];
  alternatives?: Array<{
    value: T;
    confidence: number;
    evidence?: string[];
  }>;
};

export type UnderstandingFact = {
  key: string;
  value: unknown;
  confidence: number;
  provenance: UnderstandingProvenance;
  source: UnderstandingSource;
  evidence?: string[];
};

export type UnderstandingAmbiguity = {
  kind: string;
  message: string;
  candidates?: string[];
};

export type UnderstandingContradiction = {
  kind: string;
  message: string;
  fields?: string[];
};

export type RequestIntent =
  | "BUY"
  | "RENT"
  | "SELL"
  | "SERVICE"
  | "MANUFACTURE"
  | "PART"
  | "UNKNOWN";

/**
 * TALEPO KAPSAMI — KURUCU ÜRÜN KARARI (2026-08-25).
 *
 * Talepo, ürününü satmak ya da kiraya vermek isteyenlerin İLAN platformu
 * DEĞİLDİR. Yalnız ihtiyacı olan tarafın talebini kabul eder: ürün satın
 * alma, ürün/araç/makine kiralama, hizmet alma, üretim/baskı yaptırma.
 *
 *   DEMAND               Kullanıcı bir şey İSTİYOR. Platformun konusu budur.
 *   UNSUPPORTED_SUPPLY   Kullanıcı kendi nesnesini elden çıkarmak istiyor
 *                        ("Aracımı satmak istiyorum", "Evimi kiraya vermek
 *                        istiyorum"). Bu bir arz ilanıdır; yayınlanamaz,
 *                        eşleştirilmez, bildirim üretmez.
 *
 * AYRIM İSTENEN HEDEFTEDİR, SATILAN NESNEDE DEĞİL. "Aracımı satmak için
 * ekspertiz hizmeti arıyorum" GEÇERLİ bir hizmet talebidir: elden çıkarma
 * ifadesi kullanım bağlamındadır, istenen hedef hizmettir. Bu ayrımı yapan
 * kural KB-16'da kurulan kapsam kuralıdır (bkz. intent-signals IntentScope);
 * burada yeni bir ayrıştırıcı kurulmaz, o kararın sonucu okunur.
 *
 *   UNSUPPORTED_MEDICAL_ADVICE — kurucu kararı 2026-08-31 (FD-9):
 * kullanıcı kişiye özel tıbbi tavsiye / hangi ilacın-tedavinin
 * kullanılacağını soruyor ("Baş ağrım için hangi ilacı almalıyım"). Bu bir
 * danışmanlık sorusudur, marketplace talebi değildir; yayınlanamaz,
 * eşleştirilmez, bildirim üretmez. GERÇEK satın alma niyeti bu karara
 * GİRMEZ: "Ağrı kesici arıyorum" bir ürün talebidir ve DEMAND kalır.
 * OTC/reçeteli ilaç ÜRÜN taleplerinin koşulları ayrı bir kurucu kararıdır
 * ve burada verilmemiştir.
 */
export type RequestScope =
  | "DEMAND"
  | "UNSUPPORTED_SUPPLY"
  | "UNSUPPORTED_MEDICAL_ADVICE";

/**
 * Kapsam kapılarının TEK yardımcısı. Yeni bir kapsam-dışı değer
 * eklendiğinde bütün kapılar (soru motoru, review/publish, sunucu şeması,
 * resume) otomatik kapanır; kapı kapı eşitlik denetimi çoğaltılmaz.
 */
export function isUnsupportedRequestScope(
  scope: string | null | undefined,
): boolean {
  return (
    scope === "UNSUPPORTED_SUPPLY" || scope === "UNSUPPORTED_MEDICAL_ADVICE"
  );
}

export type SubjectKind =
  | "VEHICLE"
  | "PRODUCT"
  | "PART"
  | "SERVICE"
  | "PROPERTY"
  | "MANUFACTURED_GOOD"
  | "MACHINE"
  | "UNKNOWN";

/** B3.7 first-class request subject kinds */
export type RequestSubjectKind =
  | "PRODUCT"
  | "PART"
  | "ACCESSORY"
  | "VEHICLE"
  | "REAL_ESTATE"
  | "SERVICE"
  | "MANUFACTURED_ITEM"
  | "INDUSTRIAL_EQUIPMENT"
  | "SOFTWARE"
  | "MEDICAL_DEVICE"
  | "UNKNOWN";

export type ParentEntityKind =
  | "PRODUCT"
  | "VEHICLE"
  | "MACHINE"
  | "DEVICE"
  | "PROPERTY"
  | "OTHER";

export type SubjectRelation =
  | "FOR"
  | "PART_OF"
  | "ACCESSORY_FOR"
  | "SERVICE_FOR"
  | "APPLIES_TO"
  | "MANUFACTURED_AS"
  | "UNKNOWN";

export type RequestRelationship =
  | "PART_FOR_PRODUCT"
  | "ACCESSORY_FOR_PRODUCT"
  | "SERVICE_FOR_OBJECT"
  | "PRODUCT_REQUEST"
  | "VEHICLE_REQUEST"
  | "PROPERTY_REQUEST"
  | "MANUFACTURE_REQUEST"
  | "SOFTWARE_REQUEST"
  | "UNKNOWN";

export type SemanticParentEntity = {
  kind: ParentEntityKind;
  brand?: UnderstandingValue<string>;
  model?: UnderstandingValue<string>;
  series?: UnderstandingValue<string>;
  variant?: UnderstandingValue<string>;
};

export type SemanticRequestSubject = {
  kind: UnderstandingDecision<RequestSubjectKind>;
  name?: UnderstandingValue<string>;
  /** Human phrase e.g. "arka tampon" */
  displayPhrase?: UnderstandingValue<string>;
  position?: UnderstandingValue<string>;
  parentEntity?: SemanticParentEntity;
  relation?: UnderstandingDecision<SubjectRelation>;
  relationship?: UnderstandingDecision<RequestRelationship>;
  serviceType?: UnderstandingValue<string>;
  target?: UnderstandingValue<string>;
  alternatives?: Array<{
    kind: RequestSubjectKind;
    confidence: number;
    evidence?: string[];
  }>;
};

export type RequestUnderstandingDiagnostics = {
  categoryScore?: number;
  categoryConfident?: boolean;
  categoryRunnerUp?: string | null;
  numberRoles?: Array<{ raw: string; role: string; value?: number | string }>;
  intentSignals?: string[];
  notes?: string[];
};

/**
 * Anlaşılan tipli alan varlığı — kalıcı snapshot'a taşınacak biçim (1K).
 * Ham kullanıcı cümlesi buraya kopyalanmaz; yalnız kanonik kimlik taşınır.
 */
export type ResolvedDomainEntityFact = {
  canonicalId: string;
  entityType: string;
  canonicalLabel: string;
  domainId: string;
  matchedAlias?: string;
  confidence: number;
  /** Provenance kaynağı — `AI_INFERRED:talepo-1j-seed` gibi. */
  source: string;
  verificationStatus: string;
};

export type RequestUnderstandingResult = {
  version: "v1";

  rawInput: string;
  normalizedInput: string;

  intent: UnderstandingDecision<RequestIntent>;

  /**
   * Talebin Talepo kapsamına girip girmediği (bkz. RequestScope). Yayın
   * kapısı, soru motoru ve snapshot bu tek kararı okur.
   */
  requestScope: UnderstandingDecision<RequestScope>;

  subject: {
    kind: UnderstandingDecision<SubjectKind>;
    productType?: UnderstandingValue<string>;
    serviceType?: UnderstandingValue<string>;
  };

  /** B3.7 — what the user is actually seeking + entity relationships */
  requestSubject: SemanticRequestSubject;

  category: UnderstandingDecision<string>;

  strategy: UnderstandingDecision<PriceStrategyKey>;

  identity: {
    brand?: UnderstandingValue<string>;
    model?: UnderstandingValue<string>;
    series?: UnderstandingValue<string>;
    variant?: UnderstandingValue<string>;
    identifiers?: UnderstandingValue<string>[];
    fingerprint?: string;
    confidence?: number;
  };

  attributes: Record<string, UnderstandingValue<unknown>>;

  /**
   * ÇÖZÜLEN TİPLİ ALAN VARLIKLARI — platform, yazılım ailesi, makine türü (1K).
   *
   * Bunlar MARKA DEĞİLDİR ve `identity.brand` alanına yazılamaz; ama talebin
   * hangi varlık hakkında olduğunu anlatan kalıcı kanıttır. Alan additive ve
   * opsiyoneldir: eski tüketiciler etkilenmez.
   */
  resolvedEntities?: ResolvedDomainEntityFact[];

  budget?: UnderstandingValue<{
    min?: number;
    max?: number;
    currency?: string;
    period?: string;
  }>;

  location?: {
    city?: UnderstandingValue<string>;
    district?: UnderstandingValue<string>;
    neighborhood?: UnderstandingValue<string>;
  };

  quantity?: UnderstandingValue<{
    value?: number;
    unit?: string;
  }>;

  condition?: UnderstandingValue<"NEW" | "USED" | "REFURBISHED" | "UNKNOWN">;

  preferences: Record<string, UnderstandingValue<unknown>>;

  /**
   * Phase 2 — field-scoped MUST / PREFERRED / EXCLUDED / multi-value / range.
   * Additive; scalar identity/attributes remain backward compatible.
   */
  constraints?: import("./constraint-semantics").ConstraintBundle;

  explicitFacts: UnderstandingFact[];
  inferredFacts: UnderstandingFact[];

  unknownFields: string[];

  ambiguities: UnderstandingAmbiguity[];
  contradictions: UnderstandingContradiction[];

  understandingConfidence: number;

  publishReadiness: {
    status: "READY" | "ENRICHABLE" | "BLOCKED";
    reasons: string[];
  };

  priceAnalysisReadiness: {
    status: "READY" | "LIMITED" | "NOT_READY";
    reasons: string[];
  };

  recommendedQuestions: string[];

  diagnostics?: RequestUnderstandingDiagnostics;

  /**
   * Optional knowledge-layer enrichment (catalog registry).
   * Never authoritative over understandRequest decisions.
   */
  catalogEnrichment?: import("@/lib/catalog/automotive/types").AutomotiveSubjectEnrichment;
};

/**
 * JENERİK ÖZNE YER TUTUCULARI — tek yetkili (Wave L, 2026-08-31).
 *
 * Anlama katmanı özne adı bulamadığında bu jenerik adlarla döner; bunlar
 * ürün türü DEĞİLDİR ve hiçbir tüketici yüzeyine (productType alanı,
 * routing envelope `product`) taşınamaz. Liste daha önce build-state
 * içinde yerel bir regex'ti; yetkiyi bölmemek için buraya taşındı —
 * build-state ve publish snapshot köprüsü AYNI tanımı okur.
 */
export const GENERIC_SUBJECT_PLACEHOLDER_RE =
  /^(ürün|urun|servis|hizmet|cihaz|makine|eşya|esya|üretim|uretim|araç|arac)$/i;
