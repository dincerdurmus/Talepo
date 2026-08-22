/**
 * Slice 2a — legacy fanout observability. MEASUREMENT ONLY.
 *
 * This module adds structured, PII-free events around the existing legacy
 * fanout so that zero-match rate, category skips, cap saturation, city-only
 * fallback and the silent backfill writer become measurable. It deliberately
 * changes nothing about matching: no scores, no company set, no query limits,
 * no notifications, no return values, no `RequestMatch` writes.
 *
 * Hard rules (docs/ai-handoff/09-NEXT-PHASE-RECOMMENDATION.md, 11 — Karar A/C/D):
 *
 * 1. FAIL-OPEN. Every emit is wrapped: if logging breaks, request distribution
 *    must still succeed. These functions never throw and never return a value
 *    the caller branches on. Location derivation is guarded too, via
 *    `safeResolveLocation` — no telemetry-only computation sits outside.
 * 2. NO FREE TEXT. `rawInput`, `title`, `description`, `professionalDescription`,
 *    `matchReason`, company names, contact details and raw city/district/address
 *    strings are never logged. Failure events carry a fixed stage enum and an
 *    error class name only — never a message, stack, query or user input.
 * 3. NO ACTOR IDENTITY. These events opt out of ambient correlation via
 *    `omitActorCorrelation`, so no `userId` (and no transport `requestId` or
 *    actor `companyId`) is inherited from the request scope. Only the Talepo
 *    `requestId` / target `companyId` we pass explicitly appear.
 * 4. LOCATION. Only the allowlisted `provinceCode` / `locationScope` /
 *    `resolutionStatus` contract from `@/lib/observability/province-allowlist`.
 *    District-level measurement is out of scope for this slice.
 * 5. PER-SPAN, NOT PER-COMPANY. Events are emitted once per fanout / backfill /
 *    estimate call. Nothing is emitted inside a per-company loop.
 *
 * Cap saturation is NOT a separate event. Each bounded scan reports `cap`,
 * `found` and `capSaturated` on its own scan event, so the saturation *rate*
 * has a denominator. A scan that never executed reports `scanStatus: "not_run"`
 * and carries NO `found` / `capSaturated` at all — a query that did not run is
 * never dressed up as a query that returned nothing.
 *
 * Span equations enforced by `verify-fanout-telemetry-v1`:
 *   fanout:   started = precondition_skipped + zero_match + completed + failed
 *   backfill: started = completed + failed
 *
 * Sink status: no external log sink is registered anywhere in this app
 * (`addLogSink` has no callers), so these events currently reach stdout only.
 * Until they are proven queryable in a central log system, Slice 2a stays
 * `PRODUCTION-SINK-NOT-VERIFIED` — see Karar D.
 */
import { createSubsystemLogger } from "@/lib/observability/logger";
import {
  normalizeLocationTelemetry,
  resolveProvinceTelemetry,
  type LocationTelemetry,
} from "@/lib/observability/province-allowlist";

export const FANOUT_TELEMETRY_SERVICE = "request.fanout";

/**
 * The canonical event contract. This object is the single source of truth: the
 * verifier asserts that every name here is emitted from a real call site in
 * `distribute-request.ts`, and that no other fanout event name exists.
 */
export const FANOUT_EVENTS = {
  started: "request.fanout.started",
  preconditionSkipped: "request.fanout.precondition_skipped",
  categorySkipped: "request.fanout.category_skipped",
  categoryScan: "request.fanout.category_scan",
  cityScan: "request.fanout.city_scan",
  cityOnlyFallback: "request.fanout.city_only_fallback",
  zeroMatch: "request.fanout.zero_match",
  notificationsWritten: "request.fanout.notifications_written",
  completed: "request.fanout.completed",
  failed: "request.fanout.failed",
  backfillStarted: "request.backfill.started",
  backfillCompleted: "request.backfill.completed",
  backfillFailed: "request.backfill.failed",
  estimated: "request.fanout.estimated",
} as const;

