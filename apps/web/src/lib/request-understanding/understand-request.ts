import {
  CATEGORY_DECISION,
  UNDERSTANDING_CONFIDENCE_WEIGHTS,
  UNDERSTANDING_PENALTIES,
} from "@/lib/request-understanding/confidence-config";
import {
  collectIntentSignals,
  needTypeForIntent,
  resolveIntentFromSignals,
  subjectKindForIntent,
} from "@/lib/request-understanding/intent-signals";
import { isProductTypePhrase } from "@/lib/product-identity/identity-candidates";
import {
  classifyBrandEvidence,
  extractAssertedBrand,
  type BrandEvidenceStatus,
} from "@/lib/product-identity/brand-extraction";
import { isNonBrandDomainEntity, resolveDomainEntity } from "@/lib/catalog";
import { normalizeUnderstandingInput } from "@/lib/request-understanding/normalize";
import {
  classifyModelTokenEvidence,
  classifyNumbers,
  looksLikeTelevisionScreenContext,
  looksLikeYearToken,
  modelIdentifierTokens,
  primaryQuantity,
  primaryYear,
  type ClassifiedNumber,
} from "@/lib/request-understanding/number-role";
import {
  assignAttributeIfNotWeaker,
  clamp01,
  partitionFacts,
  uv,
} from "@/lib/request-understanding/provenance";
import type {
  DecisionStatus,
  RequestIntent,
  RequestScope,
  RequestUnderstandingResult,
  SubjectKind,
  UnderstandingAmbiguity,
  UnderstandingContradiction,
  UnderstandingDecision,
  UnderstandingValue,
} from "@/lib/request-understanding/types";
import { detectCategoryResult, hasFurnitureObjectNoun } from "@/lib/ai/parser/category";
import { findCanonicalCategoryClaim } from "@/lib/taxonomy/phrase-classification";
import { extractBudgetFromText } from "@/lib/ai/parser/budget";
import { detectCity } from "@/lib/ai/parser/entity";
import { findProvinceAndDistrictInText } from "@/lib/geo/turkey-districts";
import {
  getStrategyAttributeProfile,
  type PriceStrategyKey,
} from "@/lib/price-intelligence/price-strategy-registry";
import {
  resolvePriceStrategy,
  type PriceStrategyContext,
} from "@/lib/price-intelligence/strategy-resolver";
import { buildProductIdentity } from "@/lib/product-identity/identity-builder";

import {
  isRequestedItemNotModel,
  SERVICE_LEMMAS,
} from "@/lib/request-understanding/requested-item-role";
import {
  canonicalParentProductSpan,
  findUnresolvedCompatibilityTarget,
  isConsumedAsParentProduct,
  isUsageContextOnlyDesignator,
  readUsageContextSplit,
  resolveRelationDomain,
  splitCompatibilityPhrase,
} from "@/lib/request-understanding/part-relation";

import { findAutomotiveModel, findTechnologyProduct } from "@/lib/ai/parser/brand-catalog";

import { applyCatalogEnrichment } from "@/lib/catalog/apply-enrichment";
import { ensureAutomotiveCatalogRegistered } from "@/lib/catalog/automotive/provider";

import {
  brandsOnlyInExclusion,
  extractConstraintSemantics,
  isConditionUsedNegated,
} from "./constraint-semantics";
import { reconcileUnderstanding } from "./reconcile-understanding";
import {
  reconcileParentIdentityTokens,
  resolveSemanticSubject,
} from "./semantic-subject";
import { inferConditionFromContext } from "./condition-inference";
import type {
  ResolvedDomainEntityFact,
  SemanticRequestSubject,
} from "./types";

export type UnderstandRequestInput = {
  rawInput: string;
  /** Optional structured hints from form (not required) */
  structured?: {
    categoryId?: string | null;
    city?: string | null;
    district?: string | null;
    fieldValues?: Record<string, string | null | undefined>;
  };
};

function decisionStatus(
  confidence: number,
  opts?: { forceUnknown?: boolean; detectorConfident?: boolean },
): DecisionStatus {
  if (opts?.forceUnknown || confidence < CATEGORY_DECISION.unknownBelow) {
    return "UNKNOWN";
  }
  if (
    confidence < CATEGORY_DECISION.tentativeBelow ||
    opts?.detectorConfident === false
  ) {
    return "TENTATIVE";
  }
  return "CONFIDENT";
}

const TR_DIACRITIC_FOLD: Record<string, string> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  ö: "o",
  ş: "s",
  ü: "u",
  â: "a",
  î: "i",
  û: "u",
};

/** tr-TR lowercase + diacritic fold, so "arcelik" matches "Arçelik". */
function foldTr(value: string): string {
  let out = "";
  for (const ch of value.toLocaleLowerCase("tr-TR")) {
    out += TR_DIACRITIC_FOLD[ch] ?? ch;
  }
  return out;
}

/**
 * Diacritic-insensitive containment. Users routinely type without Turkish
 * characters ("arcelik 55 inc tv"); a canonical value they clearly wrote must
 * still count as EXPLICIT, not be downgraded to an inference.
 */
function textIncludes(haystack: string, needle: string): boolean {
  if (!needle.trim()) return false;
  return foldTr(haystack).includes(foldTr(needle));
}

function gateCategory(
  rawInput: string,
  intent: RequestIntent,
): UnderstandingDecision<string> {
  const detected = detectCategoryResult(rawInput);
  const scoreConf = clamp01(detected.score / 6);

  /**
   * ÖNCELİK 1 — KANONİK EN-UZUN EŞLEŞME (2026-08-30).
   *
   * Ölçüldü: tam katalog matrisinde 804 kanonik yaprak adı taksonomide
   * çözülebildiği hâlde token skorlayıcı içlerindeki tek bir genel
   * kelimeye yenildi ("Klima gaz dolumu" → appliances, "Buz Makinesi" →
   * machinery). Metindeki en uzun tam kanonik yaprak/alias eşleşmesi ve
   * onun katalog sahibi artık token skorundan önce gelir; skorlayıcı
   * yalnız kanonik kanıt bulunamayınca çalışan fallback'tir. Çok sahipli
   * ifade tipli belirsizlik politikasından okunur; karar UYDURULMAZ.
   *
   * KURUCU İSTİSNASI KORUNUR (2026-08-23): ürün kategorisinde SERVİS
   * niyeti Hizmetler'e yönlenir (otomotiv hariç). Kanonik iddia bir
   * HİZMET yaprağına çözülüyorsa yönlendirmeye gerek yoktur — sahip
   * kategori hizmetin kanonik evidir; ürün yaprağına çözülüyorsa ve
   * niyet servisse mevcut yönlendirme aynen işler.
   */
  /**
   * "X için Y" cümlelerinde iddia ÜRETİLMEZ: uyumluluk ilişkisinin tek
   * yetkilisi part-relation zinciridir ve kategori kararını rol + bağlam
   * verir (öncelik sözleşmesinin 4. basamağı oradadır). Ölçülen
   * regresyonlar: "Klima için dış ünite fan motoru" iddia yüzünden
   * otomotive, "Renault Clio için bakım" bebek "Bakım" düğümüne
   * kayıyordu. Bağlaçsız düz metinde iddia tam yetkilidir.
   */
  const rawClaim = findCanonicalCategoryClaim(rawInput);
  const claimSpansConnective =
    rawClaim != null && /(?:^|[^\p{L}])i[cç]in(?:[^\p{L}]|$)/iu.test(rawClaim.phrase);
  const claim =
    splitCompatibilityPhrase(rawInput) && !claimSpansConnective
      ? null
      : rawClaim;
  /**
   * Servis niyeti kanıtı, iddia edilen kanonik adın DIŞINDA aranır: "Video
   * Montaj Donanımı ... arıyorum" bir donanım satın alma talebidir; ürün
   * adının içindeki "montaj" sözcüğü servis niyeti sayılırsa kanonik ürün
   * Hizmetler'e sürülür (ölçüldü). Ad çıkarıldıktan sonra kalan metinde
   * servis dili varsa kurucu yönlendirmesi aynen işler.
   */
  /**
   * Hizmet dili tek yetkiliden türetilir (SERVICE_LEMMAS) — ikinci bir
   * fiil listesi tutulmaz. "yaptır" lemmalarda yoktur çünkü o bir niyet
   * fiilidir; burada niyet + lemma birlikte arandığı için eklenir.
   */
  const SERVICE_WORD_RE = new RegExp(
    [...SERVICE_LEMMAS, "yaptır", "yaptir", "arıza", "ariza"]
      /* Türkçe ünsüz yumuşaması: "temizlik" iyelikle "temizliği" olur. */
      .map((l) => l.replace(/k$/u, "[kğg]"))
      .join("|"),
    "i",
  );
  const textOutsideClaim = claim
    ? rawInput
        .toLocaleLowerCase("tr-TR")
        .replace(claim.phrase.toLocaleLowerCase("tr-TR"), " ")
    : rawInput;
  /* Niyet etiketi bu noktada henüz kaba olabilir; belirleyici olan, adın
     DIŞINDA gerçek servis dili bulunmasıdır ("web sitesi yaptırmak
     istiyorum" → yaptır dışarıda → kurucu yönlendirmesi işler). */
  const serviceIntentForClaim = SERVICE_WORD_RE.test(textOutsideClaim);
  if (claim?.kind === "unique") {
    const claimIsService = claim.node.nodeType === "SERVICE_TYPE";
    const productServiceRedirect =
      serviceIntentForClaim &&
      !claimIsService &&
      claim.categoryId !== "automotive";
    if (!productServiceRedirect) {
      return {
        value: claim.categoryId,
        confidence: Math.max(0.85, scoreConf),
        status: "CONFIDENT",
        evidence: [
          "canonical-claim",
          `phrase=${claim.phrase}`,
          `node=${claim.node.id}`,
          `span=${claim.span}`,
        ],
      };
    }
  } else if (claim?.kind === "ambiguous") {
    return {
      value: null,
      confidence: 0.4,
      status: "UNKNOWN",
      evidence: [
        "canonical-claim-ambiguous",
        `phrase=${claim.phrase}`,
        `allowed=${claim.categoryIds.join("|")}`,
      ],
      alternatives: claim.categoryIds.map((cid) => ({
        value: cid,
        confidence: 0.5,
        evidence: ["ambiguity-policy"],
      })),
    };
  }

  const alternatives =
    detected.runnerUpId && detected.runnerUpScore > 0
      ? [
          {
            value: detected.runnerUpId,
            confidence: clamp01(detected.runnerUpScore / 6),
            evidence: [`runnerUpScore=${detected.runnerUpScore}`],
          },
        ]
      : undefined;

  // Kurucu (2026-08-23): ürün kategorisinde SERVİS niyeti (kombi bakımı,
  // buzdolabı tamiri, web sitesi yaptırmak…) Hizmetler'e yönlenir.
  // Otomotiv hariç — aracın kendi servis akışı (arac-bakim) vardır.
  const PRODUCT_TO_SERVICE_CATEGORIES = new Set([
    "appliances",
    "technology",
    "home-kitchen",
    "furniture",
    "machinery",
    "baby",
  ]);
  // "yaptırmak" MANUFACTURE niyeti sayılır (kartvizit akışı) — bakım/tamir
  // bağlamında ise bu bir hizmet talebidir, üretim değil.
  const SERVICE_CONTEXT_RE =
    /bak[ıi]m|tamir|onar[ıi]m|montaj|kurulum|servis|ar[ıi]za/i;
  const serviceIntentDetected =
    intent === "SERVICE" ||
    (intent === "MANUFACTURE" && SERVICE_CONTEXT_RE.test(rawInput));
  if (
    serviceIntentDetected &&
    detected.categoryId &&
    PRODUCT_TO_SERVICE_CATEGORIES.has(detected.categoryId)
  ) {
    return {
      value: "services",
      confidence: Math.max(scoreConf, 0.75),
      status: "CONFIDENT",
      evidence: [
        `detector=${detected.categoryId}`,
        "service-intent-routes-to-services",
      ],
      alternatives: [
        {
          value: detected.categoryId,
          confidence: scoreConf,
          evidence: [`productCategory=${detected.categoryId}`],
        },
      ],
    };
  }

  // NO DEFAULT SERVICES: score 0 / unconfident services → UNKNOWN
  if (detected.score <= 0) {
    return {
      value: null,
      confidence: 0,
      status: "UNKNOWN",
      evidence: ["no category evidence"],
      alternatives,
    };
  }

  if (detected.categoryId === "services" && !detected.confident) {
    return {
      value: null,
      confidence: scoreConf,
      status: "UNKNOWN",
      evidence: [
        `detector=${detected.categoryId}`,
        `score=${detected.score}`,
        "unconfident-services-suppressed",
      ],
      alternatives,
    };
  }

  // Purchase/product intents should not inherit a confident SERVICE category from weak lexicon
  if (
    detected.categoryId === "services" &&
    (intent === "BUY" || intent === "SELL" || intent === "PART" || intent === "MANUFACTURE") &&
    detected.score < CATEGORY_DECISION.confidentMinScore + 2
  ) {
    return {
      value: detected.confident ? detected.categoryId : null,
      confidence: Math.min(scoreConf, 0.4),
      status: "TENTATIVE",
      evidence: [
        `detector=${detected.categoryId}`,
        `score=${detected.score}`,
        "intent-overrides-weak-services",
      ],
      alternatives,
    };
  }

  // Detector found evidence (score > 0): never nullify value.
  // Weak scores stay TENTATIVE so filters follow the detected category.
  const status = decisionStatus(scoreConf, {
    detectorConfident: detected.confident,
  });
  const resolvedStatus =
    detected.confident && scoreConf >= CATEGORY_DECISION.tentativeBelow
      ? "CONFIDENT"
      : status === "UNKNOWN"
        ? "TENTATIVE"
        : status;

  return {
    value: detected.categoryId,
    confidence: Math.max(scoreConf, CATEGORY_DECISION.unknownBelow),
    status: resolvedStatus,
    evidence: [
      `detector=${detected.categoryId}`,
      `score=${detected.score}`,
      `confident=${detected.confident}`,
    ],
    alternatives,
  };
}

