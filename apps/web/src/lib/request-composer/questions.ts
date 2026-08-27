/**
 * Question minimization wired to hybrid state + schema priority + ANY semantics.
 * Sole question authority for Hybrid Composer / /talep ask surface.
 */

import {
  getCategoryById,
  type DynamicField,
} from "@/lib/request-category-engine";
import { resolveNextQuestions } from "@/lib/knowledge/question-resolver";
import {
  knowledgeFieldFromDynamic,
  resolveRequestSchema,
} from "@/lib/knowledge/request-schema";
// Kompozit ölçü kapsaması alanın kendi şema tanımından okunur (KB-15).
import { isCoveredByAggregate } from "@/lib/knowledge/request-schema";
import type { KnowledgeField } from "@/lib/knowledge/types";
import type { CompletenessBreakdown } from "@/lib/price-intelligence/strategy-completeness";
import type { PriceStrategyKey } from "@/lib/price-intelligence/price-strategy-registry";
import { rankNextBestQuestions } from "@/lib/request-brain/question-priority";
import type { QuestionCandidate } from "@/lib/request-brain/types";

import {
  classifyAnswerAuthority,
  isDeliberateNonValueAnswer,
  isInferenceOnlyAnswer,
  mayCloseQuestion,
} from "./answer-authority";
import { toResolverFieldBag } from "./build-state";
import type { CanonicalRequestState } from "./types";

export type HybridQuestionResult = {
  known: string[];
  missingRequired: KnowledgeField[];
  optionalUseful: KnowledgeField[];
  next: KnowledgeField[];
  /** Keys skipped because ANY / NOT_APPLICABLE / not needed for spare parts */
  suppressed: string[];
  /**
   * UI-ready candidates — single authoritative list.
   * Ranking may reuse rankNextBestQuestions as an internal scorer only.
   */
  candidates: QuestionCandidate[];
  /** Debug / tests: which pipeline produced the final list */
  questionSource: "canonical-hybrid";
};

const AUTOMOTIVE_SPARE_SUPPRESS = new Set([
  "engine",
  "transmission",
  "fuel",
  "trim",
  "mileage",
  "bodyCondition",
  "condition",
  "variant",
  "modelYear",
]);

/** Whole-product fields that must not be asked for a spare/part subject. */
const PART_SUPPRESS_WHOLE_PRODUCT = new Set([
  "energyClass",
  "usageArea",
  "listingType",
  "propertyType",
  "roomCount",
  "mileage",
  "engine",
  "transmission",
  "fuel",
]);

/**
 * Product-family fields are named differently by category schemas. If the
 * canonical state already knows one of them, asking the generic equivalent
 * again creates a duplicate question (for example: "süpürge" + "Ürün türü").
 */
const PRODUCT_FAMILY_KEYS = [
  "productType",
  "applianceType",
  "furnitureType",
  "machineType",
  "deviceFamily",
] as const;

function hasKnownProductFamily(state: CanonicalRequestState): boolean {
  return PRODUCT_FAMILY_KEYS.some((key) => {
    const field = state.fields[key];
    return (
      field?.kind === "VALUE" &&
      typeof field.value === "string" &&
      field.value.trim().length > 0
    );
  });
}

function knowledgeFieldToCandidate(field: KnowledgeField): QuestionCandidate {
  const inputType =
    field.type === "ENUM" || field.type === "MULTI_SELECT"
      ? "select"
      : field.type === "NUMBER" || field.type === "MEASUREMENT" || field.type === "RANGE"
        ? "number"
        : "text";
  return {
    fieldKey: field.engineFieldKey ?? field.key,
    label: field.canonicalLabel,
    reason:
      field.priority === "required"
        ? "Yayın için gerekli"
        : "Teklif kalitesini artırabilir",
    publishImpact: field.priority === "required" ? 0.9 : 0.5,
    matchingImpact: 0.6,
    priceImpact: 0.4,
    confidenceImpact: 0.4,
    priorityScore: field.priority === "required" ? 0.9 : 0.55,
    inputType,
    options: field.options?.map((o) => ({ label: o.label, value: o.value })),
    quickChoices: field.options?.map((o) => ({
      label: o.label,
      value: o.value,
    })),
  };
}

/**
 * Reuse strategy ranking as an internal sort — allowlist remains hybrid schema next[].
 */
