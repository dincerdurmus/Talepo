export type ParsedRequest = {
  rawText: string;
  categoryId: string;
  subcategory?: string;
  quantity?: number;
  unit?: string;
  city?: string;
  deliveryDays?: number;
  budget?: number;
  attributes: Record<string, string | number | boolean>;
};

export type KnowledgeResult = {
  categoryId: string;
  confidence: number;
  notes: string[];
  suggestions: string[];
};

export type PriceEstimate = {
  min: number;
  max: number;
  currency: "TRY";
  confidence: number;
  explanation: string;
};

export type MatchEstimate = {
  estimatedCompanyCount: number;
  expectedOfferCount: number;
  explanation: string;
};

export type Recommendation = {
  id: string;
  title: string;
  description: string;
  reason: string;
  field?: string;
  suggestedValue?: string | number;
};

export type AiCoreResult = {
  parsed: ParsedRequest;
  knowledge: KnowledgeResult;
  pricing: PriceEstimate;
  matching: MatchEstimate;
  recommendations: Recommendation[];
  professionalText: string;
  score: number;
};
