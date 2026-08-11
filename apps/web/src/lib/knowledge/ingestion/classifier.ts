import type {
  ClassifiedIngestRecord,
  IngestRecord,
  IngestRejectReason,
} from "../types";
import {
  canAutoSafeSource,
  provenanceReasons,
} from "./provenance";
import type { ConflictResult, ValidationResult } from "./types";

export function classifyIngestRecord(input: {
  record: IngestRecord;
  validation: ValidationResult;
  conflict: ConflictResult;
  orphan?: boolean;
  ambiguous?: boolean;
  duplicate?: boolean;
  criticalCompatibility?: boolean;
}): ClassifiedIngestRecord {
  const reasons: IngestRejectReason[] = [
    ...input.validation.reasons,
    ...input.conflict.reasons,
    ...provenanceReasons(input.record.provenance, {
      criticalCompatibility: input.criticalCompatibility,
    }),
  ];

  if (input.duplicate) reasons.push("DUPLICATE");
  if (input.orphan) reasons.push("ORPHAN");
  if (input.ambiguous) reasons.push("AMBIGUOUS");

  const unique = [...new Set(reasons)];

  if (
    unique.includes("UNSUPPORTED_CATEGORY") ||
    unique.includes("POLICY_DISABLED") ||
    unique.includes("INVALID_RELATION") ||
    unique.includes("INVALID_RANGE") ||
    unique.includes("OUT_OF_SCOPE") ||
    unique.includes("VARIANT_EXPLOSION")
  ) {
    return { ...input.record, classification: "REJECT", reasons: unique };
  }

  if (!canAutoSafeSource(input.record.provenance.sourceType)) {
    // Never SAFE
    if (
      unique.includes("AI_INFERRED_NOT_SAFE") ||
      unique.includes("USER_DISCOVERED_NOT_SAFE") ||
      unique.includes("MARKETPLACE_INSUFFICIENT_AUTHORITY")
    ) {
      return { ...input.record, classification: "REVIEW", reasons: unique };
    }
  }

  if (
    unique.includes("DUPLICATE") ||
    unique.includes("ORPHAN") ||
    unique.includes("AMBIGUOUS") ||
    unique.includes("AMBIGUOUS_MODEL") ||
    unique.includes("SOURCE_CONFLICT") ||
    unique.includes("LOW_CONFIDENCE") ||
    unique.includes("MISSING_PROVENANCE") ||
    unique.includes("POSSIBLE_DUPLICATE") ||
    unique.includes("CATEGORY_SCOPE_UNCLEAR") ||
    unique.includes("MISSING_REQUIRED_SPEC") ||
    input.conflict.hasConflict
  ) {
    return { ...input.record, classification: "REVIEW", reasons: unique };
  }

  if (!input.validation.ok) {
    return { ...input.record, classification: "REJECT", reasons: unique };
  }

  return { ...input.record, classification: "SAFE", reasons: [] };
}