function rankWithinAllowlist(
  allowlist: KnowledgeField[],
  opts: {
    strategy?: PriceStrategyKey | null;
    completeness?: CompletenessBreakdown | null;
    fieldValues: Record<string, string>;
    dynamicFields?: DynamicField[];
    requiredDynamicKeys?: string[];
  },
): QuestionCandidate[] {
  const base = allowlist.map(knowledgeFieldToCandidate);
  if (!opts.strategy || !opts.completeness || base.length === 0) {
    return base.slice(0, 3);
  }

  const allowKeys = new Set(allowlist.map((f) => f.key));
  const ranked = rankNextBestQuestions({
    strategy: opts.strategy,
    completeness: opts.completeness,
    fieldValues: opts.fieldValues,
    commonDraft: {
      title: opts.fieldValues.title ?? "",
      city: opts.fieldValues.city ?? "",
      budget: opts.fieldValues.budget ?? "",
      quantity: opts.fieldValues.quantity ?? "",
      delivery: opts.fieldValues.delivery ?? "",
    },
    dynamicFields: opts.dynamicFields ?? [],
    requiredDynamicKeys: opts.requiredDynamicKeys ?? [],
    maxQuestions: 8,
  }).filter((q) => allowKeys.has(q.fieldKey));

  const seen = new Set(ranked.map((q) => q.fieldKey));
  const merged = [
    ...ranked,
    ...base.filter((c) => !seen.has(c.fieldKey)),
  ];
  return merged.slice(0, 3);
}

/**
 * ÇIKARIM DOĞRULAMA SORULARI (KB-17).
 *
 * Değeri YALNIZ Talepo'nun tahmininden gelen alanlar için soru üretir. Kural
 * anahtar ya da kategori özel değildir; tek ölçüt cevap otoritesidir.
 *
 * Alan TANIMI iki otoriteden okunur, sırayla:
 *   1. Çözülmüş bilgi şeması — alan zaten sorulabilir durumdaysa oradan.
 *   2. Kategorinin kendi alan tanımı — şemanın o anki koşulları alanı
 *      gizlemiş olabilir (ör. servis niyetinde "Araç durumu"), ama değer
 *      state'te DURUYOR ve yayına gidiyor. Görünmeyen bir alana yazılmış
 *      uydurma değer, sorulmayan sorunun en tehlikeli hâlidir.
 * İkisinde de tanım yoksa soru üretilemez; bu durumda değer sessizce
 * doğrulanmış SAYILMAZ — sadece bu katman onu ele alamaz.
 *
 * KUYRUKTA OLMAK ÖNCELİK DEĞİLDİR (D3b, 2026-08-26).
 * Bu katman eskiden "alan zaten kuyrukta" diye doğrulamayı ÜRETMİYORDU.
 * Oysa kuyruk üçten uzundur ve kullanıcı yalnız ilk üçünü görür: kuyruğun
 * beşinci sırasındaki bir çıkarım, pratikte hiç sorulmamış gibi davranır.
 * Bu yüzden burada kuyruk durumu OKUNMAZ; üretilen doğrulamalar çağıranda
 * kuyruğun ÖNÜNE alınır ve tekilleştirme orada yapılır. Aynı alanın ikinci
 * kez sorulmaması bir tekilleştirme sorunudur, bir üretim sorunu değil.
 */
function buildInferenceConfirmations(input: {
  state: CanonicalRequestState;
  categoryId: string;
  values: Record<string, string>;
  subjectPinIsUserAuthored: boolean;
}): KnowledgeField[] {
  const schema = resolveRequestSchema({
    categoryId: input.categoryId,
    subcategorySlug: input.state.subcategorySlug,
    values: input.values,
    subjectPinIsUserAuthored: input.subjectPinIsUserAuthored,
  });
  const schemaByKey = new Map(
    schema.fields.map((f) => [f.engineFieldKey ?? f.key, f]),
  );
  const engineByKey = new Map(
    (getCategoryById(input.categoryId)?.fields ?? []).map((f) => [f.key, f]),
  );

  const out: KnowledgeField[] = [];
  for (const [key, field] of Object.entries(input.state.fields)) {
    if (!isInferenceOnlyAnswer(field)) continue;
    const known =
      schemaByKey.get(key) ??
      (engineByKey.has(key)
        ? knowledgeFieldFromDynamic(engineByKey.get(key)!)
        : null);
    if (!known) continue;
    out.push(known);
  }
  return out;
}

export type ResolveHybridQuestionsOptions = {
  strategy?: PriceStrategyKey | null;
  completeness?: CompletenessBreakdown | null;
  dynamicFields?: DynamicField[];
  requiredDynamicKeys?: string[];
};

