import type { CatalogConfidence, CatalogMatchMode } from "../types";
import type {
  TransmissionFamily,
  TransmissionMatchKind,
  TransmissionType,
} from "./transmission-normalize";

export type {
  TransmissionFamily,
  TransmissionType,
  TransmissionMatchKind,
} from "./transmission-normalize";

export type AutomotiveBrandRecord = {
  id: string;
  name: string;
  aliases: string[];
  market_scope: string[];
  status: string;
  source_priority: string[];
};

export type AutomotiveModelRecord = {
  id: string;
  brand_id: string;
  name: string;
  aliases: string[];
  vehicle_types: string[];
  generations: string[];
  completeness: string;
};

export type AutomotivePositionRecord = {
  id: string;
  tr: string;
  aliases: string[];
};

export type AutomotiveManufacturerGroup = {
  id: string;
  name: string;
  brands: string[];
};

export type AutomotivePartRecord = {
  id: string;
  name: string;
  systemId: string;
  systemNameTr: string;
  subsystemId: string;
};

export type AutomotiveGenerationRecord = {
  id: string;
  brandId: string;
  modelId: string;
  name: string;
  aliases: string[];
  platformCodes: string[];
  yearFrom: number;
  yearTo: number | null;
  bodyTypes: string[];
  marketScope: string[];
  provenance: {
    type: string;
    confidence: string;
    verificationStatus: string;
  };
  /** Optional on delta rows; loader normalizes missing to null. */
  notes?: string | null;
};

export type AutomotiveGenerationMatchKind =
  | "exact_name"
  | "platform_code"
  | "alias";

export type AutomotiveElectrification = "ICE" | "MHEV" | "HEV" | "PHEV" | "BEV";

export type AutomotiveEngineRecord = {
  id: string;
  brandId: string;
  modelId: string;
  generationId: string;
  marketingName: string;
  aliases: string[];
  engineCode: string | null;
  displacementCc: number | null;
  fuelType: string;
  powerKw: number | null;
  powerHp: number | null;
  torqueNm: number | null;
  yearFrom: number | null;
  yearTo: number | null;
  electrification: AutomotiveElectrification;
  provenance: {
    type: string;
    confidence: string;
    sourceRef?: string;
  };
  notes: string | null;
};

export type AutomotiveEngineMatchKind = "exact_marketing_name" | "alias";

/**
 * Production-ready automotive transmission entity (V2C).
 * transmissionCode stays null unless explicitly verified in source.
 */
export type AutomotiveTransmissionRecord = {
  id: string;
  brandId: string;
  modelId: string;
  generationId: string;
  engineId?: string | null;
  canonicalName: string;
  marketingName: string;
  aliases: string[];
  transmissionFamily: TransmissionFamily;
  transmissionType: TransmissionType;
  gearCount: number | null;
  /** Never invent from marketing labels (DSG ≠ code). */
  transmissionCode: string | null;
  manufacturerCode?: string | null;
  driveType?: string | null;
  clutchType?: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  marketScope: string[];
  provenance: {
    type: string;
    confidence: string;
    verificationStatus: string;
    sourceRef?: string;
  };
  confidence: "HIGH" | "MEDIUM" | "LOW";
  verificationStatus: string;
  notes?: string | null;
};

export type AutomotiveResolvedHit = {
  id: string;
  name: string;
  confidence: CatalogConfidence;
  matchMode: CatalogMatchMode;
};

export type AutomotiveSubjectEnrichment = {
  domainId: "automotive";
  confidence: CatalogConfidence;
  brand?: AutomotiveResolvedHit;
  model?: AutomotiveResolvedHit;
  generation?: {
    id?: string;
    name?: string;
    raw?: string;
    confidence: CatalogConfidence;
    matchMode?: CatalogMatchMode | "platform_code";
    matchKind?: AutomotiveGenerationMatchKind;
    status: "resolved" | "unverified";
    yearConsistent?: boolean;
  };
  modelYear?: number;
  engine?: {
    id?: string;
    marketingName?: string;
    engineCode?: string | null;
    displacementCc?: number | null;
    fuelType?: string;
    powerKw?: number | null;
    powerHp?: number | null;
    electrification?: AutomotiveElectrification;
    confidence: CatalogConfidence;
    matchMode?: CatalogMatchMode;
    matchKind?: AutomotiveEngineMatchKind;
    status: "resolved" | "ambiguous" | "unverified";
    yearConsistent?: boolean;
    raw?: string;
    candidates?: Array<{
      id: string;
      marketingName: string;
      powerKw: number | null;
      powerHp: number | null;
    }>;
  };
  transmission?: {
    id?: string;
    canonicalName?: string;
    marketingName?: string;
    transmissionFamily?: TransmissionFamily;
    transmissionType?: TransmissionType;
    gearCount?: number | null;
    transmissionCode?: string | null;
    confidence: CatalogConfidence;
    matchMode?: CatalogMatchMode;
    matchKind?: TransmissionMatchKind;
    status: "resolved" | "ambiguous" | "unverified";
    yearConsistent?: boolean;
    raw?: string;
    candidates?: Array<{
      id: string;
      marketingName: string;
      transmissionFamily: TransmissionFamily;
      gearCount: number | null;
    }>;
  };
  part?: AutomotiveResolvedHit & {
    systemId: string;
    systemNameTr: string;
    alternatives?: Array<{ id: string; name: string }>;
  };
  position?: AutomotiveResolvedHit;
  oem?: {
    number: string;
    status: "resolved" | "unresolved";
    confidence: CatalogConfidence;
  };
  unresolvedTokens?: string[];
};