export type FanoutEventName =
  (typeof FANOUT_EVENTS)[keyof typeof FANOUT_EVENTS];

/** Query caps present in the legacy fanout, keyed by the scan they bound. */
export const FANOUT_CAPS = {
  category_scan: 200,
  city_scan: 300,
  city_only_fallback: 40,
  backfill_scan: 100,
  estimate_city_scan: 400,
} as const;

export type FanoutCapStage = keyof typeof FANOUT_CAPS;

/**
 * A bounded scan either executed — in which case it reports `found` and a
 * `capSaturated` verdict — or it never ran, in which case it reports neither.
 * There is no third state and no placeholder zero.
 */
export type ScanTelemetry =
  | { scanStatus: "executed"; cap: number; found: number; capSaturated: boolean }
  | { scanStatus: "not_run"; cap: number };

export function executedScan(
  stage: FanoutCapStage,
  found: number,
): ScanTelemetry {
  const cap = FANOUT_CAPS[stage];
  if (typeof found !== "number" || !Number.isFinite(found)) {
    // An unusable count cannot support a verdict; report the scan as not run
    // rather than inventing a zero.
    return { scanStatus: "not_run", cap };
  }
  return { scanStatus: "executed", cap, found, capSaturated: found >= cap };
}

export function notRunScan(stage: FanoutCapStage): ScanTelemetry {
  return { scanStatus: "not_run", cap: FANOUT_CAPS[stage] };
}

export type FanoutPreconditionReason =
  | "request_not_found_or_not_distributable";

export type BackfillOutcomeReason =
  | "company_not_found_or_not_distributable"
  | "company_has_no_category_and_no_city"
  | "no_backfill_rows"
  | "rows_written";

export type ZeroMatchReason =
  | "system_category_and_no_city_input"
  | "system_category_and_no_city_match"
  | "no_category_companies_and_no_city_input"
  | "no_category_companies_and_no_city_match";

/** The only reason string a failure event may carry. */
export const FAILURE_REASON = "unexpected_error" as const;

/**
 * Fixed allowlist of failure stages. A stage outside this list is coerced to
 * `unknown`, so a failure event can never carry an improvised string.
 */
export const FANOUT_FAILURE_STAGES = [
  "load_request",
  "load_creator_companies",
  "category_scan",
  "city_scan",
  "persist_matches",
  "load_members",
  "load_notified_users",
  "write_notifications",
  "unknown",
] as const;

export type FanoutFailureStage = (typeof FANOUT_FAILURE_STAGES)[number];

export const BACKFILL_FAILURE_STAGES = [
  "load_company",
  "load_members",
  "load_existing_matches",
  "scan_candidates",
  "write_matches",
  "unknown",
] as const;

export type BackfillFailureStage = (typeof BACKFILL_FAILURE_STAGES)[number];

export const ESTIMATE_FAILURE_STAGES = [
  "load_category",
  "load_exclusions",
  "count_category",
  "scan_city",
  "unknown",
] as const;

export type EstimateFailureStage = (typeof ESTIMATE_FAILURE_STAGES)[number];

function coerceStage<T extends string>(
  allowlist: readonly T[],
  value: unknown,
): T {
  return allowlist.includes(value as T) ? (value as T) : ("unknown" as T);
}

/**
 * Error *class* name only — never `error.message`, `error.stack`, a Prisma
 * query, or any user input. Matches the existing house pattern in
 * `create-request.ts`. Anything that is not a plain identifier is dropped.
 */
export function safeErrorName(error: unknown): string {
  const name = error instanceof Error ? error.name : "unknown";
  return /^[A-Za-z0-9_$]{1,64}$/.test(name) ? name : "unknown";
}

/**
 * Guarded location derivation. Keeps the fail-open promise whole: no
 * telemetry-only computation may throw into the fanout path, and a failure
 * degrades to `unspecified` / `unknown` without carrying the raw input
 * anywhere — not into this return value and not into another log.
 */