/**
 * Resolve next questions from canonical hybrid state.
 * ANY / NOT_APPLICABLE are not missing; automotive spare suppresses engine/TX.
 */
export function resolveHybridQuestions(
  state: CanonicalRequestState,
  opts?: ResolveHybridQuestionsOptions,
): HybridQuestionResult {
  const values = toResolverFieldBag(state);

  /**
   * KAPSAM DIŞI TALEPTE SORU MOTORU BAŞLAMAZ (kurucu kararı, 2026-08-25).
   *
   * Arz ilanı Talepo'nun konusu değildir; ona bütçe, konum ya da marka
   * sormak kullanıcıyı yayınlanamayacak bir formda yürütmek olur. Karar
   * burada verilmez — anlama katmanının tek kapsam kararı okunur.
   */
  if (state.understanding.requestScope?.value === "UNSUPPORTED_SUPPLY") {
    return {
      known: [],
      missingRequired: [],
      optionalUseful: [],
      next: [],
      suppressed: ["unsupported-supply"],
      candidates: [],
      questionSource: "canonical-hybrid",
    };
  }

  const categoryId =
    state.categoryId ?? state.understanding.category.value ?? null;
  const categoryUnknown = !categoryId || categoryId === "unknown";

  // Unknown category: don't dump appliance/vehicle/estate questions on free-text
  if (categoryUnknown) {
    return {
      known: [],
      missingRequired: [],
      optionalUseful: [],
      next: [],
      suppressed: ["no-category"],
      candidates: [
        {
          fieldKey: "needDescription",
          label: "Ne aradığını biraz daha tarif eder misin?",
          reason: "Kategori henüz net değil",
          publishImpact: 0.9,
          matchingImpact: 0.8,
          priceImpact: 0.2,
          confidenceImpact: 0.9,
          priorityScore: 0.95,
          inputType: "text",
          placeholder: "Ürün, parça, hizmet veya emlak olarak yazabilirsiniz",
        },
      ],
      questionSource: "canonical-hybrid",
    };
  }

  /**
   * TEK CEVAP OTORİTESİ (D2 blokeri B6).
   *
   * Burada eskiden ikinci bir "hangi provenance cevap sayılır" listesi vardı
   * (`EXPLICIT_TEXT || EXPLICIT_BROWSE`). `answer-authority` modülü tek otorite
   * olarak tanıtılmışken bu liste sessizce ondan ayrışabilirdi: örneğin
   * `CATALOG_ENRICHED` orada soruyu kapatmaya yetkiliyken burada değildi.
   * Karar artık türetilir; ikinci doğru listesi bırakılmaz.
   *
   * DEĞER TAŞIMAYAN CEVAPLAR (D3f Dilim 1). Burada eskiden ikinci bir elle
   * yazılmış `kind` listesi (`ANY || NOT_APPLICABLE`) duruyordu ve açık
   * kullanıcı kaynaklı `UNKNOWN`u — yani "Bilmiyorum" cevabını — tanımıyordu.
   * Karar tek kanonik yardımcıdan okunur; ikinci liste bırakılmaz.
   */
  const explicitKeys = Object.entries(state.fields)
    .filter(
      ([, f]) =>
        isDeliberateNonValueAnswer(f) ||
        mayCloseQuestion(classifyAnswerAuthority(f)),
    )
    .map(([k]) => k);

  /**
   * KONU İĞNESİ KİMİN? (KB-17)
   *
   * Alt kategori bir gezinme seçiminden de gelebilir, serbest metinden
   * çıkarımdan da. Yalnız İKİNCİSİNİ ölçebildiğimizde iğneyi "kullanıcı
   * koymadı" sayarız; `needType` hiç yoksa eski davranış korunur.
   */
  const subjectPinIsUserAuthored = !isInferenceOnlyAnswer(state.fields.needType);

  const base = resolveNextQuestions({
    categoryId,
    subcategorySlug: state.subcategorySlug,
    values,
    explicitKeys,
    subjectPinIsUserAuthored,
  });

  const isPartSubject =
    values.needType === "part" ||
    values.needType === "tire" ||
    state.understanding.requestSubject.kind.value === "PART" ||
    state.understanding.requestSubject.kind.value === "ACCESSORY";

  const isAutoSpare = categoryId === "automotive" && isPartSubject;

  const automotiveNeedUnknown =
    categoryId === "automotive" &&
    !isAutoSpare &&
    !(
      state.fields.needType?.kind === "VALUE" &&
      state.fields.needType.value
    ) &&
    state.understanding.requestSubject.kind.value !== "VEHICLE";

  const browsePinnedNeed =
    state.fields.needType?.provenance === "EXPLICIT_BROWSE" &&
    state.fields.needType.kind === "VALUE";

  const productFamilyKnown = hasKnownProductFamily(state);

  const suppressed: string[] = [];
  const filterSpare = (fields: KnowledgeField[]) => {
    if (!isAutoSpare && !isPartSubject) return fields;
    return fields.filter((f) => {
      if (isAutoSpare && AUTOMOTIVE_SPARE_SUPPRESS.has(f.key)) {
        suppressed.push(f.key);
        return false;
      }
      if (isPartSubject && PART_SUPPRESS_WHOLE_PRODUCT.has(f.key)) {
        suppressed.push(f.key);
        return false;
      }
      return true;
    });
  };

  // Never re-ask ANY / NA / known VALUE fields; never force model when brand is ANY
  const brandAny = state.fields.brand?.kind === "ANY";
  const brandPreferred = (state.fields.brand?.preferredValues?.length ?? 0) >= 1;
  const filterAnyAware = (fields: KnowledgeField[]) =>
    fields.filter((f) => {
      if (
        productFamilyKnown &&
        PRODUCT_FAMILY_KEYS.includes(
          (f.engineFieldKey ?? f.key) as (typeof PRODUCT_FAMILY_KEYS)[number],
        )
      ) {
        suppressed.push(f.key);
        return false;
      }
      // Automotive root without intent: only ask needType — never flash vehicle-purchase fields
      if (
        automotiveNeedUnknown &&
        f.key !== "needType"
      ) {
        suppressed.push(f.key);
        return false;
      }
      // Generic spare-part: year is optional unless the part schema marks it visible
      if (
        f.key === "modelYear" &&
        (isAutoSpare ||
          state.understanding.requestSubject.kind.value === "PART" ||
          state.understanding.requestSubject.kind.value === "ACCESSORY")
      ) {
        suppressed.push(f.key);
        return false;
      }
      if (browsePinnedNeed && f.key === "needType") {
        suppressed.push(f.key);
        return false;
      }
      const field = state.fields[f.key];
      const kind = field?.kind;
      /* Bilinçli değer taşımayan cevap soruyu kapatır — tek kanonik ölçüt. */
      if (isDeliberateNonValueAnswer(field)) {
        suppressed.push(f.key);
        return false;
      }
      /**
       * DEĞER VAR ≠ KULLANICI CEVAPLADI (KB-17).
       *
       * Kullanıcının yazdığı ya da çağrılabilir bir katalog otoritesinin
       * doğruladığı değer soruyu kapatır. Yalnız Talepo'nun tahmininden
       * gelen değer kapatamaz: soru sorulmaya devam eder, tahmin de en fazla
       * ön-seçili cevap olarak taşınır.
       */
      if (kind === "VALUE" && !isInferenceOnlyAnswer(field)) return false;
      /**
       * KOMPOZİT ÖLÇÜ KAPSAMASI (KB-15).
       *
       * Kullanıcı "20x15x10" yazdığında en/boy/derinlik ayrı ayrı boş kalır
       * ve soru motoru bunları eksik sayıp sonraki dalgalarda tekrar
       * soruyordu. Karar burada üretilmez: alanın KENDİ şema tanımındaki
       * `coveredByAggregate` kuralı okunur. Eksen alanlarına değer
       * YAZILMAZ — hangi sayının en olduğu şemada tanımlı değildir ve
       * uydurulamaz.
       */
      if (
        isCoveredByAggregate(f, (key) => {
          const src = state.fields[key];
          return src?.kind === "VALUE" ? src.value : null;
        })
      ) {
        suppressed.push(f.key);
        return false;
      }
      // Preferred / allowed multi-value satisfies the field for ask purposes
      if (
        (field?.preferredValues?.length ?? 0) >= 1 ||
        (field?.allowedValues?.length ?? 0) >= 1
      ) {
        suppressed.push(f.key);
        return false;
      }
      // Exclusion-only without need to pick a positive value (ANY+exclude already handled)
      if (brandAny && (f.key === "brand" || f.key === "brandPreference")) {
        suppressed.push(f.key);
        return false;
      }
      if (
        brandPreferred &&
        (f.key === "brand" || f.key === "brandPreference")
      ) {
        suppressed.push(f.key);
        return false;
      }
      // TV: don't force model when unknown
      if (
        f.key === "model" &&
        state.fields.model?.kind === "UNKNOWN" &&
        !(state.fields.model?.preferredValues?.length) &&
        (state.fields.productType?.value?.includes("televizyon") ||
          state.taxonomyNodeId?.includes("televizyon"))
      ) {
        return false;
      }
      // deviceFamily is for generic hardware leaf — irrelevant on TV / appliance paths
      if (
        f.key === "deviceFamily" &&
        (state.fields.productType?.value
          ?.toLocaleLowerCase("tr-TR")
          .includes("televizyon") ||
          state.taxonomyNodeId?.includes("televizyon") ||
          state.understanding.requestSubject.kind.value === "PART" ||
          categoryId === "appliances" ||
          categoryId === "automotive")
      ) {
        suppressed.push(f.key);
        return false;
      }
      // Explicit part condition (çıkma / ikinci el) — don't re-ask vehicle condition
      if (
        f.key === "condition" &&
        (state.understanding.requestSubject.kind.value === "PART" ||
          state.understanding.requestSubject.kind.value === "ACCESSORY" ||
          values.needType === "part")
      ) {
        suppressed.push(f.key);
        return false;
      }
      return true;
    });

  const missingRequired = filterAnyAware(filterSpare(base.missingRequired));
  const optionalUseful = filterAnyAware(filterSpare(base.optionalUseful));

  /**
   * DOĞRULAMA ÖNCE GELİR (KB-17).
   *
   * Kuyruğun başında, hiç bilmediğimiz alanlar değil, UYDURDUĞUMUZ alanlar
   * durur. Gerekçe simetrik değildir: eksik bir alan talebi eksik bırakır,
   * yanlış bir çıkarım ise talebi YANLIŞ havuza gönderir ve kullanıcı bunu
   * hiç görmez. `missingRequired` bilerek dokunulmaz — yayını yalnız bütçe ve
   * konum kilitler (kurucu kararı); doğrulama sorusu yayını kilitlemez.
   */
  const confirmations = buildInferenceConfirmations({
    state,
    categoryId,
    values,
    subjectPinIsUserAuthored,
  });
  /**
   * Doğrulamalar kuyruğun ÖNÜNE konur — kuyrukta zaten bulunanlar dahil.
   * Alan iki listede birden geçebilir; aşağıdaki tekilleştirme İLK görülen
   * konumu korur, yani doğrulama sırasını. Sıra deterministiktir: çıkarım
   * doğrulamaları kanonik alan durumunun kendi sırasını, kalanlar da
   * `base.next` sırasını aynen izler.
   */
  const nextPool = [...confirmations, ...base.next];
  const seenNextKeys = new Set<string>();
  const next = filterAnyAware(filterSpare(nextPool))
    .filter((f) => {
      const key = f.engineFieldKey ?? f.key;
      if (seenNextKeys.has(key)) return false;
      seenNextKeys.add(key);
      return true;
    })
    .slice(0, 3);

  let candidates = rankWithinAllowlist(next, {
    strategy: opts?.strategy,
    completeness: opts?.completeness,
    fieldValues: values,
    dynamicFields: opts?.dynamicFields,
    requiredDynamicKeys: opts?.requiredDynamicKeys,
  });

  if (categoryId === "automotive" && !isPartSubject) {
    const vehiclePreferenceKeys = new Set(["fuel", "transmission"]);
    const preferred = next
      .filter((field) => vehiclePreferenceKeys.has(field.engineFieldKey ?? field.key))
      .map(knowledgeFieldToCandidate);
    candidates = [
      ...preferred,
      ...candidates.filter((candidate) => !vehiclePreferenceKeys.has(candidate.fieldKey)),
    ].slice(0, 3);
  }

  const cityField = [...missingRequired, ...next, ...optionalUseful].find(
    (field) => (field.engineFieldKey ?? field.key) === "city",
  );
  if (!values.city?.trim() && cityField) {
    candidates = [
      knowledgeFieldToCandidate(cityField),
      ...candidates.filter((candidate) => candidate.fieldKey !== "city"),
    ].slice(0, 3);
  }

  return {
    known: base.known,
    missingRequired,
    optionalUseful,
    next,
    suppressed: [...new Set(suppressed)],
    candidates,
    questionSource: "canonical-hybrid",
  };
}
