/**
 * Publish-time understanding snapshot — nested under discoveryProjection.understanding.
 * Matching/filter code must ignore this block; it is audit + operations authority.
 */

export const UNDERSTANDING_SNAPSHOT_VERSION = 1 as const;
export const UNDERSTANDING_PROFILE_VERSION = "understand-request/v1" as const;

export type CategoryResolutionStatus =
  | "resolved"
  | "user_confirmed"
  | "ambiguous"
  | "unresolved"
  | "user_deferred";

/**
 * User clarification outcomes (UI contract for Phase 2+).
 * Not taxonomy categories — resolution state only.
 */
export type CategoryUserChoice =
  | "picked_candidate"
  | "multi_candidates"
  | "none_of_these"
  | "other_domain"
  | "defer_to_talepo"
  | null;

export type CategoryCandidateSnapshot = {
  slug: string;
  /** Normalized 0..1 confidence. */
  confidence: number;
  source: "ai" | "user" | "system";
};

export type UnderstandingFieldSnapshot = {
  value: string;
  confidence?: number;
};

export type RequestUnderstandingSnapshot = {
  version: typeof UNDERSTANDING_SNAPSHOT_VERSION;
  kind: "understanding_snapshot";
  profileVersion: typeof UNDERSTANDING_PROFILE_VERSION | string;
  builtAt: string;
  /** Pointer — actual text lives on Request.rawInput. */
  rawInputRef: "request.rawInput";
  categoryResolution: {
    status: CategoryResolutionStatus;
    /** True when the user explicitly locked/chose a category. */
    userSelected: boolean;
    userChoice: CategoryUserChoice;
    primary: CategoryCandidateSnapshot | null;
    candidates: CategoryCandidateSnapshot[];
  };
  entities: Record<string, UnderstandingFieldSnapshot>;
  attributes: Record<string, UnderstandingFieldSnapshot>;
  unresolvedExpressions: string[];
  confirmedFieldKeys: string[];
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

const SNAPSHOT_VALUE_MAX = 240;

function truncateSnapshotValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= SNAPSHOT_VALUE_MAX) return trimmed;
  return `${trimmed.slice(0, SNAPSHOT_VALUE_MAX)}…`;
}

function asFiniteConfidence(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return clamp01(value);
}

export function isRequestUnderstandingSnapshot(
  value: unknown,
): value is RequestUnderstandingSnapshot {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  if (obj.kind !== "understanding_snapshot") return false;
  if (obj.version !== UNDERSTANDING_SNAPSHOT_VERSION && obj.version !== 1) {
    return false;
  }
  if (!obj.categoryResolution || typeof obj.categoryResolution !== "object") {
    return false;
  }
  return true;
}

export function parseUnderstandingSnapshot(
  value: unknown,
): RequestUnderstandingSnapshot | null {
  return isRequestUnderstandingSnapshot(value) ? value : null;
}

export function buildUnderstandingSnapshot(input: {
  builtAt?: string;
  categoryResolution: RequestUnderstandingSnapshot["categoryResolution"];
  entities?: Record<string, UnderstandingFieldSnapshot>;
  attributes?: Record<string, UnderstandingFieldSnapshot>;
  unresolvedExpressions?: string[];
  confirmedFieldKeys?: string[];
  profileVersion?: string;
}): RequestUnderstandingSnapshot {
  const primary = input.categoryResolution.primary
    ? {
        ...input.categoryResolution.primary,
        confidence: clamp01(input.categoryResolution.primary.confidence),
      }
    : null;

  return {
    version: UNDERSTANDING_SNAPSHOT_VERSION,
    kind: "understanding_snapshot",
    profileVersion: input.profileVersion ?? UNDERSTANDING_PROFILE_VERSION,
    builtAt: input.builtAt ?? new Date().toISOString(),
    rawInputRef: "request.rawInput",
    categoryResolution: {
      status: input.categoryResolution.status,
      userSelected: Boolean(input.categoryResolution.userSelected),
      userChoice: input.categoryResolution.userChoice ?? null,
      primary,
      candidates: (input.categoryResolution.candidates ?? []).map((c) => ({
        slug: String(c.slug),
        confidence: clamp01(c.confidence),
        source: c.source,
      })),
    },
    entities: Object.fromEntries(
      Object.entries(input.entities ?? {}).map(([key, fact]) => [
        key,
        {
          value: truncateSnapshotValue(String(fact.value ?? "")),
          confidence:
            fact.confidence === undefined
              ? undefined
              : clamp01(fact.confidence),
        },
      ]),
    ),
    attributes: Object.fromEntries(
      Object.entries(input.attributes ?? {}).map(([key, fact]) => [
        key,
        {
          value: truncateSnapshotValue(String(fact.value ?? "")),
          confidence:
            fact.confidence === undefined
              ? undefined
              : clamp01(fact.confidence),
        },
      ]),
    ),
    unresolvedExpressions: (input.unresolvedExpressions ?? [])
      .map((s) => truncateSnapshotValue(String(s)))
      .filter(Boolean)
      .slice(0, 40),
    confirmedFieldKeys: (input.confirmedFieldKeys ?? [])
      .map((s) => String(s).trim())
      .filter(Boolean)
      .slice(0, 80),
  };
}

/**
 * Derive resolution status from publish-time signals (no invented confidence).
 */
export function deriveCategoryResolutionStatus(input: {
  userSelected: boolean;
  userChoice: CategoryUserChoice;
  primarySlug: string | null | undefined;
  primaryConfidence: number;
  candidateCount: number;
}): CategoryResolutionStatus {
  if (input.userChoice === "defer_to_talepo") return "user_deferred";
  if (
    input.userChoice === "none_of_these" ||
    input.userChoice === "other_domain"
  ) {
    return "unresolved";
  }
  if (input.userSelected || input.userChoice === "picked_candidate") {
    return "user_confirmed";
  }
  if (input.userChoice === "multi_candidates") return "ambiguous";

  const slug = input.primarySlug?.trim();
  if (!slug || slug === "unknown" || slug === "unresolved") {
    return "unresolved";
  }
  if (input.candidateCount > 1 && input.primaryConfidence < 0.7) {
    return "ambiguous";
  }
  if (input.primaryConfidence < 0.45) return "unresolved";
  if (input.primaryConfidence < 0.7) return "ambiguous";
  return "resolved";
}

export function normalizeCandidateConfidence(value: unknown): number {
  return asFiniteConfidence(value) ?? 0;
}
