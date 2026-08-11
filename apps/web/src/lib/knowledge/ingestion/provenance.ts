import type { KnowledgeSourceType, ProvenanceRecord } from "../types";
import type { IngestRejectReason } from "../types";

/** Critical OEM/compatibility cannot rely on marketplace alone. */
export const CRITICAL_COMPATIBILITY_AUTHORITIES: KnowledgeSourceType[] = [
  "OFFICIAL_MANUFACTURER",
  "OFFICIAL_EPC",
  "LICENSED_CATALOG",
  "OFFICIAL_DISTRIBUTOR",
  "TRUSTED_DATASET",
  "STANDARDS_BODY",
];

export function canAutoSafeSource(sourceType: KnowledgeSourceType): boolean {
  if (sourceType === "AI_INFERRED") return false;
  if (sourceType === "USER_DISCOVERED") return false;
  if (sourceType === "MARKETPLACE") return false;
  return CRITICAL_COMPATIBILITY_AUTHORITIES.includes(sourceType);
}

export function provenanceReasons(
  provenance: ProvenanceRecord,
  opts?: { criticalCompatibility?: boolean },
): IngestRejectReason[] {
  const reasons: IngestRejectReason[] = [];
  if (!provenance.sourceType || !provenance.sourceName) {
    reasons.push("MISSING_PROVENANCE");
  }
  if (provenance.sourceType === "AI_INFERRED") {
    reasons.push("AI_INFERRED_NOT_SAFE");
  }
  if (provenance.sourceType === "USER_DISCOVERED") {
    reasons.push("USER_DISCOVERED_NOT_SAFE");
  }
  if (
    opts?.criticalCompatibility &&
    provenance.sourceType === "MARKETPLACE"
  ) {
    reasons.push("MARKETPLACE_INSUFFICIENT_AUTHORITY");
  }
  if (provenance.confidence === "LOW") {
    reasons.push("LOW_CONFIDENCE");
  }
  return reasons;
}

export function assertProvenancePresent(
  provenance: ProvenanceRecord | undefined,
): IngestRejectReason[] {
  if (!provenance) return ["MISSING_PROVENANCE"];
  return provenanceReasons(provenance);
}
