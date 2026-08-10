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
import { normalizeUnderstandingInput } from "@/lib/request-understanding/normalize";
import {
  classifyNumbers,
  modelIdentifierTokens,
  primaryQuantity,
  primaryYear,
  type ClassifiedNumber,
} from "@/lib/request-understanding/number-role";
import { clamp01, partitionFacts, uv } from "@/lib/request-understanding/provenance";
import type {
  DecisionStatus,
  RequestIntent,
  RequestUnderstandingResult,
  SubjectKind,
  UnderstandingAmbiguity,
  UnderstandingContradiction,
  UnderstandingDecision,
  UnderstandingValue,
} from "@/lib/request-understanding/types";
import { detectCategoryResult } from "@/lib/ai/parser/category";
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
import { findAutomotiveModel } from "@/lib/ai/parser/brand-catalog";

import { reconcileUnderstanding } from "./reconcile-understanding";
import {
  reconcileParentIdentityTokens,
  resolveSemanticSubject,
} from "./semantic-subject";
import type { SemanticRequestSubject } from "./types";

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

function textIncludes(haystack: string, needle: string): boolean {
  if (!needle.trim()) return false;
  return haystack
    .toLocaleLowerCase("tr-TR")
    .includes(needle.toLocaleLowerCase("tr-TR"));
}