function extractCondition(
  normalized: string,
): UnderstandingValue<"NEW" | "USED" | "REFURBISHED" | "UNKNOWN"> | undefined {
  if (
    /\b(sıfır|sifir|0\s*km|brand\s*new)\b/i.test(normalized)
  ) {
    return uv("NEW", {
      provenance: "EXPLICIT",
      source: "USER_EXPLICIT",
      evidence: ["condition:new"],
    });
  }
  if (
    /\b(ikinci\s*el|2\.?\s*el|used|refurbished|yenilenmiş|yenilenmis)\b/i.test(
      normalized,
    )
  ) {
    // "ikinci el olmasın" is exclusion, not positive USED
    if (isConditionUsedNegated(normalized)) return undefined;
    return uv("USED", {
      provenance: "EXPLICIT",
      source: "USER_EXPLICIT",
      evidence: ["condition:used"],
    });
  }
  // Salvage / used-part language ("çıkma motor") — part condition, not vehicle ask.
  // JS \\b is ASCII-only; use Unicode letter boundaries for Turkish ç/ı.
  if (
    /(?:^|[^\p{L}\p{N}])(?:çıkma|cikma)(?=[^\p{L}\p{N}]|$)/iu.test(normalized)
  ) {
    return uv("USED", {
      provenance: "EXPLICIT",
      source: "USER_EXPLICIT",
      evidence: ["condition:cikma-part"],
    });
  }
  return undefined;
}

function extractPreferences(
  normalized: string,
): Record<string, UnderstandingValue<unknown>> {
  const prefs: Record<string, UnderstandingValue<unknown>> = {};

  if (/\bdüşük\s*km\b|\bdusuk\s*km\b|\baz\s*km\b/i.test(normalized)) {
    prefs.mileagePreference = uv("LOW", {
      provenance: "EXPLICIT",
      source: "USER_EXPLICIT",
      evidence: ["düşük km"],
    });
  }
  if (/\baz\s*kullanılmış\b|\baz\s*kullanilmis\b/i.test(normalized)) {
    prefs.usagePreference = uv("LOW_USAGE", {
      provenance: "EXPLICIT",
      source: "USER_EXPLICIT",
      evidence: ["az kullanılmış"],
    });
  }
  if (/\btemiz\b/i.test(normalized)) {
    prefs.cleanlinessPreference = uv("CLEAN", {
      provenance: "EXPLICIT",
      source: "USER_EXPLICIT",
      evidence: ["temiz"],
    });
  }
  if (/\biyi\s*durumda\b|\bkaliteli\b/i.test(normalized)) {
    prefs.qualityPreference = uv("GOOD", {
      provenance: "EXPLICIT",
      source: "USER_EXPLICIT",
      evidence: ["quality fuzzy"],
    });
  }
  if (
    /\bfiyat\s*çok\s*uçmasın\b|\bfiyat\s*cok\s*ucmasin\b|\buygun\s*fiyat/i.test(
      normalized,
    )
  ) {
    prefs.budgetPreference = uv("MODERATE", {
      provenance: "EXPLICIT",
      source: "USER_EXPLICIT",
      evidence: ["fuzzy budget preference"],
    });
  }
  if (/\bacil\b/i.test(normalized)) {
    prefs.urgencyPreference = uv("URGENT", {
      provenance: "EXPLICIT",
      source: "USER_EXPLICIT",
      evidence: ["acil"],
    });
  }
  // JS \b is ASCII-word only — Turkish ı breaks word boundaries
  if (
    normalized.includes("kiracılı") ||
    normalized.includes("kiracili") ||
    normalized.includes("kiracı") ||
    normalized.includes("kiraci")
  ) {
    prefs.tenantOccupied = uv(true, {
      provenance: "EXPLICIT",
      source: "USER_EXPLICIT",
      evidence: ["kiracılı"],
    });
  }

  return prefs;
}

function extractRoomLayout(
  normalized: string,
  categoryId?: string | null,
): UnderstandingValue<string> | undefined {
  // Room layouts are real-estate only — never treat "2+1" as quantity elsewhere.
  if (categoryId && categoryId !== "real-estate") return undefined;
  const m = normalized.match(/\b([1-9]\s*\+\s*[0-9])\b/);
  if (!m) return undefined;
  // Avoid math-like noise without RE context when category still unknown:
  // require RE lexical cues in the same text when category not yet resolved.
  if (!categoryId || categoryId === "real-estate") {
    const reCue =
      /\b(ev|daire|konut|villa|müstakil|mustakil|ofis|işyeri|isyeri|satılık|satilik|kiralık|kiralik|oda)\b/i.test(
        normalized,
      );
    if (!categoryId && !reCue) return undefined;
  }
  return uv(m[1]!.replace(/\s+/g, ""), {
    provenance: "EXPLICIT",
    source: "USER_EXPLICIT",
    evidence: [m[0]],
  });
}

/**
 * İLAN TÜRÜ — KULLANICININ YAZDIĞI SÖZ İLE ÇIKARIM AYRI İŞARETLENİR (KB-16).
 *
 * Eski sürüm, niyet RENT/SELL olduğunda kullanıcı "kiralık"/"satılık"
 * yazmamış olsa bile alanı EXPLICIT / USER_EXPLICIT provenance ve
 * `evidence: ["kiralık"]` ile dolduruyordu. Bu iki ayrı kusurdu: kullanıcının
 * yazmadığı bir söz kanıt gibi kaydediliyor, ve üretilen bu "kanıt"
 * `semantic-subject` içindeki emlak dalını besleyerek "Araç kiralamak
 * istiyorum" talebini gayrimenkul yapıyordu.
 *
 * Alan korunur — yalnız hak ettiği statüyle: yazılmışsa EXPLICIT, işlemden
 * türetilmişse INFERRED.
 */
function extractListingType(
  normalized: string,
  intent: RequestIntent,
): UnderstandingValue<string> | undefined {
  const saleWord = normalized.match(/\bsatılık\b|\bsatilik\b/i);
  const rentWord = normalized.match(/\bkiralık\b|\bkiralik\b/i);
  // Yazılmış söz her hâlükârda çıkarımı yener; "satılık" ikisi birden
  // geçtiğinde önceliklidir (kiracılı satılık ilanları).
  if (saleWord) {
    return uv("Satılık", {
      provenance: "EXPLICIT",
      source: "USER_EXPLICIT",
      evidence: [saleWord[0]],
    });
  }
  if (rentWord) {
    return uv("Kiralık", {
      provenance: "EXPLICIT",
      source: "USER_EXPLICIT",
      evidence: [rentWord[0]],
    });
  }
  if (intent === "SELL") {
    return uv("Satılık", {
      provenance: "INFERRED",
      source: "DETERMINISTIC_INFERENCE",
      evidence: [`intent=${intent}`],
    });
  }
  if (intent === "RENT") {
    return uv("Kiralık", {
      provenance: "INFERRED",
      source: "DETERMINISTIC_INFERENCE",
      evidence: [`intent=${intent}`],
    });
  }
  return undefined;
}

function buildUnknownFields(input: {
  strategy: PriceStrategyKey;
  resolvedKeys: Set<string>;
}): string[] {
  const profile = getStrategyAttributeProfile(input.strategy);
  const candidates = [
    ...profile.required,
    ...profile.important,
    ...profile.optional,
    "budget",
    "location",
  ];

  const semanticToField: Record<string, string> = {
    "brand-like": "brand",
    "model-like": "model",
    "series-like": "series",
    "variant-like": "variant",
    "storage-like": "storage",
    "capacity-like": "capacity",
    "condition-like": "condition",
    "year-like": "modelYear",
    "size-like": "size",
    "product-type-like": "productType",
    "part-type-like": "part",
  };

  const unknowns: string[] = [];
  for (const key of candidates) {
    const field = semanticToField[key] ?? key;
    if (input.resolvedKeys.has(field) || input.resolvedKeys.has(key)) continue;
    if (!unknowns.includes(field)) unknowns.push(field);
  }
  return unknowns;
}

function computeUnderstandingConfidence(input: {
  intent: UnderstandingDecision<RequestIntent>;
  category: UnderstandingDecision<string>;
  strategy: UnderstandingDecision<PriceStrategyKey>;
  identityConfidence: number;
  attributeConfidence: number;
  ambiguityCount: number;
  contradictionCount: number;
}): number {
  const w = UNDERSTANDING_CONFIDENCE_WEIGHTS;
  let score =
    input.intent.confidence * w.intent +
    input.category.confidence * w.category +
    input.strategy.confidence * w.strategy +
    input.identityConfidence * w.identity +
    input.attributeConfidence * w.attributes;

  score -= input.ambiguityCount * UNDERSTANDING_PENALTIES.ambiguity;
  score -= input.contradictionCount * UNDERSTANDING_PENALTIES.contradiction;
  if (input.category.status === "TENTATIVE") {
    score -= UNDERSTANDING_PENALTIES.tentativeCategory;
  }
  if (input.intent.value === "UNKNOWN" || input.intent.status === "UNKNOWN") {
    score -= UNDERSTANDING_PENALTIES.unknownIntent;
  }
  return clamp01(score);
}

function yearAmbiguities(
  numbers: ClassifiedNumber[],
  normalized: string,
): UnderstandingAmbiguity[] {
  const years = numbers.filter((n) => n.role === "MODEL_YEAR");
  if (years.length >= 2) {
    return [
      {
        kind: "MODEL_YEAR_RANGE",
        message: "Multiple year references without a single resolved year",
        candidates: years.map((y) => String(y.value)),
      },
    ];
  }
  if (
    years.length === 1 &&
    /sonrası|sonrasi|üstü|ustu|öncesi|oncesi|ama/.test(normalized)
  ) {
    return [
      {
        kind: "MODEL_YEAR_FLEXIBLE",
        message: "Year stated with flexible/conflicting qualifier",
        candidates: [String(years[0]!.value)],
      },
    ];
  }
  return [];
}

/** Test/instrumentation — authoritative Single Brain call count. */
let understandCallCount = 0;

export function getUnderstandCallCount(): number {
  return understandCallCount;
}

export function resetUnderstandCallCount(): void {
  understandCallCount = 0;
}

/** Cached empty shell for consumers when hybrid state is not ready (not a second authority). */
let emptyUnderstandingCache: RequestUnderstandingResult | null = null;

export function emptyRequestUnderstanding(): RequestUnderstandingResult {
  if (!emptyUnderstandingCache) {
    emptyUnderstandingCache = understandRequest("");
  }
  return emptyUnderstandingCache;
}

/**
 * Canonical Request Understanding entry point.
 * Orchestrates existing engines — does not rewrite them.
 */
