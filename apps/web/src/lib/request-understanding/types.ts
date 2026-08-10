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

export type RequestUnderstandingResult = {
  version: "v1";

  rawInput: string;
  normalizedInput: string;

  intent: UnderstandingDecision<RequestIntent>;

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
};