function gateCategory(
  rawInput: string,
  intent: RequestIntent,
): UnderstandingDecision<string> {
  const detected = detectCategoryResult(rawInput);
  const scoreConf = clamp01(detected.score / 6);
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

  const status = decisionStatus(scoreConf, {
    detectorConfident: detected.confident,
  });

  return {
    value: status === "UNKNOWN" ? null : detected.categoryId,
    confidence: scoreConf,
    status: detected.confident && scoreConf >= CATEGORY_DECISION.tentativeBelow
      ? "CONFIDENT"
      : status === "UNKNOWN"
        ? "UNKNOWN"
        : "TENTATIVE",
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
    return uv("USED", {
      provenance: "EXPLICIT",
      source: "USER_EXPLICIT",
      evidence: ["condition:used"],
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
): UnderstandingValue<string> | undefined {
  const m = normalized.match(/\b([1-9]\s*\+\s*[0-9])\b/);
  if (!m) return undefined;
  return uv(m[1]!.replace(/\s+/g, ""), {
    provenance: "EXPLICIT",
    source: "USER_EXPLICIT",
    evidence: [m[0]],
  });
}

function extractListingType(
  normalized: string,
  intent: RequestIntent,
): UnderstandingValue<string> | undefined {
  if (/\bkiralık\b|\bkiralik\b/.test(normalized) || intent === "RENT") {
    if (/\bsatılık\b|\bsatilik\b/.test(normalized)) {
      // satılık wins over incidental kira mentions when both? "kiracılı satılık" has no kiralık
    }
  }
  if (/\bsatılık\b|\bsatilik\b/.test(normalized) || intent === "SELL") {
    return uv("Satılık", {
      provenance: "EXPLICIT",
      source: "USER_EXPLICIT",
      evidence: ["satılık"],
    });
  }
  if (/\bkiralık\b|\bkiralik\b/.test(normalized) || intent === "RENT") {
    return uv("Kiralık", {
      provenance: "EXPLICIT",
      source: "USER_EXPLICIT",
      evidence: ["kiralık"],
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

/**
 * Canonical Request Understanding entry point.
 * Orchestrates existing engines — does not rewrite them.
 */
export function understandRequest(
  input: UnderstandRequestInput | string,
): RequestUnderstandingResult {
  const rawInput = typeof input === "string" ? input : input.rawInput;
  const structured = typeof input === "string" ? undefined : input.structured;
  const normalizedInput = normalizeUnderstandingInput(rawInput);

  const numbers = classifyNumbers(normalizedInput);
  const intentHits = collectIntentSignals(normalizedInput);
  let intentResolved = resolveIntentFromSignals(intentHits);

  const modelTokens = modelIdentifierTokens(numbers);
  const autoModel = findAutomotiveModel(normalizedInput);
  const hasVehicleModel = Boolean(autoModel) || modelTokens.some((t) =>
    /^[a-z]?\d{2,3}[a-z]?$/i.test(t.raw.replace(/\s/g, "")) ||
    /^[cesagl]\d{2,3}/i.test(t.raw),
  );

  const hasPropertySignals =
    /\b(ev|daire|dükkan|dukkan|ofis|villa|konut|2\s*\+\s*1|3\s*\+\s*1)\b/i.test(
      normalizedInput,
    ) || Boolean(extractRoomLayout(normalizedInput));

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

  let subjectDecision: UnderstandingDecision<SubjectKind> = {
    value: subjectValue,
    confidence: intentResolved.confidence,
    status: decisionStatus(intentResolved.confidence, {
      forceUnknown: subjectValue === "UNKNOWN",
    }),
    evidence: [`subjectFromIntent=${intentResolved.intent}`],
  };

  let category = gateCategory(normalizedInput, intentResolved.intent);

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
  if (year && years.length === 1 && !/sonrası|sonrasi|üstü|ustu|ama/.test(normalizedInput)) {
    attributes.modelYear = uv(year.value!, {
      provenance: "EXPLICIT",
      source: "USER_EXPLICIT",
      evidence: year.evidence,
    });
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

  const room = extractRoomLayout(normalizedInput);
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

  const cityRaw =
    structured?.city?.trim() ||
    (typeof structured?.fieldValues?.city === "string"
      ? structured.fieldValues.city.trim()
      : "") ||
    detectCity(normalizedInput);
  const cityFromStructured =
    Boolean(structured?.city?.trim()) ||
    Boolean(
      typeof structured?.fieldValues?.city === "string" &&
        structured.fieldValues.city.trim(),
    );
  const geo = findProvinceAndDistrictInText(normalizedInput);
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

  const explicitModelFromText =
    autoModel && textIncludes(normalizedInput, autoModel)
      ? autoModel
      : modelTokens[0]?.raw;

  if (identity.brand) {
    const explicitBrand = textIncludes(normalizedInput, identity.brand);
    identityBlock.brand = uv(identity.brand, {
      provenance: explicitBrand ? "EXPLICIT" : "INFERRED",
      source: explicitBrand ? "USER_EXPLICIT" : "PRODUCT_IDENTITY",
      confidence: explicitBrand
        ? 0.95
        : Math.min(0.75, identity.confidence ?? 0.5),
      evidence: explicitBrand
        ? [identity.brand]
        : ["product-identity-inference"],
    });
  }

  const modelValue =
    explicitModelFromText ??
    identity.model ??
    (modelTokens[0] ? modelTokens[0].raw : null);
  if (modelValue) {
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

  // B3.7 — semantic subject / relationship (after identity, before strategy)
  let requestSubject: SemanticRequestSubject = resolveSemanticSubject({
    normalizedInput,
    identity: {
      brand: identityBlock.brand?.value ?? identity.brand,
      model: identityBlock.model?.value ?? identity.model,
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
    automotiveModel: autoModel ?? null,
  });

  // Reconcile identity with parent tokens (generic dedupe brand⊃model)
  const parentTokens = reconcileParentIdentityTokens(
    {
      brand: identityBlock.brand?.value ?? null,
      model: identityBlock.model?.value ?? null,
      series: identityBlock.series?.value ?? null,
    },
    { automotiveModel: autoModel },
  );
  if (parentTokens.brand && identityBlock.brand) {
    identityBlock.brand = {
      ...identityBlock.brand,
      value: parentTokens.brand,
    };
  } else if (parentTokens.brand && !identityBlock.brand) {
    identityBlock.brand = uv(parentTokens.brand, {
      provenance: "EXPLICIT",
      source: "USER_EXPLICIT",
      confidence: 0.9,
      evidence: [parentTokens.brand],
    });
  }
  if (parentTokens.model) {
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

    attributes.needType = uv("part", {
      provenance: "INFERRED",
      source: "DETERMINISTIC_INFERENCE",
      confidence: requestSubject.kind.confidence,
      evidence: requestSubject.kind.evidence,
    });

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
    if (requestSubject.parentEntity?.model) {
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

    attributes.needType = uv("service", {
      provenance: "INFERRED",
      source: "DETERMINISTIC_INFERENCE",
      confidence: requestSubject.kind.confidence,
      evidence: requestSubject.kind.evidence,
    });
    if (requestSubject.serviceType) {
      attributes.serviceType = requestSubject.serviceType;
    }
    if (requestSubject.target) {
      attributes.serviceTarget = requestSubject.target;
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
  const contradictions: UnderstandingContradiction[] = [];

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

  return {
    version: "v1",
    rawInput,
    normalizedInput,
    intent: reconciled.intent,
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
    budget,
    location,
    quantity,
    condition,
    preferences,
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
  };
}