export function understandRequest(
  input: UnderstandRequestInput | string,
): RequestUnderstandingResult {
  understandCallCount += 1;
  const rawInput = typeof input === "string" ? input : input.rawInput;
  const structured = typeof input === "string" ? undefined : input.structured;
  const normalizedInput = normalizeUnderstandingInput(rawInput);

  const numbers = classifyNumbers(normalizedInput);
  /**
   * İŞLEM KAPSAMI (KB-16): "Kiralık makine için bakım arıyorum" cümlesinde
   * işlem belirteci soldaki KULLANIM BAĞLAMINDADIR; istenen şey bakımdır.
   * İlişkinin iki yakası burada yeniden çözülmez — tek yetkili
   * `readUsageContextSplit` sonucu olduğu gibi işlem otoritesine geçirilir.
   */
  const intentUsageSplit = readUsageContextSplit(normalizedInput);
  const intentHits = collectIntentSignals(normalizedInput, {
    usageContext: intentUsageSplit?.context ?? null,
    requestedTarget: intentUsageSplit?.target ?? null,
  });
  let intentResolved = resolveIntentFromSignals(intentHits);

  const modelTokens = modelIdentifierTokens(numbers);
  const autoModel = findAutomotiveModel(normalizedInput);
  // Phone/tablet catalog must not invent models in television contexts (A55 ≠ Galaxy A55).
  const techProduct = looksLikeTelevisionScreenContext(normalizedInput)
    ? null
    : findTechnologyProduct(normalizedInput);
  const hasVehicleModel = Boolean(autoModel) || modelTokens.some((t) =>
    /^[a-z]?\d{2,3}[a-z]?$/i.test(t.raw.replace(/\s/g, "")) ||
    /^[cesagl]\d{2,3}/i.test(t.raw),
  );

  const hasPropertySignals =
    (/\b(ev|daire|dükkan|dukkan|villa|konut|2\s*\+\s*1|3\s*\+\s*1)\b/i.test(
      normalizedInput,
    ) ||
      Boolean(extractRoomLayout(normalizedInput)) ||
      (/\bofis\b/i.test(normalizedInput) &&
        /kiralık|kiralik|satılık|satilik|kiralamak|metrekare|\bm2\b|m²/.test(
          normalizedInput,
        ))) &&
    !hasFurnitureObjectNoun(normalizedInput);

  const hasMachineSignals =
    /\b(makine|pres|cnc|heidelberg|kompresör|kompresor)\b/i.test(normalizedInput);

  const hasProductSignals =
    modelTokens.length > 0 ||
    /\b(makinesi|telefon|iphone|süpürge|supurge|araba|cihaz)\b/i.test(
      normalizedInput,
    );

  const subjectKind = subjectKindForIntent(intentResolved.intent, {
    hasVehicleModel:
      hasVehicleModel &&
      intentResolved.intent !== "PART" &&
      intentResolved.intent !== "SERVICE",
    hasPropertySignals,
    hasMachineSignals:
      hasMachineSignals && intentResolved.intent !== "SERVICE",
    hasProductSignals,
  });

  // Force PART/SERVICE subject from strong intent
  const subjectValue: SubjectKind =
    intentResolved.intent === "PART"
      ? "PART"
      : intentResolved.intent === "SERVICE"
        ? "SERVICE"
        : intentResolved.intent === "MANUFACTURE"
          ? "MANUFACTURED_GOOD"
          : subjectKind;

  const intentDecision: UnderstandingDecision<RequestIntent> = {
    value: intentResolved.intent,
    confidence: intentResolved.confidence,
    status: decisionStatus(intentResolved.confidence, {
      forceUnknown: intentResolved.intent === "UNKNOWN",
    }),
    evidence: intentResolved.evidence,
  };

  const subjectDecision: UnderstandingDecision<SubjectKind> = {
    value: subjectValue,
    confidence: intentResolved.confidence,
    status: decisionStatus(intentResolved.confidence, {
      forceUnknown: subjectValue === "UNKNOWN",
    }),
    evidence: [`subjectFromIntent=${intentResolved.intent}`],
  };

  let category = gateCategory(normalizedInput, intentResolved.intent);

  /**
   * KANONİK İDDİA SONRAKİ TAHMİNLERLE EZİLMEZ (2026-08-30).
   *
   * `gateCategory` metindeki EN UZUN tam kanonik yaprak eşleşmesiyle kesin
   * karar verdiyse, daha KISA span'lı semantik tahminler (tek kelimelik
   * domain izi, hizmet sözcüğü) o kararı geri alamaz — öncelik sözleşmesi
   * tam bu sırayı kurar. Kullanıcının kendi seçimi (STRUCTURED_FIELD) bu
   * kuralın ÜSTÜNDEDİR ve kendi dalında zaten kazanır.
   */
  const categoryFromCanonicalClaim = () =>
    category.evidence?.[0] === "canonical-claim" &&
    category.status === "CONFIDENT";

  // STRUCTURED OVERRIDE wins over inference (user locked category / form pick)
  const structuredCategoryId = structured?.categoryId?.trim() || null;
  if (structuredCategoryId) {
    category = {
      value: structuredCategoryId,
      confidence: 0.98,
      status: "CONFIDENT",
      evidence: [
        "STRUCTURED_FIELD",
        `categoryOverride=${structuredCategoryId}`,
      ],
      alternatives: category.value
        ? [
            {
              value: category.value,
              confidence: category.confidence,
              evidence: category.evidence,
            },
          ]
        : category.alternatives,
    };
  }

  /**
   * KULLANIM BAĞLAMI KATEGORİYİ BELİRLEYEMEZ (1H).
   *
   * "X için Y" yapısında sağ taraf bütün bir ÜRÜN ya da HİZMET ise asıl talep
   * konusu Y'dir; X yalnız kullanım amacı, hedef kitle, yer ya da kurum
   * bağlamıdır. Kategori dedektörü ham cümlenin TAMAMINI tarıyor ve soldaki
   * bağlamı asıl ürün sanıyordu:
   *   "Ev için klima arıyorum"           → real-estate (oysa klima talebi)
   *   "WordPress için teknik destek"     → machinery   (oysa hizmet talebi)
   *
   * Kategori bu durumda SAĞ hedeften yeniden türetilir. Kural yetki sırasını
   * bozmaz: kullanıcının kilitlediği / formdan seçtiği kategori (structured
   * override) yukarıda belirlenmiştir ve burada ezilmez. Sağ hedef kategori
   * üretemiyorsa mevcut karar olduğu gibi kalır — rastgele kategori seçilmez.
   */
  const usageContext = structuredCategoryId
    ? null
    : readUsageContextSplit(normalizedInput);
  /**
   * UZMANLIK ALANI, İHTİYAÇ TÜRÜNDEN AYRI BİR EKSENDİR (1I).
   *
   * Doğrulanmış ürün/platform kanıtı (kanonik parça taşıyan düğüm ya da
   * katalog markası) alanı belirler; hizmet olmak bu alanı silmez.
   * Kullanıcının kilitlediği kategori burada da dokunulmaz kalır.
   */
  const relationDomain = structuredCategoryId
    ? null
    : resolveRelationDomain(normalizedInput);
  /**
   * Talepte geçen tipli alan varlıkları — kategori kararından BAĞIMSIZ
   * olarak kaydedilir. Kullanıcı kategoriyi kilitlemiş olsa bile talebin
   * hangi platform/makine hakkında olduğu bilgisi kaybolmamalıdır (1K).
   */
  const domainEntityHit = resolveDomainEntity(normalizedInput);
  const resolvedDomainEntities: ResolvedDomainEntityFact[] =
    domainEntityHit.status !== "NONE" && domainEntityHit.entity
      ? [
          {
            canonicalId: domainEntityHit.entity.canonicalId,
            entityType: domainEntityHit.entity.entityType,
            canonicalLabel: domainEntityHit.entity.label,
            domainId: domainEntityHit.entity.domainCategoryId,
            ...(domainEntityHit.matchedAlias
              ? { matchedAlias: domainEntityHit.matchedAlias }
              : {}),
            confidence:
              domainEntityHit.evidenceStrength === "VERIFIED" ? 0.8 : 0.5,
            source: `${domainEntityHit.entity.provenance.sourceType}:${domainEntityHit.entity.provenance.sourceName}`,
            verificationStatus:
              domainEntityHit.entity.provenance.verificationStatus,
          },
        ]
      : [];
  if (usageContext && !categoryFromCanonicalClaim()) {
    /* Bağlacın kendisi kanonik yaprak ADININ içindeyse ("Mobilyalar için
       Zemin Koruyucular") bu bir kullanım bağlamı cümlesi değil, ürünün
       adıdır; bölme mantığı iddiayı ezemez (ölçüldü). */
    const fromTarget = gateCategory(usageContext.target, intentResolved.intent);
    if (
      fromTarget.value &&
      fromTarget.status !== "UNKNOWN" &&
      fromTarget.value !== category.value
    ) {
      category = {
        ...fromTarget,
        evidence: [
          "usage-context-split",
          `target=${usageContext.target}`,
          ...(fromTarget.evidence ?? []),
        ],
        alternatives: category.value
          ? [
              {
                value: category.value,
                confidence: category.confidence,
                evidence: category.evidence,
              },
            ]
          : fromTarget.alternatives,
      };
    } else if (
      !fromTarget.value &&
      !relationDomain &&
      category.value &&
      /**
       * BU RET YALNIZ ROLÜ ÇÖZÜLMÜŞ HEDEFLER İÇİNDİR (S2A kapsam koruması).
       *
       * Kural, sağdaki hedefin bütün ürün ya da hizmet olduğu — yani kendi
       * kategorisini taşıyabildiği — cümleler için yazıldı. S2A ile bölme
       * rolü BİLİNMEYEN hedefleri de kapsıyor; orada hedefin kategori
       * üretmemesi olağandır ve elde kalan tek kanıtı da atmak talebi
       * yönlendirilemez hâle getirir (ölçüldü: "Matbaa için mürekkep"
       * printing → null). Zayıf bağlam kanıtı, hiç kategori olmamasından
       * iyidir; kesinlik iddiası zaten `status` ile taşınır.
       */
      usageContext.role !== "UNKNOWN"
    ) {
      /**
       * Sağ hedef kategori üretemedi ve solda DOĞRULANMIŞ bir ürün/platform
       * yok: geriye yalnız ham cümlenin bağlam yakasından gelen zayıf
       * anahtar kelime kalıyor. Ölçülen gürültü: "WordPress için teknik
       * destek" → machinery (WordPress'in içindeki "press"), "CNC tezgahı
       * için teknik servis" → furniture ("tezgah"). Böyle bir kanıt alan
       * kararı taşıyamaz; karar çözülmemiş bırakılır ve aşağıdaki genel
       * hizmet yedeği devreye girer.
       */
      category = {
        value: null,
        confidence: 0,
        status: "UNKNOWN",
        evidence: [
          "usage-context-split",
          `target=${usageContext.target}`,
          "context-only-category-evidence-rejected",
        ],
        alternatives: [
          {
            value: category.value,
            confidence: category.confidence,
            evidence: category.evidence,
          },
        ],
      };
    }
  }
  if (
    relationDomain &&
    relationDomain.categoryId !== category.value &&
    /* Ölçüldü: "Klima gaz dolumu" (3 sözcüklü kanonik hizmet yaprağı) tek
       sözcüklük "Klima" domain izine yenilip appliances'a taşınıyordu. */
    !categoryFromCanonicalClaim()
  ) {
    category = {
      value: relationDomain.categoryId,
      confidence: relationDomain.verified
        ? Math.max(category.confidence, 0.8)
        : Math.max(category.confidence, 0.5),
      status: relationDomain.verified ? "CONFIDENT" : "TENTATIVE",
      evidence: [relationDomain.code, `domainSpan=${relationDomain.span}`],
      alternatives: category.value
        ? [
            {
              value: category.value,
              confidence: category.confidence,
              evidence: category.evidence,
            },
          ]
        : category.alternatives,
    };
  }

  /**
   * KANONİK ÜST ÜRÜN KATEGORİNİN DE KAYNAĞIDIR (1D).
   *
   * "X için Y" yapısında X kanonik olarak parça taşıyan bir ürün ise
   * kategorinin o ürünün ALANI olması gerekir. Ölçülen hata: "Klima için dış
   * ünite fan motoru arıyorum" → `automotive` (çünkü "klima" aynı zamanda
   * otomotiv yedek parça grubunun adı) — oysa solda beyaz eşya "Klima"
   * düğümü kanonik olarak tüketilmişti.
   *
   * Yalnız kategori KESİN DEĞİLKEN devreye girer: kullanıcının kilitlediği
   * ya da yüksek güvenli bir kategori kararı ezilmez.
   */
  const canonicalParent = canonicalParentProductSpan(normalizedInput);
  if (
    canonicalParent &&
    category.status !== "CONFIDENT" &&
    canonicalParent.node.categoryId !== category.value
  ) {
    category = {
      value: canonicalParent.node.categoryId,
      confidence: 0.8,
      status: "CONFIDENT",
      evidence: [
        "canonical-parent-product",
        `parentNode=${canonicalParent.node.id}`,
      ],
      alternatives: category.value
        ? [
            {
              value: category.value,
              confidence: category.confidence,
              evidence: category.evidence,
            },
          ]
        : category.alternatives,
    };
  }

  // Product identity (reuse V1.1) — use gated category or empty slug
  const categorySlugForIdentity =
    category.status === "CONFIDENT" && category.value
      ? category.value
      : category.status === "TENTATIVE" && category.value
        ? category.value
        : "unknown";

  const identity = buildProductIdentity({
    categoryId: categorySlugForIdentity,
    categorySlug: categorySlugForIdentity,
    title: rawInput,
    fieldValues: structured?.fieldValues
      ? Object.entries(structured.fieldValues)
          .filter(([, v]) => v != null && String(v).trim())
          .map(([key, value]) => ({ key, value: String(value) }))
      : undefined,
    city: structured?.city,
    district: structured?.district,
  });

  const attributes: Record<string, UnderstandingValue<unknown>> = {};
  const preferences = extractPreferences(normalizedInput);

  const qty = primaryQuantity(numbers);
  const quantity = qty
    ? uv(
        { value: qty.value, unit: qty.unit },
        {
          provenance: "EXPLICIT",
          source: "USER_EXPLICIT",
          evidence: qty.evidence,
        },
      )
    : undefined;

  const year = primaryYear(numbers);
  const years = numbers.filter((n) => n.role === "MODEL_YEAR");
  const yearRelation = /sonrası|sonrasi|üstü|ustu/.test(normalizedInput)
    ? "min"
    : /öncesi|oncesi|altı|alti/.test(normalizedInput)
      ? "max"
      : "exact";
  if (year && years.length === 1) {
    if (yearRelation === "exact" && !/ama/.test(normalizedInput)) {
      attributes.modelYear = uv(year.value!, {
        provenance: "EXPLICIT",
        source: "USER_EXPLICIT",
        evidence: year.evidence,
      });
    } else if (yearRelation === "min") {
      attributes.yearMin = uv(year.value!, {
        provenance: "EXPLICIT",
        source: "USER_EXPLICIT",
        evidence: [...year.evidence, "year-relation:min"],
      });
    } else if (yearRelation === "max") {
      attributes.yearMax = uv(year.value!, {
        provenance: "EXPLICIT",
        source: "USER_EXPLICIT",
        evidence: [...year.evidence, "year-relation:max"],
      });
    }
  }

  if (category.value === "automotive") {
    const fuel = /\b(dizel|benzin|hibrit|elektrikli?|lpg)\b/i.exec(normalizedInput);
    if (fuel?.[1]) {
      const folded = fuel[1].toLocaleLowerCase("tr-TR");
      const value = folded.startsWith("elektrik")
        ? "Elektrik"
        : folded === "lpg"
          ? "LPG"
          : folded[0]!.toLocaleUpperCase("tr-TR") + folded.slice(1);
      attributes.fuel = uv(value, {
        provenance: "EXPLICIT",
        source: "USER_EXPLICIT",
        evidence: [fuel[0]],
      });
    }

    const transmission = /\b(yarı\s+otomatik|yari\s+otomatik|otomatik|manuel|düz\s+vites|duz\s+vites)\b/i.exec(
      normalizedInput,
    );
    if (transmission?.[1]) {
      const folded = transmission[1].toLocaleLowerCase("tr-TR");
      const value = /yarı|yari/.test(folded)
        ? "Yarı otomatik"
        : /manuel|düz|duz/.test(folded)
          ? "Manuel"
          : "Otomatik";
      attributes.transmission = uv(value, {
        provenance: "EXPLICIT",
        source: "USER_EXPLICIT",
        evidence: [transmission[0]],
      });
    }
  }

  for (const n of numbers) {
    if (n.role === "WEIGHT" && n.value != null) {
      attributes.weight = uv(
        { value: n.value, unit: n.unit },
        {
          provenance: "EXPLICIT",
          source: "USER_EXPLICIT",
          evidence: n.evidence,
        },
      );
      if (n.unit === "gr" || n.unit === "gram") {
        attributes.paperWeight = uv(n.value, {
          provenance: "EXPLICIT",
          source: "USER_EXPLICIT",
          evidence: n.evidence,
        });
      }
    }
    if (n.role === "AREA" && n.value != null) {
      attributes.area = uv(
        { value: n.value, unit: "m2" },
        {
          provenance: "EXPLICIT",
          source: "USER_EXPLICIT",
          evidence: n.evidence,
        },
      );
    }
    if (n.role === "TIRE_SIZE") {
      // Kanonik yazım: "205/55 R16" — schema anahtarı automotive/lastik-ve-jant.tireSize
      const canonical = n.raw
        .toLocaleUpperCase("tr-TR")
        .replace(/\s*\/\s*/, "/")
        .replace(/(\d)\s*Z?R\s*(\d)/, "$1 R$2");
      attributes.tireSize = uv(canonical, {
        provenance: "EXPLICIT",
        source: "USER_EXPLICIT",
        evidence: n.evidence,
      });
    }
    if (n.role === "CAPACITY" && n.unit === "btu" && n.value != null) {
      // Schema anahtarı: appliances.capacityBtu (birim BTU)
      attributes.capacityBtu = uv(n.value, {
        provenance: "EXPLICIT",
        source: "USER_EXPLICIT",
        evidence: n.evidence,
      });
    }
    if (n.role === "SEATING" && n.value != null) {
      // Additive tipli attribute: kişi/oturma kapasitesi ("6 kişilik").
      attributes.seatingCapacity = uv(
        { value: n.value, unit: "kişilik" },
        {
          provenance: "EXPLICIT",
          source: "USER_EXPLICIT",
          evidence: n.evidence,
        },
      );
    }
    if (n.role === "STORAGE" && n.value != null) {
      attributes.storage = uv(
        { value: n.value, unit: n.unit },
        {
          provenance: "EXPLICIT",
          source: "USER_EXPLICIT",
          evidence: n.evidence,
        },
      );
    }
    if (n.role === "SCREEN_SIZE" && n.value != null) {
      attributes.screenSize = uv(String(n.value), {
        provenance: "EXPLICIT",
        source: "USER_EXPLICIT",
        evidence: n.evidence,
      });
    }
    /**
     * ÖLÇÜ SPAN'İ ALANA BAĞLANIR (KB-15).
     *
     * Sayı otoritesi "20x15x10" span'ini ZATEN `DIMENSION` diye işaretliyordu;
     * eksik olan çıkarım değil, BAĞLAMAYDI. Buradaki her dal `n.value != null`
     * istiyor, ölçü ise skaler değil bileşik bir span olduğu için `value`
     * taşımıyor ve hiçbir dala giremiyordu. Sonuç: kullanıcı ölçüyü yazıyor,
     * `dimensions` alanı boş kalıyor ve soru tekrar soruluyordu.
     *
     * Kanıt yetmiyorsa bağlanmaz: iki bileşenli "20x15" tek başına ölçü
     * sayılmaz (logo, fotoğraf, etiket boyu da olabilir); üç bileşen ya da
     * açık bir ölçü işareti ("ölçü", "ebat", "boyut", "cm", "mm") gerekir.
     * Kural kelimeye değil, span'in yapısına bakar.
     */
    if (n.role === "DIMENSION" && n.raw) {
      const span = String(n.raw);
      const threePart = /\d+\s*[x×]\s*\d+\s*[x×]\s*\d+/i.test(span);
      const dimensionCue =
        /(?:^|[^\p{L}])(?:ölçü|olcu|ebat|boyut|en\s*x|cm|mm|santim)/iu.test(
          normalizedInput,
        );
      if (threePart || dimensionCue) {
        /**
         * YAZILMIŞ BİRİM KORUNUR, YAZILMAYAN UYDURULMAZ.
         *
         * Span'in hemen ardından bir birim geliyorsa ("20x15x10 cm") o birim
         * kullanıcının ifadesinin parçasıdır ve saklanır. Birim yazılmamışsa
         * varsayılan bir birim EKLENMEZ — "20x15x10" olduğu gibi kalır.
         */
        const compact = span.replace(/\s+/g, "");
        const trailingUnit = normalizedInput
          .slice(normalizedInput.indexOf(span) + span.length)
          .match(/^\s*(cm|mm|m|inç|inc)\b/i);
        attributes.dimensions = uv(
          trailingUnit ? `${compact} ${trailingUnit[1].toLowerCase()}` : compact,
          {
            provenance: "EXPLICIT",
            source: "USER_EXPLICIT",
            evidence: n.evidence,
          },
        );
      }
    }
    if (n.role === "MILEAGE" && n.value != null) {
      attributes.mileage = uv(
        { value: n.value, unit: "km" },
        {
          provenance: "EXPLICIT",
          source: "USER_EXPLICIT",
          evidence: n.evidence,
        },
      );
    }
  }

  const room = extractRoomLayout(normalizedInput, null);
  if (room) attributes.roomCount = room;

  const listing = extractListingType(normalizedInput, intentResolved.intent);
  if (listing) attributes.listingType = listing;

  if (intentResolved.intent === "PART") {
    attributes.needType = uv("part", {
      provenance: "INFERRED",
      source: "DETERMINISTIC_INFERENCE",
      evidence: intentResolved.evidence,
    });
    attributes.part = uv("parça", {
      provenance: "EXPLICIT",
      source: "USER_EXPLICIT",
      evidence: intentResolved.evidence,
    });
  }
  if (intentResolved.intent === "SERVICE") {
    attributes.needType = uv("service", {
      provenance: "INFERRED",
      source: "DETERMINISTIC_INFERENCE",
      evidence: intentResolved.evidence,
    });
    if (/\bboya|boyat/i.test(normalizedInput)) {
      attributes.serviceType = uv("boya", {
        provenance: "EXPLICIT",
        source: "USER_EXPLICIT",
        evidence: ["boya"],
      });
    } else if (/\bbakım|bakim/i.test(normalizedInput)) {
      attributes.serviceType = uv("bakım", {
        provenance: "EXPLICIT",
        source: "USER_EXPLICIT",
        evidence: ["bakım"],
      });
    }
  }
  if (intentResolved.intent === "MANUFACTURE" && quantity) {
    // help manufacturing strategy
  }

  const needType = needTypeForIntent(intentResolved.intent, subjectValue);
  if (needType && !attributes.needType) {
    attributes.needType = uv(needType, {
      provenance: "INFERRED",
      source: "DETERMINISTIC_INFERENCE",
      evidence: [`intent=${intentResolved.intent}`],
    });
  }
  if (
    subjectValue === "VEHICLE" &&
    intentResolved.intent === "BUY" &&
    !attributes.needType
  ) {
    attributes.needType = uv("vehicle", {
      provenance: "INFERRED",
      source: "DETERMINISTIC_INFERENCE",
      evidence: ["subject=VEHICLE"],
    });
  }
  if (
    subjectValue === "MACHINE" &&
    intentResolved.intent === "BUY" &&
    !attributes.needType
  ) {
    attributes.needType = uv("machine", {
      provenance: "INFERRED",
      source: "DETERMINISTIC_INFERENCE",
      evidence: ["subject=MACHINE"],
    });
  }

  // Structured form overrides beat inference (manual corrections stick)
  if (structured?.fieldValues) {
    for (const [key, raw] of Object.entries(structured.fieldValues)) {
      if (raw == null || !String(raw).trim()) continue;
      attributes[key] = uv(String(raw).trim(), {
        provenance: "EXPLICIT",
        source: "STRUCTURED_FIELD",
        confidence: 0.98,
        evidence: [`structured:${key}`],
      });
    }
  }

  let condition = extractCondition(normalizedInput);
  if (!condition) {
    condition = inferConditionFromContext({
      normalizedInput,
      categoryId: category.value,
      subjectKind: subjectValue,
      intent: intentResolved.intent,
      modelYear:
        typeof attributes.modelYear?.value === "number"
          ? attributes.modelYear.value
          : null,
    });
  }
  const structuredCondition = structured?.fieldValues?.condition?.trim();
  if (structuredCondition) {
    const lower = structuredCondition.toLocaleLowerCase("tr-TR");
    const mapped =
      /sıfır|sifir|new|yeni/.test(lower)
        ? ("NEW" as const)
        : /ikinci|used|2\.?\s*el/.test(lower)
          ? ("USED" as const)
          : null;
    if (mapped) {
      condition = uv(mapped, {
        provenance: "EXPLICIT",
        source: "STRUCTURED_FIELD",
        confidence: 0.98,
        evidence: [structuredCondition],
      });
    }
  }

  const budgetDetected = extractBudgetFromText(normalizedInput);
  // Reject fuzzy-only budget — extractBudgetFromText requires money signals
  const budget = budgetDetected
    ? uv(
        {
          min: budgetDetected.min,
          max: budgetDetected.max ?? budgetDetected.amount,
          currency: "TRY",
        },
        {
          provenance: "EXPLICIT",
          source: "USER_EXPLICIT",
          evidence: [budgetDetected.display],
        },
      )
    : undefined;

  /**
   * COĞRAFİ KANIT KULLANICININ YAZDIĞINDAN OKUNUR (2026-08-26).
   *
   * `normalizeUnderstandingInput` eksik Türkçe harfleri tamamlar ("arcelik" →
   * "arçelik"). Bu, marka/ürün eşleştirmesi için doğrudur ama yer adlarında
   * OLMAYAN bir kanıt üretebiliyor: "aracın bakımı" ifadesindeki ünsüz
   * yumuşamasını "araçın" diye geri çevirince, Kastamonu'nun Araç ilçesi
   * bulunma ekiyle geçmiş gibi görünüyor ve kullanıcının hiç yazmadığı bir
   * konum EXPLICIT kanıtla doluyordu.
   *
   * Kural: yer kanıtı yalnız HAM metinden okunur. Ölçüldü — 108 senaryoluk
   * corpus'ta iki okuma arasında tek bir fark yok; eksik diyakritikle yazılan
   * il adları (`istanbulda`, `izmirde`) zaten ham metinde de çözülüyor,
   * çözülemeyenler (`cankayada`) normalize edilmiş metinde de çözülmüyordu.
   */
  const geoEvidenceInput = rawInput;

  const cityRaw =
    structured?.city?.trim() ||
    (typeof structured?.fieldValues?.city === "string"
      ? structured.fieldValues.city.trim()
      : "") ||
    detectCity(geoEvidenceInput);
  const cityFromStructured =
    Boolean(structured?.city?.trim()) ||
    Boolean(
      typeof structured?.fieldValues?.city === "string" &&
        structured.fieldValues.city.trim(),
    );
  const geo = findProvinceAndDistrictInText(geoEvidenceInput);
  const location =
    cityRaw || geo?.il
      ? {
          city: cityRaw
            ? uv(cityRaw, {
                provenance: "EXPLICIT",
                source: cityFromStructured
                  ? "STRUCTURED_FIELD"
                  : "USER_EXPLICIT",
                evidence: [cityRaw],
              })
            : geo?.il
              ? uv(geo.il, {
                  provenance: "EXPLICIT",
                  source: "USER_EXPLICIT",
                  evidence: [geo.il],
                })
              : undefined,
          district:
            structured?.district?.trim()
              ? uv(structured.district.trim(), {
                  provenance: "EXPLICIT",
                  source: "STRUCTURED_FIELD",
                  evidence: [structured.district.trim()],
                })
              : geo?.ilce
                ? uv(geo.ilce, {
                    provenance: "EXPLICIT",
                    source: "USER_EXPLICIT",
                    evidence: [geo.ilce],
                  })
                : undefined,
        }
      : undefined;

  // Identity provenance
  const identityBlock: RequestUnderstandingResult["identity"] = {
    fingerprint: identity.fingerprint ?? undefined,
    confidence: identity.confidence,
  };

  const explicitModelFromText = techProduct
    ? (() => {
        const canonical = techProduct.canonical;
        const b = techProduct.brand;
        if (
          b &&
          canonical.toLocaleLowerCase("tr-TR").startsWith(b.toLocaleLowerCase("tr-TR"))
        ) {
          return canonical.slice(b.length).trim() || canonical;
        }
        return canonical;
      })()
    : autoModel && textIncludes(normalizedInput, autoModel)
      ? autoModel
      : undefined;

  /**
   * MARKA KANIT KAPISI (RC_BRAND dilimi, 2026-08-25).
   *
   * Ölçülen kusur: metinde geçen her jeton `EXPLICIT / 0.95` markaya
   * dönüşüyordu — "RAM", "Ticari", "Torna", "Kompresör", "Tekerlekli",
   * "Toptan", "Kürek", "Çelik", "Logolu", "E-ticaret" kesin marka olarak
   * snapshot ve routing envelope'a giriyordu. Metinde geçmek kanıt değildir.
   *
   * Kesin marka yalnız iki kanıtla yazılır:
   *   VERIFIED_CATALOG — kanonik katalog doğrulaması,
   *   USER_ASSERTED    — açık marka sözdizimi ("X marka/markası/markalı").
   * Kanıtsız aday CANDIDATE olarak `attributes.brandCandidate`ta korunur;
   * marka DEĞİL sınıfları (özellik, ürün başı, sıfat, kanonik rol) düşer.
   * Karar tek yetkiliden okunur: `classifyBrandEvidence`.
   */
  let brandEvidenceStatus: BrandEvidenceStatus | null = null;
  if (
    identity.brand &&
    !looksLikeYearToken(identity.brand) &&
    // Üst ürün olarak tüketilen span marka olamaz (1D).
    !isConsumedAsParentProduct(normalizedInput, identity.brand)
  ) {
    const evidence = classifyBrandEvidence(normalizedInput, identity.brand);
    brandEvidenceStatus = evidence.status;
    if (evidence.status === "VERIFIED_CATALOG" || evidence.status === "USER_ASSERTED") {
      const explicitBrand = textIncludes(normalizedInput, identity.brand);
      identityBlock.brand = uv(identity.brand, {
        provenance: explicitBrand ? "EXPLICIT" : "INFERRED",
        source: explicitBrand ? "USER_EXPLICIT" : "PRODUCT_IDENTITY",
        confidence:
          evidence.status === "USER_ASSERTED"
            ? 0.85
            : explicitBrand
              ? 0.95
              : Math.min(0.75, identity.confidence ?? 0.5),
        evidence: [
          evidence.status,
          ...(explicitBrand ? [identity.brand] : ["product-identity-inference"]),
        ],
      });
    } else {
      if (evidence.status === "CANDIDATE") {
        // Aday korunur ama kesinleşmez; soru motoru/kürasyon için kalıcıdır.
        attributes.brandCandidate = uv(identity.brand, {
          provenance: "INFERRED",
          source: "DETERMINISTIC_INFERENCE",
          confidence: 0.3,
          evidence: ["brand-candidate", evidence.reason],
        });
      }
      // Reddedilen aday yan kapıdan dönemez (1B/1H deseni).
      identity.brand = null;
    }
  } else if (
    identity.brand &&
    isConsumedAsParentProduct(normalizedInput, identity.brand)
  ) {
    /**
     * Üst ürün olarak tüketilen span (1D) yalnız `identityBlock`tan değil,
     * publish'teki `?? identity.brand` yedeğinden de düşmelidir — ölçülen
     * yan kapı: "Klima için dış ünite fan motoru" → envelope.brand="Klima".
     */
    identity.brand = null;
  }

  /**
   * AÇIK MARKA BEYANI, YAZIM BİÇİMİNDEN BAĞIMSIZDIR (RC_BRAND takip dilimi).
   *
   * Kimlik katmanı küçük harfli jetonları hiç marka adayı yapmıyor; "eufy
   * marka bebek arabası" beyanı bu yüzden kanıt kapısına ulaşamıyordu
   * (ölçüldü: marka null). Kullanıcı "X marka" dilbilgisi kullandıysa jeton
   * doğrudan beyandan çıkarılır ve AYNI kanıt otoritesinden geçirilir.
   */
  if (!identityBlock.brand) {
    const asserted = extractAssertedBrand(normalizedInput);
    if (asserted && !looksLikeYearToken(asserted)) {
      const evidence = classifyBrandEvidence(normalizedInput, asserted);
      if (
        evidence.status === "USER_ASSERTED" ||
        evidence.status === "VERIFIED_CATALOG"
      ) {
        brandEvidenceStatus = evidence.status;
        identity.brand = asserted;
        delete attributes.brandCandidate;
        identityBlock.brand = uv(asserted, {
          provenance: "EXPLICIT",
          source: "USER_EXPLICIT",
          confidence: evidence.status === "USER_ASSERTED" ? 0.85 : 0.95,
          evidence: [evidence.status, "brand-syntax"],
        });
      }
    }
  }

  /**
   * MODEL KANIT KAPISI (I44) — marka kanıt sisteminin model ikizi. Katalog
   * doğrulaması sayısız modelleri ("Clio", "Passat", "MacBook Pro") geçirir;
   * geri kalan her aday tek sayı-birim otoritesinden geçer: miktar/ölçü
   * span'iyle çakışan ya da yalın-sayı olup MODEL_IDENTIFIER kararı olmayan
   * jeton exact model olamaz.
   */
  const modelHasCatalogEvidence = (value: string): boolean => {
    const lc = value.toLocaleLowerCase("tr-TR");
    if (autoModel && autoModel.toLocaleLowerCase("tr-TR") === lc) return true;
    if (
      techProduct &&
      techProduct.canonical.toLocaleLowerCase("tr-TR").includes(lc)
    ) {
      return true;
    }
    /**
     * KATALOG MARKASINI İZLEYEN YAZIM (marka kanıt sisteminin devamı):
     * VERIFIED_CATALOG bir markanın hemen ardından gelen span model
     * kanıtıdır ("Chicco Goody Plus"). CANDIDATE marka bu kanıtı VEREMEZ —
     * "Torna tezgahı" bu yüzden geçemez.
     */
    if (
      identityBlock.brand?.value &&
      brandEvidenceStatus === "VERIFIED_CATALOG"
    ) {
      const lt = normalizedInput.toLocaleLowerCase("tr-TR");
      const bi = lt.indexOf(
        String(identityBlock.brand.value).toLocaleLowerCase("tr-TR"),
      );
      if (bi >= 0) {
        const after = lt
          .slice(bi + String(identityBlock.brand.value).length)
          .replace(/^[\s,:–-]+/, "");
        if (lc && after.startsWith(lc)) return true;
      }
    }
    return false;
  };
  const modelPassesEvidenceGate = (value: unknown): boolean => {
    const token = String(value ?? "").trim();
    if (!token) return false;
    return (
      classifyModelTokenEvidence(normalizedInput, token, {
        catalogVerified: modelHasCatalogEvidence(token),
      }) === "VERIFIED_MODEL"
    );
  };

  const modelValue =
    explicitModelFromText ??
    identity.model ??
    (techProduct ? null : modelTokens[0] ? modelTokens[0].raw : null);
  if (
    modelValue &&
    modelPassesEvidenceGate(modelValue) &&
    !looksLikeYearToken(String(modelValue)) &&
    // A product-type phrase names WHAT the thing is, never which model —
    // "hava temizleyicisi" must not ship as "Model: hava temizleyicisi".
    !isProductTypePhrase(String(modelValue)) &&
    // Nor may the REQUESTED ITEM be the parent's model (KB-12) — see below.
    !isRequestedItemNotModel(normalizedInput, String(modelValue)) &&
    // Nor may the canonical PARENT PRODUCT span double as a model (1D).
    !isConsumedAsParentProduct(normalizedInput, String(modelValue))
  ) {
    const explicitModel = textIncludes(normalizedInput, String(modelValue));
    identityBlock.model = uv(String(modelValue), {
      provenance: explicitModel ? "EXPLICIT" : "INFERRED",
      source: explicitModel ? "USER_EXPLICIT" : "PRODUCT_IDENTITY",
      confidence: explicitModel ? 0.95 : 0.6,
      evidence: explicitModel
        ? [String(modelValue)]
        : ["product-identity-model"],
    });
  }
  if (identity.series) {
    identityBlock.series = uv(identity.series, {
      provenance: textIncludes(normalizedInput, identity.series)
        ? "EXPLICIT"
        : "INFERRED",
      source: "PRODUCT_IDENTITY",
    });
  }
  if (identity.variant) {
    identityBlock.variant = uv(identity.variant, {
      provenance: textIncludes(normalizedInput, identity.variant)
        ? "EXPLICIT"
        : "INFERRED",
      source: "PRODUCT_IDENTITY",
    });
  }
  if (modelTokens.length > 0) {
    identityBlock.identifiers = modelTokens.map((t) =>
      uv(t.raw, {
        provenance: "EXPLICIT",
        source: "USER_EXPLICIT",
        evidence: t.evidence,
      }),
    );
  }

  // Phase 2 constraints — Single Brain authority (before subject reconcile)
  const constraintBundle = extractConstraintSemantics(normalizedInput);

  // Brands only in "olmasın" windows must not become positive identity
  const exclusionOnlyBrands = brandsOnlyInExclusion(normalizedInput);
  if (
    identityBlock.brand?.value &&
    exclusionOnlyBrands.has(String(identityBlock.brand.value))
  ) {
    delete identityBlock.brand;
  }

  const excludedModels = (constraintBundle.byField.model?.excludedValues ?? []).map(
    (v) => v.toLocaleLowerCase("tr-TR"),
  );
  if (identityBlock.model?.value && excludedModels.length) {
    const mv = String(identityBlock.model.value).toLocaleLowerCase("tr-TR");
    if (
      excludedModels.some((e) => mv === e || mv.includes(e) || e.includes(mv))
    ) {
      delete identityBlock.model;
    }
  }

  // Multi-value brand preference: do not collapse to a single identity.brand
  const preferredBrands = constraintBundle.byField.brand?.preferredValues ?? [];
  if (preferredBrands.length >= 2) {
    delete identityBlock.brand;
  }

  // Constraint extractor recovers / cleans single brand (identity often garbles)
  const constraintBrand = constraintBundle.byField.brand?.value;
  if (
    constraintBrand &&
    preferredBrands.length < 2 &&
    !exclusionOnlyBrands.has(constraintBrand) &&
    !constraintBundle.conflicts.some((c) => c.fields?.includes("brand"))
  ) {
    // Kısıt yolundan gelen aday da aynı kanıt kapısından geçer (RC_BRAND).
    const evidence = classifyBrandEvidence(normalizedInput, constraintBrand);
    const current = identityBlock.brand?.value
      ? String(identityBlock.brand.value)
      : "";
    if (
      (evidence.status === "VERIFIED_CATALOG" ||
        evidence.status === "USER_ASSERTED") &&
      (!current ||
        current.toLocaleLowerCase("tr-TR") !==
          constraintBrand.toLocaleLowerCase("tr-TR"))
    ) {
      brandEvidenceStatus = evidence.status;
      identityBlock.brand = uv(constraintBrand, {
        provenance: "EXPLICIT",
        source: "USER_EXPLICIT",
        confidence: evidence.status === "USER_ASSERTED" ? 0.85 : 0.95,
        evidence: [evidence.status, "constraint-brand"],
      });
    }
  }

  /**
   * KANIT ETİKETİ KALICI OLUR (RC_BRAND): kesinleşen her markanın NEDENİ
   * denetlenebilir. `attributes` publish snapshot'ına ve oradan routing
   * envelope'a akar — USER_ASSERTED bir marka katalog doğrulaması gibi
   * görünemez.
   */
  if (identityBlock.brand?.value && brandEvidenceStatus) {
    attributes.brandEvidence = uv(brandEvidenceStatus, {
      provenance: "INFERRED",
      source: "DETERMINISTIC_INFERENCE",
      confidence: 1,
      evidence: ["brand-evidence"],
    });
  }

  // Multi model preference — avoid collapsing to first token only
  const preferredModels = constraintBundle.byField.model?.preferredValues ?? [];
  if (preferredModels.length >= 2) {
    delete identityBlock.model;
  }

  // Brand include+exclude contradiction — do not invent a final brand
  if (
    constraintBundle.conflicts.some(
      (c) => c.kind === "BRAND_INCLUDE_EXCLUDE" && c.fields?.includes("brand"),
    )
  ) {
    delete identityBlock.brand;
  }

  /**
   * KULLANIM BAĞLAMI MARKA YA DA MODEL OLAMAZ (1H).
   *
   * `isRequestedItemNotModel` (KB-12) kardeş kuraldır: o "bağlacın SAĞI model
   * olamaz" der, bu "bağlacın SOLU yalnız bağlamsa marka olamaz" der.
   *
   * Kural kelime listesiyle DEĞİL kanıtla çalışır. Üç koşul birlikte aranır:
   *   1) uyumluluk bağlacı var ve sağdaki hedefin rolü bütün ürün ya da
   *      hizmet (`readUsageContextSplit`),
   *   2) aday YALNIZ solda geçiyor — sağdaki hedefte yok,
   *   3) sol taraf ne kanonik üst ürün kanıtı taşıyor (`resolvePartBearingParent`)
   *      ne de taksonomi dışı bir özel ad: taksonomide düğümü OLAN bir ifade
   *      ortak addır, marka değildir. Taksonomi marka adı barındırmaz.
   *
   * Ölçülen hata: "Restoran için POS yazılımı arıyorum" → marka "Restoran".
   * Aynı kural "WordPress için teknik destek" cümlesinde WordPress'i KORUR:
   * WordPress taksonomide bir düğüm değildir, ortak ad sayılmaz.
   */
  /**
   * PLATFORM VE MAKİNE TÜRÜ MARKA DEĞİLDİR (1J).
   *
   * `identity.brand` kullanıcıya "Marka" olarak gösterilir, snapshot'a marka
   * olarak yazılır ve Matching V3'te `brandHit` üretir. WordPress bir
   * platform, SAP ve Logo birer yazılım ailesi, CNC tezgâhı bir makine
   * türüdür; hiçbiri üretici markası değildir. Tipli kanonik varlık kaydı
   * BRAND değilse aday marka alanından düşürülür — ad kullanıcı metninde
   * korunmaya devam eder, yalnız yanlış ROL taşımaz.
   */
  {
    const brandIsNonBrandEntity = (value: unknown): boolean => {
      const token = String(value ?? "").trim();
      if (!token) return false;
      return isNonBrandDomainEntity(token);
    };
    if (brandIsNonBrandEntity(identityBlock.brand?.value)) {
      delete identityBlock.brand;
    }
    if (brandIsNonBrandEntity(identityBlock.model?.value)) {
      delete identityBlock.model;
    }
    if (brandIsNonBrandEntity(identity.brand)) {
      identity.brand = null;
    }
  }

  {
    const parentIdentity = {
      brand: identityBlock.brand?.value ? String(identityBlock.brand.value) : null,
      model: identityBlock.model?.value ? String(identityBlock.model.value) : null,
      catalogModel: autoModel,
    };
    if (
      isUsageContextOnlyDesignator(
        normalizedInput,
        identityBlock.brand,
        parentIdentity,
      )
    ) {
      delete identityBlock.brand;
    }
    if (
      isUsageContextOnlyDesignator(
        normalizedInput,
        identityBlock.model,
        parentIdentity,
      )
    ) {
      delete identityBlock.model;
    }
    /**
     * REDDEDİLEN MARKA YAN KAPIDAN GERİ GELEMEZ (1B ile aynı desen).
     *
     * Aşağıdaki iki çağrı `identityBlock.brand?.value ?? identity.brand`
     * yedeğini kullanıyor; blok temizlense bile ham kimlik adayı geri
     * dönüyordu ("Restoran" markası `parentEntity` üzerinden `fields.brand`'e
     * ulaşıyordu — ölçüldü). Yedek de aynı kapıdan geçirilir.
     */
    if (
      isUsageContextOnlyDesignator(
        normalizedInput,
        { value: identity.brand },
        parentIdentity,
      )
    ) {
      identity.brand = null;
    }
  }

  // B3.7 — semantic subject / relationship (after identity, before strategy)
  const structuredNeedType =
    typeof structured?.fieldValues?.needType === "string"
      ? structured.fieldValues.needType.trim()
      : null;
  const nonAutoCategory = [
    "technology",
    "appliances",
    "home-kitchen",
    "furniture",
    "health",
    "baby",
    "printing",
    "real-estate",
    "services",
  ].includes(category.value ?? "");
  // Do not inject numeric false-positive auto models into non-auto domains
  const automotiveModelForSubject =
    nonAutoCategory || !autoModel ? null : autoModel;

  let requestSubject: SemanticRequestSubject = resolveSemanticSubject({
    normalizedInput,
    identity: {
      brand: identityBlock.brand?.value ?? identity.brand,
      /**
       * REDDEDİLEN MODEL YAN KAPIDAN GERİ GELEMEZ (1B).
       *
       * `identityBlock.model` yukarıda üç kez REDDEDİLEBİLİR: yıl jetonu,
       * ürün TÜRÜ ifadesi (`isProductTypePhrase`) ve istenen parça
       * (`isRequestedItemNotModel`). Eski `?? identity.model` yedeği tam da
       * bu reddedilen ham değeri geri getiriyordu: "Siemens fırın için
       * termostat" talebinde `identityBlock.model` doğru biçimde boşaltılıyor,
       * ama semantik katmana yine "fırın" gidiyor ve
       * `parentEntity.model = "fırın"` olarak yazılıyordu — bir ürün TÜRÜ,
       * model alanında.
       *
       * Karar katmanı modeli reddettiyse karar budur; yedek yoktur.
       */
      model: identityBlock.model?.value ?? null,
      series: identityBlock.series?.value ?? identity.series,
      variant: identityBlock.variant?.value ?? identity.variant,
    },
    intent: intentResolved.intent,
    categoryId: category.value,
    quantity: quantity?.value?.value ?? null,
    area:
      attributes.area?.value &&
      typeof attributes.area.value === "object" &&
      attributes.area.value !== null &&
      "value" in (attributes.area.value as object)
        ? Number((attributes.area.value as { value: number }).value)
        : null,
    roomCount: attributes.roomCount
      ? String(attributes.roomCount.value)
      : null,
    listingType: attributes.listingType
      ? String(attributes.listingType.value)
      : null,
    automotiveModel: automotiveModelForSubject,
    forcedNeedType: structuredNeedType,
  });

  // Reconcile identity with parent tokens (generic dedupe brand⊃model)
  const parentTokens = reconcileParentIdentityTokens(
    {
      brand: identityBlock.brand?.value ?? null,
      model: identityBlock.model?.value ?? null,
      series: identityBlock.series?.value ?? null,
    },
    { automotiveModel: automotiveModelForSubject },
  );
  if (parentTokens.brand && identityBlock.brand) {
    identityBlock.brand = {
      ...identityBlock.brand,
      value: parentTokens.brand,
    };
  } else if (
    parentTokens.brand &&
    !identityBlock.brand &&
    /**
     * KAÇIŞ YOLU KAPALI (RC_BRAND takip dilimi): parent-token yolu ayrı bir
     * güven kapısı DEĞİLDİR. Girdisi bugün kapıdan geçmiş kimlikten türese
     * de, bu yazım noktası da aynı kanıt otoritesinden geçer — kanıtsız
     * jeton buradan da EXPLICIT marka olamaz.
     */
    (() => {
      const ev = classifyBrandEvidence(normalizedInput, parentTokens.brand);
      if (ev.status === "VERIFIED_CATALOG" || ev.status === "USER_ASSERTED") {
        brandEvidenceStatus = ev.status;
        return true;
      }
      if (ev.status === "CANDIDATE" && !attributes.brandCandidate) {
        attributes.brandCandidate = uv(parentTokens.brand, {
          provenance: "INFERRED",
          source: "DETERMINISTIC_INFERENCE",
          confidence: 0.3,
          evidence: ["brand-candidate", ev.reason],
        });
      }
      return false;
    })()
  ) {
    identityBlock.brand = uv(parentTokens.brand, {
      provenance: "EXPLICIT",
      source: "USER_EXPLICIT",
      confidence: 0.9,
      evidence: [brandEvidenceStatus ?? "VERIFIED_CATALOG", parentTokens.brand],
    });
    if (!attributes.brandEvidence && brandEvidenceStatus) {
      attributes.brandEvidence = uv(brandEvidenceStatus, {
        provenance: "INFERRED",
        source: "DETERMINISTIC_INFERENCE",
        confidence: 1,
        evidence: ["brand-evidence"],
      });
    }
  }
  if (parentTokens.model && modelPassesEvidenceGate(parentTokens.model)) {
    identityBlock.model = uv(parentTokens.model, {
      provenance: textIncludes(normalizedInput, parentTokens.model)
        ? "EXPLICIT"
        : "INFERRED",
      source: textIncludes(normalizedInput, parentTokens.model)
        ? "USER_EXPLICIT"
        : "PRODUCT_IDENTITY",
      confidence: 0.9,
      evidence: [parentTokens.model],
    });
  }

  // Strong semantic PART/ACCESSORY/SERVICE overrides intent & subject
  const semKind = requestSubject.kind.value;
  const semConfident =
    requestSubject.kind.status === "CONFIDENT" ||
    requestSubject.kind.status === "TENTATIVE";

  if (semConfident && (semKind === "PART" || semKind === "ACCESSORY")) {
    intentResolved = {
      intent: "PART",
      confidence: Math.max(intentResolved.confidence, requestSubject.kind.confidence),
      evidence: [
        ...intentResolved.evidence,
        ...(requestSubject.kind.evidence ?? []),
      ],
    };
    intentDecision.value = "PART";
    intentDecision.confidence = intentResolved.confidence;
    intentDecision.status = decisionStatus(intentResolved.confidence);
    intentDecision.evidence = intentResolved.evidence;

    subjectDecision.value = "PART";
    subjectDecision.confidence = requestSubject.kind.confidence;
    subjectDecision.status = requestSubject.kind.status;
    subjectDecision.evidence = [
      ...(requestSubject.kind.evidence ?? []),
      "semantic-subject",
    ];

    /**
     * AÇIK KULLANICI SEÇİMİ ÇIKARIMLA EZİLEMEZ (kurucu, 2026-08-26).
     *
     * Bu dal semantik özneden PART çıkardığında `needType`i koşulsuz olarak
     * yeniden yazıyordu; kullanıcı o alanı yapısal olarak seçmiş olsa bile
     * değer `INFERRED` seviyesine düşüyor, soru yeniden açılıyor ve seçim
     * kayboluyordu. Karar burada verilmez: otorite sırası tek yerde tanımlı.
     */
    assignAttributeIfNotWeaker(
      attributes,
      "needType",
      uv("part", {
        provenance: "INFERRED",
        source: "DETERMINISTIC_INFERENCE",
        confidence: requestSubject.kind.confidence,
        evidence: requestSubject.kind.evidence,
      }),
    );

    const partPhrase =
      requestSubject.displayPhrase?.value ??
      requestSubject.name?.value ??
      "parça";
    attributes.part = uv(partPhrase, {
      provenance: "EXPLICIT",
      source: "USER_EXPLICIT",
      confidence: 0.9,
      evidence: requestSubject.name?.evidence,
    });
    if (requestSubject.position) {
      attributes.partPosition = requestSubject.position;
    }

    // Parent entity wins for identity surface
    if (requestSubject.parentEntity?.brand) {
      identityBlock.brand = requestSubject.parentEntity.brand;
    }
    if (
      requestSubject.parentEntity?.model &&
      modelPassesEvidenceGate(requestSubject.parentEntity.model.value)
    ) {
      identityBlock.model = requestSubject.parentEntity.model;
    }

    // Automotive part without category → automotive
    if (
      requestSubject.parentEntity?.kind === "VEHICLE" &&
      (!category.value ||
        category.status === "UNKNOWN" ||
        category.value === "services")
    ) {
      category = {
        value: "automotive",
        confidence: Math.max(category.confidence, 0.8),
        status: "CONFIDENT",
        evidence: [
          ...(category.evidence ?? []),
          "semantic-part-vehicle-parent",
        ],
        alternatives: category.alternatives,
      };
    }
  }

  if (semConfident && semKind === "SERVICE") {
    intentResolved = {
      intent: "SERVICE",
      confidence: Math.max(intentResolved.confidence, requestSubject.kind.confidence),
      evidence: [
        ...intentResolved.evidence,
        ...(requestSubject.kind.evidence ?? []),
      ],
    };
    intentDecision.value = "SERVICE";
    intentDecision.confidence = intentResolved.confidence;
    intentDecision.status = decisionStatus(intentResolved.confidence);
    intentDecision.evidence = intentResolved.evidence;

    subjectDecision.value = "SERVICE";
    subjectDecision.confidence = requestSubject.kind.confidence;
    subjectDecision.status = requestSubject.kind.status;

    // Açık kullanıcı seçimi çıkarımla ezilemez — bkz. PART dalındaki gerekçe.
    assignAttributeIfNotWeaker(
      attributes,
      "needType",
      uv("service", {
        provenance: "INFERRED",
        source: "DETERMINISTIC_INFERENCE",
        confidence: requestSubject.kind.confidence,
        evidence: requestSubject.kind.evidence,
      }),
    );
    if (requestSubject.serviceType) {
      attributes.serviceType = requestSubject.serviceType;
    }
    if (requestSubject.target) {
      attributes.serviceTarget = requestSubject.target;
    }

    /**
     * GENEL HİZMET PAZARI YALNIZ BİR YEDEKTİR (1I).
     *
     * Önceki sözleşme (2026-08-23) otomotiv ve makine dışındaki BÜTÜN hizmet
     * taleplerini `services` kategorisine yönlendiriyordu; kategori ekseni
     * ihtiyaç türü ekseniyle çakışıyordu. Otomotiv istisnası aslında doğru
     * kuralın kendisiydi: uzmanlık alanı korunur.
     *
     * Artık alan kanıtı varsa (doğrulanmış ürün/platform ya da rol sözcük
     * dağarcığı) talep o alanda kalır — "klima servisi" beyaz eşya,
     * "Renault Clio bakımı" otomotiv, "Heidelberg SM 74 bakımı" makine.
     * Kanıt yoksa genel hizmet pazarı devreye girer — "ev temizliği",
     * "hukuk danışmanlığı".
     */
    /* Kanonik iddia da bir ALAN kanıtıdır: "Detaylı ekspertiz" otomotiv
       bakım yaprağıdır ve genel hizmet pazarına düşmez (ölçüldü). Otomotiv
       istisnası kurucu kuralın kendisidir: araç üzerindeki hizmet
       (arac-bakim) genel pazara sürülmez — "araba bakımı yaptırmak
       istiyorum" otomotivde kalır (ölçüldü). */
    if (
      !relationDomain &&
      !categoryFromCanonicalClaim() &&
      category.value !== "automotive"
    ) {
      category = {
        value: "services",
        confidence: Math.max(category.confidence, requestSubject.kind.confidence),
        status: "CONFIDENT",
        evidence: [
          ...(category.evidence ?? []),
          "semantic-service-category",
        ],
        alternatives: category.alternatives,
      };
    }
  }

  if (semConfident && semKind === "VEHICLE") {
    subjectDecision.value = "VEHICLE";
    subjectDecision.confidence = requestSubject.kind.confidence;
    subjectDecision.status = requestSubject.kind.status;
    if (!attributes.needType) {
      attributes.needType = uv("vehicle", {
        provenance: "INFERRED",
        source: "DETERMINISTIC_INFERENCE",
        evidence: ["semantic-vehicle"],
      });
    }
  }

  if (semConfident && semKind === "MANUFACTURED_ITEM") {
    intentDecision.value = "MANUFACTURE";
    intentDecision.confidence = Math.max(
      intentDecision.confidence,
      requestSubject.kind.confidence,
    );
    intentDecision.status = decisionStatus(intentDecision.confidence);
    subjectDecision.value = "MANUFACTURED_GOOD";
  }

  if (semConfident && semKind === "REAL_ESTATE") {
    subjectDecision.value = "PROPERTY";
  }

  if (semConfident && semKind === "INDUSTRIAL_EQUIPMENT") {
    subjectDecision.value = "MACHINE";
  }

  // Refresh requestSubject parent after identity reconciliation
  if (
    requestSubject.parentEntity ||
    semKind === "PART" ||
    semKind === "ACCESSORY" ||
    semKind === "VEHICLE" ||
    semKind === "PRODUCT"
  ) {
    const existingParent = requestSubject.parentEntity;
    const inferredKind =
      semKind === "VEHICLE"
        ? ("VEHICLE" as const)
        : existingParent?.kind ?? ("PRODUCT" as const);
    requestSubject = {
      ...requestSubject,
      parentEntity: existingParent ??
        (identityBlock.brand || identityBlock.model
          ? {
              kind: inferredKind,
              brand: identityBlock.brand,
              model: identityBlock.model,
              series: identityBlock.series,
              variant: identityBlock.variant,
            }
          : undefined),
    };
    // Prefer reconciled identity on parent
    if (requestSubject.parentEntity) {
      if (identityBlock.brand) requestSubject.parentEntity.brand = identityBlock.brand;
      if (identityBlock.model) requestSubject.parentEntity.model = identityBlock.model;
    }
  }

  /**
   * NİHAİ MODEL SÜPÜRMESİ (I44): model hangi yoldan yazılmış olursa olsun
   * (kimlik, parent jetonları, semantik parent) publish yüzeylerine inmeden
   * önce aynı kanıt kapısından geçer. Kapı yukarıdaki yazım noktalarında da
   * uygulanır; bu süpürme, gelecekte açılabilecek yeni bir yazım yolunun
   * sessizce kanıtsız model sızdırmasını engelleyen kemerdir.
   */
  if (identityBlock.model?.value && !modelPassesEvidenceGate(identityBlock.model.value)) {
    delete identityBlock.model;
  }
  if (
    requestSubject.parentEntity?.model?.value &&
    !modelPassesEvidenceGate(requestSubject.parentEntity.model.value)
  ) {
    requestSubject.parentEntity.model = undefined;
  }

  // Strategy context — low-confidence category must not dominate
  const strategyCategorySlug =
    category.status === "CONFIDENT" && category.value
      ? category.value
      : // tentative category allowed only as weak empty-safe hint when needType absent
        category.status === "TENTATIVE" &&
          category.value &&
          category.value !== "services" &&
          !needType &&
          !attributes.needType
        ? category.value
        : "";

  const strategyAttrs: Record<string, string> = {};
  for (const [k, v] of Object.entries(attributes)) {
    if (v?.value == null) continue;
    if (typeof v.value === "object") {
      strategyAttrs[k] = JSON.stringify(v.value);
    } else {
      strategyAttrs[k] = String(v.value);
    }
  }
  if (quantity?.value?.value != null) {
    strategyAttrs.quantity = String(quantity.value.value);
  }
  if (identityBlock.brand) strategyAttrs.brand = String(identityBlock.brand.value);
  if (identityBlock.model) strategyAttrs.model = String(identityBlock.model.value);
  if (listing) strategyAttrs.listingType = String(listing.value);
  if (attributes.serviceType) {
    strategyAttrs.serviceType = String(attributes.serviceType.value);
  }
  if (attributes.paperWeight) {
    strategyAttrs.paperWeight = String(attributes.paperWeight.value);
  }
  if (attributes.needType) {
    strategyAttrs.needType = String(attributes.needType.value);
  }

  // Manufacturing: ensure printing + quantity path works
  if (intentResolved.intent === "MANUFACTURE") {
    if (!strategyCategorySlug && category.value === "printing") {
      // use printing even if tentative
    }
  }

  const effectiveCategorySlug =
    intentResolved.intent === "MANUFACTURE" &&
    (category.value === "printing" || strategyAttrs.quantity)
      ? category.value === "printing"
        ? "printing"
        : strategyCategorySlug || "printing"
      : strategyCategorySlug;

  if (
    intentResolved.intent === "MANUFACTURE" &&
    quantity &&
    !strategyAttrs.paperWeight
  ) {
    // quantity alone + printing slug → CUSTOM_MANUFACTURING via resolver
  }

  const strategyCtx: PriceStrategyContext = {
    categorySlug: effectiveCategorySlug,
    title: rawInput,
    needType: strategyAttrs.needType ?? needType,
    condition: condition
      ? condition.value === "NEW"
        ? "sıfır"
        : condition.value === "USED"
          ? "ikinci el"
          : null
      : null,
    attributes: strategyAttrs,
    brand: identityBlock.brand?.value ?? identity.brand,
    model: identityBlock.model?.value ?? identity.model,
    productType: identity.productType,
    identityConfidence: identity.confidence,
  };

  let strategyResolution = resolvePriceStrategy(strategyCtx);

  // Strong explicit intent must beat weak category-driven strategy
  if (
    intentResolved.intent === "SERVICE" &&
    strategyResolution.strategy === "VEHICLE"
  ) {
    strategyResolution = {
      strategy: "SERVICE_SCOPE",
      strategyConfidence: 0.88,
      strategyReasons: ["intent=SERVICE overrides vehicle default"],
    };
  }
  if (
    intentResolved.intent === "PART" &&
    strategyResolution.strategy === "VEHICLE"
  ) {
    strategyResolution = {
      strategy: "AUTO_PART",
      strategyConfidence: 0.9,
      strategyReasons: ["intent=PART overrides vehicle default"],
    };
  }
  // B3.7 — vehicle-parent PART must not stay RETAIL_PRODUCT / VEHICLE
  if (
    requestSubject.kind.value === "PART" &&
    requestSubject.parentEntity?.kind === "VEHICLE" &&
    strategyResolution.strategy !== "AUTO_PART"
  ) {
    strategyResolution = {
      strategy: "AUTO_PART",
      strategyConfidence: Math.max(0.88, strategyResolution.strategyConfidence),
      strategyReasons: [
        ...strategyResolution.strategyReasons,
        "semantic PART + vehicle parent → AUTO_PART",
      ],
    };
  }
  // Retail / machine spare: keep subject PART; strategy stays safest supported
  if (
    requestSubject.kind.value === "PART" &&
    requestSubject.parentEntity?.kind === "MACHINE" &&
    (strategyResolution.strategy === "INDUSTRIAL_EQUIPMENT" ||
      strategyResolution.strategy === "VEHICLE" ||
      strategyResolution.strategy === "RETAIL_PRODUCT")
  ) {
    strategyResolution = {
      strategy: "INDUSTRIAL_PARTS_SERVICE",
      strategyConfidence: 0.82,
      strategyReasons: [
        ...strategyResolution.strategyReasons,
        "semantic PART + machine parent",
      ],
    };
  }
  if (
    intentResolved.intent === "MANUFACTURE" &&
    strategyResolution.strategy === "UNKNOWN" &&
    quantity
  ) {
    strategyResolution = {
      strategy: "CUSTOM_MANUFACTURING",
      strategyConfidence: 0.85,
      strategyReasons: ["intent=MANUFACTURE + quantity"],
    };
  }
  if (
    intentResolved.intent === "RENT" &&
    (category.value === "real-estate" || hasPropertySignals)
  ) {
    strategyResolution = {
      strategy: "REAL_ESTATE_RENT",
      strategyConfidence: Math.max(strategyResolution.strategyConfidence, 0.9),
      strategyReasons: [
        ...strategyResolution.strategyReasons,
        "intent=RENT + property",
      ],
    };
  }
  if (
    intentResolved.intent === "SELL" &&
    (category.value === "real-estate" || hasPropertySignals)
  ) {
    strategyResolution = {
      strategy: "REAL_ESTATE_SALE",
      strategyConfidence: Math.max(strategyResolution.strategyConfidence, 0.9),
      strategyReasons: [
        ...strategyResolution.strategyReasons,
        "intent=SELL + property",
      ],
    };
  }

  // Suppress confident SERVICE strategy when category was suppressed services fallback
  if (
    strategyResolution.strategy === "SERVICE_SCOPE" &&
    intentResolved.intent !== "SERVICE" &&
    category.status !== "CONFIDENT"
  ) {
    strategyResolution = {
      strategy: "UNKNOWN",
      strategyConfidence: 0.25,
      strategyReasons: [
        "suppressed SERVICE_SCOPE without confident service evidence",
      ],
    };
  }

  const strategyDecision: UnderstandingDecision<PriceStrategyKey> = {
    value: strategyResolution.strategy,
    confidence: strategyResolution.strategyConfidence,
    status: decisionStatus(strategyResolution.strategyConfidence, {
      forceUnknown: strategyResolution.strategy === "UNKNOWN",
    }),
    evidence: strategyResolution.strategyReasons,
  };

  const ambiguities: UnderstandingAmbiguity[] = [
    ...yearAmbiguities(numbers, normalizedInput),
  ];

  /**
   * BELİRSİZLİĞİ KORU — istenen şey sessizce düşemez (1C).
   *
   * "X için Y" yazılmış ama kesin parça ilişkisi kurulamadıysa Y kaybolmaz:
   * kullanıcının kendi sözcükleriyle `ambiguities`e yazılır ve oradan
   * `unresolvedExpressions`a akar. Yayın ENGELLENMEZ; bu yalnız kaydedilmiş
   * bir belirsizliktir ve ileride soru motorunun "Hangi ${marka} ürünü için?"
   * sorusunu sorabilmesi için gereken yapısal kanıttır.
   */
  const unresolvedTarget = findUnresolvedCompatibilityTarget(
    normalizedInput,
    {
      brand: identityBlock.brand?.value ?? null,
      model: identityBlock.model?.value ?? null,
      catalogModel: automotiveModelForSubject,
    },
    {
      relationConfident:
        requestSubject.kind.status === "CONFIDENT" &&
        (requestSubject.kind.value === "PART" ||
          requestSubject.kind.value === "ACCESSORY"),
      isCompatibilityKind:
        requestSubject.kind.value === "PART" ||
        requestSubject.kind.value === "ACCESSORY",
      isServiceSubject: requestSubject.kind.value === "SERVICE",
      representedText: [
        requestSubject.name?.value,
        requestSubject.displayPhrase?.value,
        requestSubject.serviceType?.value,
        requestSubject.target?.value,
      ]
        .filter(Boolean)
        .join(" "),
    },
  );
  if (unresolvedTarget) {
    /**
     * GEREKÇE BİR SINIFTIR, dipnot değil (1D). "Kanonik olarak parça taşımaz"
     * ile "henüz kürasyon yapılmadı" farklı işler doğurur: birincisinde soru
     * sorulmaz, ikincisinde ya soru sorulur ya kürasyon açılır. Bu yüzden
     * gerekçe `kind` içinde taşınır; `message` kullanıcının kendi
     * sözcükleri kalır ve `unresolvedExpressions`a o akar.
     */
    ambiguities.push({
      kind: `compat_target_unresolved:${unresolvedTarget.reason}`,
      message: unresolvedTarget.target,
      candidates: [unresolvedTarget.parent],
    });
  }
  const contradictions: UnderstandingContradiction[] = [
    ...constraintBundle.conflicts,
  ];

  // Seed structured attributes from constraints when brain attributes empty
  const explicitColor =
    constraintBundle.byField.color?.value ??
    ([
      [/\b(kırmızı|kirmizi)\b/iu, "Kırmızı"],
      [/\b(siyah)\b/iu, "Siyah"],
      [/\b(beyaz)\b/iu, "Beyaz"],
      [/\b(gri)\b/iu, "Gri"],
      [/\b(mavi)\b/iu, "Mavi"],
    ] as const).find(([pattern]) => pattern.test(normalizedInput))?.[1];
  if (explicitColor && !attributes.color) {
    attributes.color = uv(explicitColor, {
      provenance: "EXPLICIT",
      source: "USER_EXPLICIT",
      confidence: constraintBundle.byField.color?.confidence ?? 0.95,
      evidence: constraintBundle.byField.color?.evidence ?? [explicitColor],
    });
  }
  const bodyConditionMatch = normalizedInput.match(
    /\b(hasarsız|hasarsiz|hatasız|hatasiz|boyasız|boyasiz|değişensiz|degisensiz|kazası[sz]|kazasi[sz])\b/giu,
  );
  if (bodyConditionMatch?.length && !attributes.bodyCondition) {
    attributes.bodyCondition = uv(
      [...new Set(bodyConditionMatch.map((value) => value.toLocaleLowerCase("tr-TR")))].join(", "),
      {
        provenance: "EXPLICIT",
        source: "USER_EXPLICIT",
        confidence: 0.95,
        evidence: bodyConditionMatch,
      },
    );
  }
  if (
    constraintBundle.byField.resolution?.value &&
    !attributes.resolution
  ) {
    attributes.resolution = uv(constraintBundle.byField.resolution.value, {
      provenance: "EXPLICIT",
      source: "USER_EXPLICIT",
      confidence: constraintBundle.byField.resolution.confidence,
      evidence: constraintBundle.byField.resolution.evidence,
    });
  }
  if (
    constraintBundle.byField.screenSize?.value &&
    !attributes.screenSize
  ) {
    attributes.screenSize = uv(constraintBundle.byField.screenSize.value, {
      provenance: "EXPLICIT",
      source: "USER_EXPLICIT",
      confidence: constraintBundle.byField.screenSize.confidence,
      evidence: constraintBundle.byField.screenSize.evidence,
    });
  }
  if (constraintBundle.byField.grade?.value && !attributes.grade) {
    attributes.grade = uv(constraintBundle.byField.grade.value, {
      provenance: "EXPLICIT",
      source: "USER_EXPLICIT",
      confidence: constraintBundle.byField.grade.confidence,
      evidence: constraintBundle.byField.grade.evidence,
    });
  }
  if (constraintBundle.byField.lamination?.value && !attributes.lamination) {
    attributes.lamination = uv(constraintBundle.byField.lamination.value, {
      provenance: "EXPLICIT",
      source: "USER_EXPLICIT",
      confidence: constraintBundle.byField.lamination.confidence,
      evidence: constraintBundle.byField.lamination.evidence,
    });
  }
  if (
    constraintBundle.byField.lightingType?.value &&
    !attributes.lightingType
  ) {
    attributes.lightingType = uv(constraintBundle.byField.lightingType.value, {
      provenance: "EXPLICIT",
      source: "USER_EXPLICIT",
      confidence: constraintBundle.byField.lightingType.confidence,
      evidence: constraintBundle.byField.lightingType.evidence,
    });
  }
  if (
    constraintBundle.byField.partPosition?.value &&
    !attributes.partPosition
  ) {
    attributes.partPosition = uv(constraintBundle.byField.partPosition.value, {
      provenance: "EXPLICIT",
      source: "USER_EXPLICIT",
      confidence: constraintBundle.byField.partPosition.confidence,
      evidence: constraintBundle.byField.partPosition.evidence,
    });
  }

  // Budget range from constraints when budget empty
  const budgetRange = constraintBundle.byField.budget?.range;
  let resolvedBudget: RequestUnderstandingResult["budget"] = budget;
  if (budgetRange && !resolvedBudget) {
    resolvedBudget = uv(
      {
        min: budgetRange.min,
        max: budgetRange.max,
        currency: "TRY" as const,
      },
      {
        provenance: "EXPLICIT",
        source: "USER_EXPLICIT",
        confidence: constraintBundle.byField.budget?.confidence ?? 0.9,
        evidence: constraintBundle.byField.budget?.evidence,
      },
    );
  }

  // Quantity min from constraints
  const qtyRange = constraintBundle.byField.quantity?.range;
  let resolvedQuantity = quantity;
  if (qtyRange?.min != null && !resolvedQuantity) {
    resolvedQuantity = uv(
      { value: qtyRange.min, unit: qtyRange.unit },
      {
        provenance: "EXPLICIT",
        source: "USER_EXPLICIT",
        confidence: 0.93,
        evidence: constraintBundle.byField.quantity?.evidence,
      },
    );
  } else if (
    constraintBundle.byField.quantity?.value &&
    !resolvedQuantity
  ) {
    const n = Number(constraintBundle.byField.quantity.value);
    if (Number.isFinite(n)) {
      resolvedQuantity = uv(
        { value: n, unit: qtyRange?.unit ?? "adet" },
        {
          provenance: "EXPLICIT",
          source: "USER_EXPLICIT",
          confidence: 0.92,
          evidence: constraintBundle.byField.quantity.evidence,
        },
      );
    }
  }

  const productType =
    identity.productType
      ? uv(identity.productType, {
          provenance: textIncludes(normalizedInput, identity.productType)
            ? "EXPLICIT"
            : "INFERRED",
          source: "PRODUCT_IDENTITY",
        })
      : /\bbebek\s*arab/i.test(normalizedInput)
        ? uv("bebek arabası", {
            provenance: "EXPLICIT",
            source: "USER_EXPLICIT",
            evidence: ["bebek arabası"],
          })
        : /\bkahve\s*makinesi\b/i.test(normalizedInput)
          ? uv("kahve makinesi", {
              provenance: "EXPLICIT",
              source: "USER_EXPLICIT",
              evidence: ["kahve makinesi"],
            })
          : /\baraç\b|\barac\b/i.test(normalizedInput) &&
              subjectValue === "VEHICLE"
            ? uv("araç", {
                provenance: "EXPLICIT",
                source: "USER_EXPLICIT",
                evidence: ["araç"],
              })
            : undefined;

  const reconciled = reconcileUnderstanding({
    intent: intentDecision,
    category,
    strategy: strategyDecision,
    subject: subjectDecision,
  });

  /**
   * KAPSAM KARARI — TEK KAPI (kurucu kararı, 2026-08-25).
   *
   * Karar burada YENİDEN çözümlenmez; nihai (uzlaştırılmış) işlem türünden
   * okunur. KB-16'dan sonra `SELL` tam olarak şu anlama gelir: kullanıcının
   * AÇIKÇA adlandırdığı işlem, kendi nesnesini elden çıkarmaktır
   * ("satmak istiyorum", "kiraya vermek"). İlan sıfatları ("satılık",
   * "kiralık") artık SELL üretmez — onlar arayan tarafı TALEP tarafına koyar.
   * Kullanım bağlamındaki elden çıkarma ifadeleri de karar veremez, bu yüzden
   * "Aracımı satmak için ekspertiz hizmeti arıyorum" burada SERVICE olarak
   * gelir ve DEMAND kalır.
   *
   * Bu yüzden kapsam kuralı tek satırdır ve kelimeye özel değildir.
   */
  const isUnsupportedSupply = reconciled.intent.value === "SELL";
  const requestScope: UnderstandingDecision<RequestScope> = {
    value: isUnsupportedSupply ? "UNSUPPORTED_SUPPLY" : "DEMAND",
    confidence: isUnsupportedSupply ? reconciled.intent.confidence : 0.9,
    status: "CONFIDENT",
    evidence: isUnsupportedSupply
      ? [
          "supply-side-disposal",
          `intent=${String(reconciled.intent.value)}`,
          ...(reconciled.intent.evidence ?? []),
        ]
      : ["demand"],
  };

  /**
   * KAPSAM DIŞI TALEPTE KATEGORİ VE KONU UYDURULMAZ.
   *
   * Bir arz ilanının kategorisi Talepo için anlamsızdır: onu yönlendirecek
   * bir talep yoktur. Kararı sessizce silmek yerine UNKNOWN'a çekip kanıtı
   * kaydediyoruz — "ölçemedim" ile "ölçtüm, yok" ayrımı korunur (I14).
   */
  if (isUnsupportedSupply) {
    reconciled.category = {
      value: null,
      confidence: 0,
      status: "UNKNOWN",
      evidence: ["unsupported-supply-no-category"],
    };
    reconciled.subject = {
      value: null,
      confidence: 0,
      status: "UNKNOWN",
      evidence: ["unsupported-supply-no-subject"],
    };
    // Semantik konu da susar: "Evimi kiraya vermek istiyorum" cümlesinde ev
    // gerçekten bir gayrimenkuldür, ama Talepo için yönlendirilecek bir TALEP
    // yoktur; konuyu kesin gibi taşımak kazanılmamış bir statü olur.
    requestSubject = {
      ...requestSubject,
      kind: {
        value: null,
        confidence: 0,
        status: "UNKNOWN",
        evidence: ["unsupported-supply-no-subject"],
      },
      name: undefined,
      displayPhrase: undefined,
    };
  }

  const resolvedKeys = new Set<string>();
  if (identityBlock.brand) resolvedKeys.add("brand");
  if (identityBlock.model) resolvedKeys.add("model");
  if (identityBlock.series) resolvedKeys.add("series");
  if (condition) resolvedKeys.add("condition");
  if (budget) resolvedKeys.add("budget");
  if (location?.city) {
    resolvedKeys.add("city");
    resolvedKeys.add("location");
  }
  if (quantity) resolvedKeys.add("quantity");
  for (const k of Object.keys(attributes)) resolvedKeys.add(k);
  for (const k of Object.keys(preferences)) resolvedKeys.add(k);
  if (attributes.modelYear) resolvedKeys.add("modelYear");
  if (attributes.mileage) resolvedKeys.add("mileage");
  if (preferences.mileagePreference) resolvedKeys.add("mileage");

  const unknownFields = buildUnknownFields({
    strategy: reconciled.strategy.value ?? "UNKNOWN",
    resolvedKeys,
  });

  const factRows: Array<{
    key: string;
    value: UnderstandingValue<unknown> | undefined;
  }> = [
    { key: "intent", value: intentDecision.value ? uv(intentDecision.value, {
      provenance: "INFERRED",
      source: "DETERMINISTIC_INFERENCE",
      confidence: intentDecision.confidence,
      evidence: intentDecision.evidence,
    }) : undefined },
    { key: "brand", value: identityBlock.brand },
    { key: "model", value: identityBlock.model },
    { key: "quantity", value: quantity as UnderstandingValue<unknown> | undefined },
    { key: "condition", value: condition },
    { key: "budget", value: budget },
    ...Object.entries(attributes).map(([key, value]) => ({ key, value })),
    ...Object.entries(preferences).map(([key, value]) => ({ key, value })),
  ];
  // Mark explicit intent signals as explicit facts
  const { explicitFacts, inferredFacts } = partitionFacts(factRows);
  for (const ev of intentResolved.evidence) {
    if (!explicitFacts.some((f) => f.evidence?.includes(ev))) {
      explicitFacts.push({
        key: "intentSignal",
        value: ev,
        confidence: 0.95,
        provenance: "EXPLICIT",
        source: "USER_EXPLICIT",
        evidence: [ev],
      });
    }
  }

  const attrConfs = [
    ...Object.values(attributes).map((a) => a.confidence),
    ...Object.values(preferences).map((a) => a.confidence),
  ];
  const attributeConfidence =
    attrConfs.length > 0
      ? attrConfs.reduce((a, b) => a + b, 0) / attrConfs.length
      : 0.3;

  const understandingConfidence = computeUnderstandingConfidence({
    intent: reconciled.intent,
    category: reconciled.category,
    strategy: reconciled.strategy,
    identityConfidence: identity.confidence ?? 0.3,
    attributeConfidence,
    ambiguityCount: ambiguities.length,
    contradictionCount: contradictions.length,
  });

  const publishReadiness = (() => {
    if (!normalizedInput.trim()) {
      return {
        status: "BLOCKED" as const,
        reasons: ["empty input"],
      };
    }
    if (
      reconciled.intent.status === "UNKNOWN" &&
      reconciled.category.status === "UNKNOWN" &&
      !identityBlock.model
    ) {
      return {
        status: "ENRICHABLE" as const,
        reasons: ["weak understanding — publishable with enrichment"],
      };
    }
    if (unknownFields.length > 0) {
      return {
        status: "ENRICHABLE" as const,
        reasons: ["optional enrichment fields available"],
      };
    }
    return { status: "READY" as const, reasons: [] };
  })();

  const priceAnalysisReadiness = (() => {
    const strat = reconciled.strategy.value;
    if (!strat || strat === "UNKNOWN" || reconciled.strategy.status === "UNKNOWN") {
      return {
        status: "NOT_READY" as const,
        reasons: ["strategy unresolved"],
      };
    }
    if (
      reconciled.strategy.status === "TENTATIVE" ||
      unknownFields.includes("brand") ||
      unknownFields.includes("model")
    ) {
      return {
        status: "LIMITED" as const,
        reasons: ["strategy known but identity/attributes incomplete"],
      };
    }
    return { status: "READY" as const, reasons: [] };
  })();

  const recommendedQuestions = unknownFields
    .filter((f) =>
      ["budget", "city", "modelYear", "condition", "mileage", "brand"].includes(
        f,
      ),
    )
    .slice(0, 5);

  const detectedCat = detectCategoryResult(rawInput);

  ensureAutomotiveCatalogRegistered();

  return applyCatalogEnrichment({
    version: "v1",
    rawInput,
    normalizedInput,
    intent: reconciled.intent,
    requestScope,
    subject: {
      kind: reconciled.subject,
      productType,
      serviceType: attributes.serviceType as UnderstandingValue<string> | undefined,
    },
    requestSubject,
    category: reconciled.category,
    strategy: reconciled.strategy,
    identity: identityBlock,
    attributes,
    /**
     * ÇÖZÜLEN TİPLİ VARLIK KALICI OLUR (1K).
     *
     * Ölçülen kusur: varlık kategoriyi CONFIDENT yapacak kadar güçlü
     * sayılıyor ama saklanacak kadar önemli sayılmıyordu; anlaşıldıktan
     * sonra yalnız `rawInput` metninde kalıyordu. Buradan çıkan kayıt
     * publish snapshot'ına taşınır ve ileride routing envelope tarafından
     * kayıpsız okunabilir.
     */
    resolvedEntities: resolvedDomainEntities,
    budget: resolvedBudget,
    location,
    quantity: resolvedQuantity,
    condition,
    preferences,
    constraints: constraintBundle,
    explicitFacts,
    inferredFacts,
    unknownFields,
    ambiguities,
    contradictions,
    understandingConfidence,
    publishReadiness,
    priceAnalysisReadiness,
    recommendedQuestions,
    diagnostics: {
      categoryScore: detectedCat.score,
      categoryConfident: detectedCat.confident,
      categoryRunnerUp: detectedCat.runnerUpId,
      numberRoles: numbers.map((n) => ({
        raw: n.raw,
        role: n.role,
        value: n.value,
      })),
      intentSignals: intentResolved.evidence,
      notes: strategyResolution.strategyReasons,
    },
  });
}