export function safeResolveLocation(
  rawCity: string | null | undefined,
): LocationTelemetry {
  try {
    return resolveProvinceTelemetry(rawCity);
  } catch {
    return { locationScope: "unspecified", resolutionStatus: "unknown" };
  }
}

/**
 * Keys that must never appear in fanout telemetry, even by accident. This is a
 * defence-in-depth net: the call sites already pass only enums and counts.
 */
export const FANOUT_FORBIDDEN_CONTEXT_KEYS = [
  "title",
  "description",
  "professionaldescription",
  "rawinput",
  "matchreason",
  "reasontext",
  "message",
  "errormessage",
  "stack",
  "errorstack",
  "query",
  "sql",
  "content",
  "name",
  "companyname",
  "username",
  "userid",
  "actorid",
  "sessionid",
  "city",
  "sehir",
  "district",
  "ilce",
  "mahalle",
  "neighborhood",
  "neighbourhood",
  "address",
  "adres",
  "email",
  "phone",
  "postalcode",
  "zip",
  "lat",
  "lng",
  "latitude",
  "longitude",
] as const;

/**
 * Structural string values only: identifiers, enum members, slugs and province
 * codes. Free text (spaces, Turkish diacritics, punctuation, long strings) is
 * rejected, so a raw city or title can never slip through this boundary.
 */
const SAFE_STRING = /^[A-Za-z0-9_.:-]{1,64}$/;

export type FanoutContextValue = string | number | boolean | null | undefined;

export type FanoutContext = Record<string, FanoutContextValue>;

function isForbiddenKey(key: string): boolean {
  const lowered = key.toLowerCase();
  return FANOUT_FORBIDDEN_CONTEXT_KEYS.some((k) => k === lowered);
}

/**
 * Drop anything that is not a structural, PII-free value. Dropped keys are
 * counted (not echoed) so a leak attempt is visible in the event itself without
 * the offending value ever being written.
 */
export function sanitizeFanoutContext(
  context: FanoutContext | undefined,
): Record<string, unknown> {
  if (!context) return {};

  const out: Record<string, unknown> = {};
  let dropped = 0;

  for (const [key, value] of Object.entries(context)) {
    if (value === undefined || value === null) continue;

    if (isForbiddenKey(key)) {
      dropped += 1;
      continue;
    }

    if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        dropped += 1;
        continue;
      }
      out[key] = value;
      continue;
    }

    if (typeof value === "boolean") {
      out[key] = value;
      continue;
    }

    if (typeof value === "string" && SAFE_STRING.test(value)) {
      out[key] = value;
      continue;
    }

    dropped += 1;
  }

  if (dropped > 0) out.droppedContextKeys = dropped;
  return out;
}

/**
 * Actor identity is switched off for this whole subsystem: no ambient `userId`,
 * actor `companyId` or transport `requestId` is inherited. Every other logger
 * consumer keeps its existing behaviour.
 */
const logger = createSubsystemLogger(FANOUT_TELEMETRY_SERVICE, {
  omitActorCorrelation: true,
});

type EmitInput = {
  event: FanoutEventName;
  level?: "info" | "warn";
  outcome?: "success" | "skipped" | "fallback" | "failure";
  requestId?: string;
  companyId?: string;
  durationMs?: number;
  context?: FanoutContext;
  scan?: ScanTelemetry;
  location?: LocationTelemetry;
};

/**
 * Ids travel outside `context`, so they get the same structural guard: anything
 * that is not an opaque identifier is dropped rather than logged.
 */
function safeId(value: string | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  return SAFE_STRING.test(value) ? value : undefined;
}

