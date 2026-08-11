export type CatalogConfidence = "exact" | "high" | "medium" | "low" | "unverified";

export interface AutomotiveBrand {
  id: string;
  name: string;
  aliases: string[];
  market_scope: string[];
  status: string;
  source_priority: string[];
}

export interface AutomotiveModel {
  id: string;
  brand_id: string;
  name: string;
  aliases: string[];
  vehicle_types: string[];
  generations: string[];
  completeness: string;
}

export interface AutomotiveResolvedSubject {
  brandId?: string;
  modelId?: string;
  generationId?: string;
  modelYear?: number;
  engineId?: string;
  transmission?: string;
  partSystemId?: string;
  partId?: string;
  positionId?: string;
  oemNumber?: string;
  confidence: CatalogConfidence;
  unresolvedTokens?: string[];
}