function safeDuration(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

/**
 * The single fail-open emit boundary. Wrapped so a broken sink, a serialization
 * error or an unexpected input can never surface inside request distribution.
 */
function emit(input: EmitInput): void {
  try {
    // Scan and location fields are merged BEFORE sanitizing, so every value in
    // `context` passes through exactly one guard. Nothing bypasses it.
    const raw: FanoutContext = { ...input.context };

    if (input.scan) {
      raw.scanStatus = input.scan.scanStatus;
      raw.cap = input.scan.cap;
      if (input.scan.scanStatus === "executed") {
        raw.found = input.scan.found;
        raw.capSaturated = input.scan.capSaturated;
      }
    }

    if (input.location) {
      const location = normalizeLocationTelemetry(input.location);
      raw.locationScope = location.locationScope;
      raw.resolutionStatus = location.resolutionStatus;
      raw.provinceCode = location.provinceCode;
    }

    const context = sanitizeFanoutContext(raw);

    const payload = {
      outcome: input.outcome,
      requestId: safeId(input.requestId),
      companyId: safeId(input.companyId),
      durationMs: safeDuration(input.durationMs),
      context,
    };

    if (input.level === "warn") {
      logger.warn(input.event, payload);
    } else {
      logger.info(input.event, payload);
    }
  } catch {
    // Fail-open by contract: telemetry must never break request distribution.
  }
}

/* -------------------------------------------------------------------------- */
/* Fanout span                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Opens the fanout span. Denominator for every fanout rate:
 * `started` = `precondition_skipped` + `zero_match` + `completed` + `failed`.
 */
export function logFanoutStarted(input: {
  requestId: string;
  reminderCopy: boolean;
  skipAlreadyNotifiedUsers: boolean;
  skipAlreadyRemindedUsers: boolean;
}): void {
  emit({
    event: FANOUT_EVENTS.started,
    requestId: input.requestId,
    context: {
      reminderCopy: input.reminderCopy,
      skipAlreadyNotifiedUsers: input.skipAlreadyNotifiedUsers,
      skipAlreadyRemindedUsers: input.skipAlreadyRemindedUsers,
    },
  });
}

/** Terminal: the request was not loadable / not in a distributable status. */
export function logFanoutPreconditionSkipped(input: {
  requestId: string;
  reason: FanoutPreconditionReason;
  durationMs: number;
}): void {
  emit({
    event: FANOUT_EVENTS.preconditionSkipped,
    outcome: "skipped",
    requestId: input.requestId,
    durationMs: input.durationMs,
    context: { reason: input.reason },
  });
}

/**
 * Terminal: an unexpected error aborted the fanout. The caller re-throws the
 * same error immediately after — this event records the failure, it does not
 * handle it.
 */
export function logFanoutFailed(input: {
  requestId: string;
  failureStage: FanoutFailureStage;
  errorName: string;
  durationMs: number;
}): void {
  emit({
    event: FANOUT_EVENTS.failed,
    outcome: "failure",
    requestId: input.requestId,
    durationMs: input.durationMs,
    context: {
      reason: FAILURE_REASON,
      failureStage: coerceStage(FANOUT_FAILURE_STAGES, input.failureStage),
      errorName: input.errorName,
    },
  });
}

/** Soft system category (`unresolved`) excluded from category fanout. */
export function logFanoutCategorySkipped(input: {
  requestId: string;
  categorySlug: string;
}): void {
  emit({
    event: FANOUT_EVENTS.categorySkipped,
    outcome: "skipped",
    requestId: input.requestId,
    context: { reason: "system_category", categorySlug: input.categorySlug },
  });
}

/** The category-linked scan executed. Emitted on every scan, not only on cap. */
export function logFanoutCategoryScan(input: {
  requestId: string;
  found: number;
  location: LocationTelemetry;
}): void {
  emit({
    event: FANOUT_EVENTS.categoryScan,
    requestId: input.requestId,
    scan: executedScan("category_scan", input.found),
    location: input.location,
  });
}

/** The city-linked scan executed. Emitted on every scan (see `categoryScan`). */
export function logFanoutCityScan(input: {
  requestId: string;
  found: number;
  categoryLinkedCount: number;
  location: LocationTelemetry;
}): void {
  emit({
    event: FANOUT_EVENTS.cityScan,
    requestId: input.requestId,
    context: { categoryLinkedCount: input.categoryLinkedCount },
    scan: executedScan("city_scan", input.found),
    location: input.location,
  });
}

/** How many companies the city-only fallback actually added, and where. */
export function logFanoutCityOnlyFallback(input: {
  requestId: string;
  scanned: number;
  added: number;
  categoryLinkedCount: number;
  location: LocationTelemetry;
}): void {
  emit({
    event: FANOUT_EVENTS.cityOnlyFallback,
    outcome: "fallback",
    requestId: input.requestId,
    context: {
      scanned: input.scanned,
      categoryLinkedCount: input.categoryLinkedCount,
    },
    scan: executedScan("city_only_fallback", input.added),
    location: input.location,
  });
}

/**
 * Terminal: the previously silent zero-match return, now with a reason.
 * Logged at `info` — a request with no supplier coverage is the normal
 * early-marketplace state this slice exists to measure, not an error. The
 * `outcome` and `reason` fields carry the signal; alerting keys on those, not
 * on the output stream.
 */
export function logFanoutZeroMatch(input: {
  requestId: string;
  reason: ZeroMatchReason;
  categorySkipped: boolean;
  categoryLinkedCount: number;
  cityCandidateCount: number;
  hasCityInput: boolean;
  durationMs: number;
  location: LocationTelemetry;
}): void {
  emit({
    event: FANOUT_EVENTS.zeroMatch,
    outcome: "skipped",
    requestId: input.requestId,
    durationMs: input.durationMs,
    context: {
      reason: input.reason,
      categorySkipped: input.categorySkipped,
      categoryLinkedCount: input.categoryLinkedCount,
      cityCandidateCount: input.cityCandidateCount,
      hasCityInput: input.hasCityInput,
    },
    location: input.location,
  });
}

/**
 * Notification write outcome for this fanout. Emitted once per fanout — never
 * per recipient — so volume stays proportional to requests.
 */
export function logFanoutNotificationsWritten(input: {
  requestId: string;
  matchedCompanyCount: number;
  memberCount: number;
  recipientCount: number;
  notificationCount: number;
  reminderCopy: boolean;
}): void {
  emit({
    event: FANOUT_EVENTS.notificationsWritten,
    outcome: "success",
    requestId: input.requestId,
    context: {
      matchedCompanyCount: input.matchedCompanyCount,
      memberCount: input.memberCount,
      recipientCount: input.recipientCount,
      notificationCount: input.notificationCount,
      dedupeFiltered: input.memberCount - input.recipientCount,
      reminderCopy: input.reminderCopy,
    },
  });
}

/** Terminal: fanout completed with at least one match. */
export function logFanoutCompleted(input: {
  requestId: string;
  matchedCompanyCount: number;
  notifiedUserCount: number;
  categoryLinkedCount: number;
  cityOnlyAdded: number;
  categorySkipped: boolean;
  hasCityInput: boolean;
  durationMs: number;
  location: LocationTelemetry;
}): void {
  emit({
    event: FANOUT_EVENTS.completed,
    outcome: "success",
    requestId: input.requestId,
    durationMs: input.durationMs,
    context: {
      matchedCompanyCount: input.matchedCompanyCount,
      notifiedUserCount: input.notifiedUserCount,
      categoryLinkedCount: input.categoryLinkedCount,
      cityOnlyAdded: input.cityOnlyAdded,
      categorySkipped: input.categorySkipped,
      hasCityInput: input.hasCityInput,
    },
    location: input.location,
  });
}

/* -------------------------------------------------------------------------- */
/* Backfill span — the second, previously invisible RequestMatch writer         */
/* -------------------------------------------------------------------------- */

/**
 * Opens the backfill span; denominator for backfill outcomes:
 * `started` = `completed` + `failed`.
 */
export function logBackfillStarted(input: { companyId: string }): void {
  emit({
    event: FANOUT_EVENTS.backfillStarted,
    companyId: input.companyId,
  });
}

/**
 * Terminal for every normal backfill exit path, including the skips. One event
 * name with an `outcome` + `reason` keeps the contract compact while still
 * partitioning `request.backfill.started`.
 */
export function logBackfillCompleted(input: {
  companyId: string;
  outcome: "success" | "skipped";
  reason: BackfillOutcomeReason;
  scan: ScanTelemetry;
  scoredRowCount: number;
  createdCount: number;
  durationMs: number;
  location?: LocationTelemetry;
}): void {
  emit({
    event: FANOUT_EVENTS.backfillCompleted,
    outcome: input.outcome,
    companyId: input.companyId,
    durationMs: input.durationMs,
    context: {
      reason: input.reason,
      scoredRowCount: input.scoredRowCount,
      createdCount: input.createdCount,
    },
    scan: input.scan,
    location: input.location,
  });
}

/** Terminal: an unexpected error aborted the backfill; the caller re-throws. */
export function logBackfillFailed(input: {
  companyId: string;
  failureStage: BackfillFailureStage;
  errorName: string;
  durationMs: number;
}): void {
  emit({
    event: FANOUT_EVENTS.backfillFailed,
    outcome: "failure",
    companyId: input.companyId,
    durationMs: input.durationMs,
    context: {
      reason: FAILURE_REASON,
      failureStage: coerceStage(BACKFILL_FAILURE_STAGES, input.failureStage),
      errorName: input.errorName,
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Estimator span                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The live supplier-count estimator behind the AI panel. `categorySlug` is only
 * emitted once the slug resolved to a real taxonomy row, so an unresolved
 * free-text slug is never logged.
 *
 * Failure does NOT get its own event: the same canonical event is emitted with
 * `outcome: "failure"` plus a safe reason and stage, and the caller re-throws.
 */
export function logFanoutEstimated(input: {
  outcome: "success" | "failure";
  categoryResolved: boolean;
  categorySlug?: string;
  byCategory: number;
  byCity: number;
  estimatedCompanyCount: number;
  scan: ScanTelemetry;
  durationMs: number;
  location: LocationTelemetry;
  failureStage?: EstimateFailureStage;
  errorName?: string;
}): void {
  const failed = input.outcome === "failure";
  emit({
    event: FANOUT_EVENTS.estimated,
    outcome: input.outcome,
    durationMs: input.durationMs,
    context: {
      reason: failed ? FAILURE_REASON : undefined,
      failureStage: failed
        ? coerceStage(ESTIMATE_FAILURE_STAGES, input.failureStage)
        : undefined,
      errorName: failed ? input.errorName : undefined,
      categoryResolved: input.categoryResolved,
      categorySlug: input.categoryResolved ? input.categorySlug : undefined,
      byCategory: failed ? undefined : input.byCategory,
      byCity: failed ? undefined : input.byCity,
      estimatedCompanyCount: failed ? undefined : input.estimatedCompanyCount,
    },
    scan: input.scan,
    location: input.location,
  });
}

/* -------------------------------------------------------------------------- */

/**
 * Deterministic reason for a zero-match fanout. Reaching zero always implies the
 * category leg produced nothing, so the reason distinguishes *why* the category
 * leg was empty and whether a city leg was even possible.
 */
export function deriveZeroMatchReason(input: {
  categorySkipped: boolean;
  hasCityInput: boolean;
}): ZeroMatchReason {
  if (input.categorySkipped) {
    return input.hasCityInput
      ? "system_category_and_no_city_match"
      : "system_category_and_no_city_input";
  }
  return input.hasCityInput
    ? "no_category_companies_and_no_city_match"
    : "no_category_companies_and_no_city_input";
}
