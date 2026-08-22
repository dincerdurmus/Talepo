/**
 * Phase 3 Slice 2a verifier — legacy fanout observability.
 *
 * Proves five things:
 *   1. The canonical 14-event contract is implemented exactly — no missing,
 *      extra or renamed event — and every name is reachable from a REAL call
 *      site, not just declared in a constants object.
 *   2. Failure terminals actually fire. The fanout, backfill and estimator
 *      exception paths are EXECUTED against a stubbed Prisma client, and the
 *      identical error object is asserted to be re-thrown.
 *   3. A scan that never ran is never dressed up as a scan that found nothing.
 *   4. No PII, no free text, no actor identity, and telemetry is fail-open.
 *   5. Fanout BEHAVIOUR is unchanged — the diff only adds telemetry.
 *
 * No real database is touched: a dummy connection string is set and every
 * Prisma model used by the exception tests is replaced with a stub.
 */
process.env.DATABASE_URL ??=
  "postgresql://verifier:verifier@127.0.0.1:5432/verifier";

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TURKEY_IL_NAMES } from "../src/lib/geo/turkey-districts";
import { runWithCorrelation } from "../src/lib/observability/correlation";
import {
  addLogSink,
  createSubsystemLogger,
  type OperationalLogEvent,
} from "../src/lib/observability/logger";
import {
  foldProvinceLabel,
  getProvinceAllowlistDrift,
  isProvinceCode,
  normalizeLocationTelemetry,
  PROVINCE_ALLOWLIST,
  PROVINCE_CODES,
  resolveProvinceTelemetry,
  type LocationTelemetry,
} from "../src/lib/observability/province-allowlist";
import {
  BACKFILL_FAILURE_STAGES,
  deriveZeroMatchReason,
  ESTIMATE_FAILURE_STAGES,
  executedScan,
  FAILURE_REASON,
  FANOUT_CAPS,
  FANOUT_EVENTS,
  FANOUT_FAILURE_STAGES,
  FANOUT_TELEMETRY_SERVICE,
  logBackfillCompleted,
  logBackfillFailed,
  logBackfillStarted,
  logFanoutCategoryScan,
  logFanoutCategorySkipped,
  logFanoutCityOnlyFallback,
  logFanoutCityScan,
  logFanoutCompleted,
  logFanoutEstimated,
  logFanoutFailed,
  logFanoutNotificationsWritten,
  logFanoutPreconditionSkipped,
  logFanoutStarted,
  logFanoutZeroMatch,
  notRunScan,
  safeErrorName,
  safeResolveLocation,
  sanitizeFanoutContext,
} from "../src/server/request/fanout-telemetry";

let passed = 0;
let failed = 0;

function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS  ${name}`);
    passed += 1;
  } catch (err) {
    failed += 1;
    console.error(`FAIL  ${name}`);
    console.error(err);
  }
}

async function checkAsync(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`PASS  ${name}`);
    passed += 1;
  } catch (err) {
    failed += 1;
    console.error(`FAIL  ${name}`);
    console.error(err);
  }
}

const ROOT = path.resolve(__dirname, "..");

/** Normalized to LF so the structural assertions below are OS-independent. */
function readSrc(relative: string): string {
  return fs.readFileSync(path.join(ROOT, relative), "utf8").replace(/\r\n/g, "\n");
}

const DISTRIBUTE_SRC = readSrc("src/server/request/distribute-request.ts");
const TELEMETRY_SRC = readSrc("src/server/request/fanout-telemetry.ts");
const ALLOWLIST_SRC = readSrc("src/lib/observability/province-allowlist.ts");

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

/** Whitespace-insensitive source matching, so re-indentation cannot fake a pass. */
function squash(src: string): string {
  return src.replace(/\s+/g, " ");
}

const DISTRIBUTE_SQUASHED = squash(DISTRIBUTE_SRC);

function includesSquashed(needle: string): boolean {
  return DISTRIBUTE_SQUASHED.includes(squash(needle));
}

function countSquashed(needle: string): number {
  const hay = DISTRIBUTE_SQUASHED;
  const pin = squash(needle);
  let n = 0;
  let i = 0;
  for (;;) {
    const at = hay.indexOf(pin, i);
    if (at < 0) return n;
    n += 1;
    i = at + pin.length;
  }
}

/* ========================================================================== */
/* 1. CANONICAL EVENT CONTRACT — 14 events                                    */
/* ========================================================================== */

const CANONICAL_EVENTS = [
  "request.fanout.started",
  "request.fanout.precondition_skipped",
  "request.fanout.category_skipped",
  "request.fanout.category_scan",
  "request.fanout.city_scan",
  "request.fanout.city_only_fallback",
  "request.fanout.zero_match",
  "request.fanout.notifications_written",
  "request.fanout.completed",
  "request.fanout.failed",
  "request.backfill.started",
  "request.backfill.completed",
  "request.backfill.failed",
  "request.fanout.estimated",
] as const;

check("the canonical set is exactly 14 events", () => {
  assert.equal(CANONICAL_EVENTS.length, 14);
  assert.equal(new Set(CANONICAL_EVENTS).size, 14);
});

check("declared events match the canonical contract exactly", () => {
  const declared = [...Object.values(FANOUT_EVENTS)].sort();
  const canonical = [...CANONICAL_EVENTS].sort();
  assert.deepEqual(
    canonical.filter((e) => !declared.includes(e)),
    [],
    "canonical events not declared",
  );
  assert.deepEqual(
    declared.filter((e) => !(canonical as readonly string[]).includes(e)),
    [],
    "events declared outside the contract",
  );
  assert.equal(declared.length, 14);
});

check("no legacy or ad-hoc event name survives anywhere", () => {
  for (const retired of [
    "request.fanout.request_skipped",
    "request.fanout.cap_saturated",
    "request.fanout.backfill_completed",
    "request.fanout.backfill_skipped",
    "request.fanout.estimate_failed",
    "request.backfill.skipped",
  ]) {
    assert.ok(!TELEMETRY_SRC.includes(retired), `retired name present: ${retired}`);
    assert.ok(!DISTRIBUTE_SRC.includes(retired), `retired name present: ${retired}`);
  }
  const literals = [...TELEMETRY_SRC.matchAll(/"(request\.[a-z_]+\.[a-z_]+)"/g)].map(
    (m) => m[1],
  );
  assert.ok(literals.length >= 14, "event literals not found in the source");
  for (const literal of literals) {
    assert.ok(
      (CANONICAL_EVENTS as readonly string[]).includes(literal),
      `event literal outside the contract: ${literal}`,
    );
  }
});

/* ---- Bind every emitter to the event it actually produces ---------------- */

const captured: OperationalLogEvent[] = [];
const detachCapture = addLogSink((entry) => captured.push(entry));

const SAMPLE_LOCATION: LocationTelemetry = resolveProvinceTelemetry("İstanbul");

const EMITTERS: Record<string, () => void> = {
  logFanoutStarted: () =>
    logFanoutStarted({
      requestId: "req_1",
      reminderCopy: false,
      skipAlreadyNotifiedUsers: false,
      skipAlreadyRemindedUsers: false,
    }),
  logFanoutPreconditionSkipped: () =>
    logFanoutPreconditionSkipped({
      requestId: "req_1",
      reason: "request_not_found_or_not_distributable",
      durationMs: 3,
    }),
  logFanoutFailed: () =>
    logFanoutFailed({
      requestId: "req_1",
      failureStage: "category_scan",
      errorName: "PrismaClientKnownRequestError",
      durationMs: 5,
    }),
  logFanoutCategorySkipped: () =>
    logFanoutCategorySkipped({ requestId: "req_1", categorySlug: "unresolved" }),
  logFanoutCategoryScan: () =>
    logFanoutCategoryScan({
      requestId: "req_1",
      found: 200,
      location: SAMPLE_LOCATION,
    }),
  logFanoutCityScan: () =>
    logFanoutCityScan({
      requestId: "req_1",
      found: 12,
      categoryLinkedCount: 4,
      location: SAMPLE_LOCATION,
    }),
  logFanoutCityOnlyFallback: () =>
    logFanoutCityOnlyFallback({
      requestId: "req_1",
      scanned: 300,
      added: 40,
      categoryLinkedCount: 0,
      location: SAMPLE_LOCATION,
    }),
  logFanoutZeroMatch: () =>
    logFanoutZeroMatch({
      requestId: "req_1",
      reason: "no_category_companies_and_no_city_match",
      categorySkipped: false,
      categoryLinkedCount: 0,
      cityCandidateCount: 12,
      hasCityInput: true,
      durationMs: 9,
      location: SAMPLE_LOCATION,
    }),
  logFanoutNotificationsWritten: () =>
    logFanoutNotificationsWritten({
      requestId: "req_1",
      matchedCompanyCount: 7,
      memberCount: 11,
      recipientCount: 9,
      notificationCount: 9,
      reminderCopy: false,
    }),
  logFanoutCompleted: () =>
    logFanoutCompleted({
      requestId: "req_1",
      matchedCompanyCount: 7,
      notifiedUserCount: 9,
      categoryLinkedCount: 6,
      cityOnlyAdded: 1,
      categorySkipped: false,
      hasCityInput: true,
      durationMs: 42,
      location: SAMPLE_LOCATION,
    }),
  logBackfillStarted: () => logBackfillStarted({ companyId: "co_1" }),
  logBackfillCompleted: () =>
    logBackfillCompleted({
      companyId: "co_1",
      outcome: "success",
      reason: "rows_written",
      scan: executedScan("backfill_scan", 100),
      scoredRowCount: 20,
      createdCount: 5,
      durationMs: 11,
      location: SAMPLE_LOCATION,
    }),
  logBackfillFailed: () =>
    logBackfillFailed({
      companyId: "co_1",
      failureStage: "scan_candidates",
      errorName: "Error",
      durationMs: 4,
    }),
  logFanoutEstimated: () =>
    logFanoutEstimated({
      outcome: "success",
      categoryResolved: true,
      categorySlug: "klima-servisi",
      byCategory: 12,
      byCity: 3,
      estimatedCompanyCount: 15,
      scan: executedScan("estimate_city_scan", 400),
      durationMs: 7,
      location: SAMPLE_LOCATION,
    }),
};

const eventByEmitter = new Map<string, string>();
const sampleByEvent = new Map<string, OperationalLogEvent>();

for (const [name, run] of Object.entries(EMITTERS)) {
  captured.length = 0;
  run();
  if (captured.length === 1) {
    eventByEmitter.set(name, captured[0].event);
    sampleByEvent.set(captured[0].event, captured[0]);
  }
}

function calledEmitters(src: string): string[] {
  const body = stripComments(src);
  const names = new Set<string>();
  for (const m of body.matchAll(/\b(log[A-Z][A-Za-z0-9]*)\s*\(/g)) names.add(m[1]);
  return [...names].sort();
}

check("every emitter produces exactly one event", () => {
  assert.equal(eventByEmitter.size, Object.keys(EMITTERS).length);
});

check("emitters cover the canonical contract one-to-one", () => {
  const produced = [...eventByEmitter.values()].sort();
  assert.deepEqual(produced, [...CANONICAL_EVENTS].sort());
  assert.equal(new Set(produced).size, 14, "two emitters share an event name");
});

check("the verifier is not blind to any call site in distribute-request", () => {
  const called = calledEmitters(DISTRIBUTE_SRC);
  assert.ok(called.length > 0, "no telemetry call sites found at all");
  assert.deepEqual(
    called.filter((n) => !(n in EMITTERS)),
    [],
    "call sites exist that this verifier never exercises",
  );
});

check("every canonical event is reachable from a real call site", () => {
  const reachable = new Set(
    calledEmitters(DISTRIBUTE_SRC)
      .map((n) => eventByEmitter.get(n))
      .filter(Boolean) as string[],
  );
  assert.deepEqual(
    CANONICAL_EVENTS.filter((e) => !reachable.has(e)),
    [],
    "declared but never emitted from production code",
  );
});

check("no emitter is dead code", () => {
  const called = new Set(calledEmitters(DISTRIBUTE_SRC));
  assert.deepEqual(
    Object.keys(EMITTERS).filter((n) => !called.has(n)),
    [],
    "emitter exists but is never called",
  );
});

check("each span is opened once and its terminals partition it", () => {
  const body = stripComments(DISTRIBUTE_SRC);
  const count = (name: string) =>
    (body.match(new RegExp(`\\b${name}\\s*\\(`, "g")) ?? []).length;

  // started = precondition_skipped + zero_match + completed + failed
  assert.equal(count("logFanoutStarted"), 1);
  assert.equal(count("logFanoutPreconditionSkipped"), 1);
  assert.equal(count("logFanoutZeroMatch"), 1);
  assert.equal(count("logFanoutCompleted"), 1);
  assert.equal(count("logFanoutFailed"), 1);

  // backfill: started = completed + failed
  assert.equal(count("logBackfillStarted"), 1);
  assert.equal(count("logBackfillCompleted"), 4);
  assert.equal(count("logBackfillFailed"), 1);

  // estimator terminals: unresolved category, normal, failure
  assert.equal(count("logFanoutEstimated"), 3);

  assert.equal(count("logFanoutCategoryScan"), 1);
  assert.equal(count("logFanoutCityScan"), 1);
  assert.equal(count("logFanoutCityOnlyFallback"), 1);
  assert.equal(count("logFanoutCategorySkipped"), 1);
  assert.equal(count("logFanoutNotificationsWritten"), 1);
});

check("every function that opens a span also has a catch that closes it", () => {
  for (const [fn, failer] of [
    ["distributeRequestToCompanies", "logFanoutFailed"],
    ["backfillMatchesForCompany", "logBackfillFailed"],
    ["countMatchingCompanies", "logFanoutEstimated"],
  ] as const) {
    const at = DISTRIBUTE_SRC.indexOf(`export async function ${fn}`);
    assert.ok(at > 0, `${fn} not found`);
    const next = DISTRIBUTE_SRC.indexOf("\nexport async function ", at + 1);
    const body = DISTRIBUTE_SRC.slice(at, next < 0 ? undefined : next);
    assert.ok(/\n\s*} catch \(error\) \{/.test(body), `${fn} has no catch`);
    assert.ok(body.includes(failer), `${fn} catch does not emit ${failer}`);
    assert.ok(/\n\s*throw error;/.test(body), `${fn} does not re-throw`);
  }
});

/* ========================================================================== */
/* 2. SCAN STATUS MODEL                                                        */
/* ========================================================================== */

check("an executed scan reports cap, found and a verdict", () => {
  assert.deepEqual(executedScan("category_scan", 200), {
    scanStatus: "executed",
    cap: 200,
    found: 200,
    capSaturated: true,
  });
  assert.deepEqual(executedScan("category_scan", 0), {
    scanStatus: "executed",
    cap: 200,
    found: 0,
    capSaturated: false,
  });
  assert.equal(executedScan("city_scan", 300).scanStatus, "executed");
  assert.equal(executedScan("city_only_fallback", 40).scanStatus, "executed");
});

check("a scan that never ran reports neither found nor a verdict", () => {
  const scan = notRunScan("backfill_scan");
  assert.equal(scan.scanStatus, "not_run");
  assert.equal(scan.cap, 100);
  assert.ok(!("found" in scan));
  assert.ok(!("capSaturated" in scan));
});

check("an unusable count degrades to not_run, never to a fake zero", () => {
  for (const bad of [Number.NaN, "Moda Mahallesi", undefined, null]) {
    const scan = executedScan("backfill_scan", bad as never);
    assert.equal(scan.scanStatus, "not_run", String(bad));
    assert.ok(!("found" in scan));
    assert.ok(!("capSaturated" in scan));
  }
});

check("emitted not_run and executed-zero events are distinguishable", () => {
  captured.length = 0;
  logBackfillCompleted({
    companyId: "co_notrun",
    outcome: "skipped",
    reason: "company_not_found_or_not_distributable",
    scan: notRunScan("backfill_scan"),
    scoredRowCount: 0,
    createdCount: 0,
    durationMs: 1,
  });
  logBackfillCompleted({
    companyId: "co_zero",
    outcome: "skipped",
    reason: "no_backfill_rows",
    scan: executedScan("backfill_scan", 0),
    scoredRowCount: 0,
    createdCount: 0,
    durationMs: 1,
  });
  const [notRun, zero] = captured.map((e) => e.context as Record<string, unknown>);
  assert.equal(notRun.scanStatus, "not_run");
  assert.ok(!("found" in notRun), "not_run carried a found value");
  assert.ok(!("capSaturated" in notRun), "not_run carried a verdict");
  assert.equal(zero.scanStatus, "executed");
  assert.equal(zero.found, 0);
  assert.equal(zero.capSaturated, false);
  assert.notDeepEqual(notRun, zero);
});

check("scan-shaped events carry the scan contract", () => {
  for (const event of [
    "request.fanout.category_scan",
    "request.fanout.city_scan",
    "request.fanout.city_only_fallback",
    "request.backfill.completed",
    "request.fanout.estimated",
  ]) {
    const ctx = sampleByEvent.get(event)?.context as Record<string, unknown>;
    assert.ok(ctx, `no sample captured for ${event}`);
    assert.equal(ctx.scanStatus, "executed", `${event}.scanStatus`);
    assert.equal(typeof ctx.cap, "number", `${event}.cap`);
    assert.equal(typeof ctx.found, "number", `${event}.found`);
    assert.equal(typeof ctx.capSaturated, "boolean", `${event}.capSaturated`);
  }
});

/* ========================================================================== */
/* 3. DURATION, LEVEL, ACTOR IDENTITY                                          */
/* ========================================================================== */

check("durationMs is the standard top-level field, never inside context", () => {
  const withDuration = [
    "request.fanout.precondition_skipped",
    "request.fanout.failed",
    "request.fanout.zero_match",
    "request.fanout.completed",
    "request.backfill.completed",
    "request.backfill.failed",
    "request.fanout.estimated",
  ];
  for (const event of withDuration) {
    const entry = sampleByEvent.get(event);
    assert.ok(entry, `no sample for ${event}`);
    assert.equal(typeof entry.durationMs, "number", `${event} top-level durationMs`);
  }
  for (const entry of sampleByEvent.values()) {
    assert.ok(
      !("durationMs" in (entry.context ?? {})),
      `${entry.event} still nests durationMs in context`,
    );
  }
});

check("zero_match is info level, distinguished by outcome and reason", () => {
  const entry = sampleByEvent.get("request.fanout.zero_match");
  assert.equal(entry?.level, "info");
  assert.equal(entry?.outcome, "skipped");
  assert.equal(
    (entry?.context as Record<string, unknown>).reason,
    "no_category_companies_and_no_city_match",
  );
});

check("no fanout event is emitted at warn or error level", () => {
  for (const entry of sampleByEvent.values()) {
    assert.equal(entry.level, "info", `${entry.event} is ${entry.level}`);
  }
});

check("fanout events never inherit actor identity from correlation", () => {
  captured.length = 0;
  runWithCorrelation(
    {
      correlationId: "corr-1",
      requestId: "http-request-1",
      userId: "user-should-not-appear",
      companyId: "company-should-not-appear",
    },
    () => {
      for (const run of Object.values(EMITTERS)) run();
    },
  );
  assert.equal(captured.length, 14);
  const blob = JSON.stringify(captured);
  assert.ok(!blob.includes("user-should-not-appear"), "userId leaked");
  assert.ok(!blob.includes("company-should-not-appear"), "actor companyId leaked");
  assert.ok(!blob.includes("http-request-1"), "transport requestId leaked");
  for (const entry of captured) {
    assert.equal(entry.userId, undefined, `${entry.event} carries userId`);
    // Only ids we pass explicitly may appear.
    assert.ok(
      entry.requestId === undefined || entry.requestId === "req_1",
      `${entry.event} requestId=${entry.requestId}`,
    );
    assert.ok(
      entry.companyId === undefined || entry.companyId === "co_1",
      `${entry.event} companyId=${entry.companyId}`,
    );
    // The opaque trace id is still useful and is NOT actor identity.
    assert.equal(entry.correlationId, "corr-1");
  }
});

check("other logger consumers keep their default correlation behaviour", () => {
  captured.length = 0;
  const defaultLogger = createSubsystemLogger("verifier.default");
  runWithCorrelation(
    {
      correlationId: "corr-2",
      requestId: "http-request-2",
      userId: "user-2",
      companyId: "company-2",
    },
    () => {
      defaultLogger.info("verifier.default.event", { outcome: "success" });
    },
  );
  assert.equal(captured.length, 1);
  const entry = captured[0];
  assert.equal(entry.userId, "user-2", "default logger lost its userId");
  assert.equal(entry.companyId, "company-2");
  assert.equal(entry.requestId, "http-request-2");
  assert.equal(entry.correlationId, "corr-2");
});

/* ========================================================================== */
/* 4. FAILURE PAYLOAD SAFETY                                                   */
/* ========================================================================== */

check("failure events carry only a fixed reason, stage and error class name", () => {
  for (const event of [
    "request.fanout.failed",
    "request.backfill.failed",
  ]) {
    const ctx = sampleByEvent.get(event)?.context as Record<string, unknown>;
    assert.equal(ctx.reason, FAILURE_REASON);
    assert.equal(ctx.reason, "unexpected_error");
    assert.equal(typeof ctx.failureStage, "string");
    assert.equal(typeof ctx.errorName, "string");
  }
});

check("an out-of-allowlist failure stage is coerced to unknown", () => {
  captured.length = 0;
  logFanoutFailed({
    requestId: "req_1",
    failureStage: "DROP TABLE users" as never,
    errorName: "Error",
    durationMs: 1,
  });
  logBackfillFailed({
    companyId: "co_1",
    failureStage: "İstanbul Kadıköy" as never,
    errorName: "Error",
    durationMs: 1,
  });
  for (const entry of captured) {
    assert.equal((entry.context as Record<string, unknown>).failureStage, "unknown");
  }
  assert.ok(!JSON.stringify(captured).includes("DROP TABLE"));
  assert.ok(!JSON.stringify(captured).includes("Kadıköy"));
});

check("safeErrorName never returns a message, stack or free text", () => {
  const poisoned = new Error("SELECT * FROM users WHERE city='Kadıköy'");
  assert.equal(safeErrorName(poisoned), "Error");
  const named = new Error("boom");
  named.name = "PrismaClientKnownRequestError";
  assert.equal(safeErrorName(named), "PrismaClientKnownRequestError");
  const weird = new Error("boom");
  weird.name = "Hata: İstanbul Kadıköy";
  assert.equal(safeErrorName(weird), "unknown");
  assert.equal(safeErrorName("a string"), "unknown");
  assert.equal(safeErrorName(undefined), "unknown");
});

check("failure stage allowlists are closed and contain unknown", () => {
  for (const list of [
    FANOUT_FAILURE_STAGES,
    BACKFILL_FAILURE_STAGES,
    ESTIMATE_FAILURE_STAGES,
  ]) {
    assert.ok(list.includes("unknown" as never));
    for (const stage of list) {
      assert.ok(/^[a-z_]{1,40}$/.test(stage), `bad stage slug: ${stage}`);
    }
  }
});

/* ========================================================================== */
/* 5. FAIL-OPEN, INCLUDING LOCATION DERIVATION                                 */
/* ========================================================================== */

check("safeResolveLocation swallows a throwing input and leaks nothing", () => {
  const hostile = {
    trim() {
      throw new Error("İstanbul Kadıköy 05551112233");
    },
  };
  const out = safeResolveLocation(hostile as never);
  assert.deepEqual(out, {
    locationScope: "unspecified",
    resolutionStatus: "unknown",
  });
  assert.ok(!JSON.stringify(out).includes("Kadıköy"));
});

check("a throwing location derivation cannot break an emit", () => {
  const hostile = {
    trim() {
      throw new Error("boom");
    },
  };
  assert.doesNotThrow(() => {
    logFanoutCompleted({
      requestId: "req_1",
      matchedCompanyCount: 1,
      notifiedUserCount: 1,
      categoryLinkedCount: 1,
      cityOnlyAdded: 0,
      categorySkipped: false,
      hasCityInput: true,
      durationMs: 1,
      location: safeResolveLocation(hostile as never),
    });
  });
});

check("telemetry is fail-open when a sink throws", () => {
  const detachBad = addLogSink(() => {
    throw new Error("sink exploded");
  });
  try {
    for (const run of Object.values(EMITTERS)) assert.doesNotThrow(run);
  } finally {
    detachBad();
  }
});

check("emitters return nothing a caller could branch on", () => {
  for (const [name, run] of Object.entries(EMITTERS)) {
    assert.equal(run(), undefined, name);
  }
});

/* ========================================================================== */
/* 6. PROVINCE AUTHORITY                                                       */
/* ========================================================================== */

check("province names are not re-declared — geography is the sole authority", () => {
  const code = stripComments(ALLOWLIST_SRC);
  assert.ok(code.includes('from "@/lib/geo/turkey-districts"'));
  for (const label of TURKEY_IL_NAMES) {
    assert.ok(!code.includes(`"${label}"`), `province name hard-coded: ${label}`);
  }
});

check("allowlist labels are the geography registry's own strings", () => {
  const geo = new Set(TURKEY_IL_NAMES);
  for (const code of PROVINCE_CODES) {
    assert.ok(geo.has(PROVINCE_ALLOWLIST[code]), PROVINCE_ALLOWLIST[code]);
  }
});

check("there is zero drift between geography and the ISO code table", () => {
  const drift = getProvinceAllowlistDrift();
  assert.deepEqual(drift.geoNamesWithoutCode, []);
  assert.deepEqual(drift.isoCodesWithoutGeoName, []);
});

check("the derived allowlist covers all 81 provinces with valid codes", () => {
  assert.equal(PROVINCE_CODES.length, 81);
  assert.equal(new Set(PROVINCE_CODES).size, 81);
  for (const code of PROVINCE_CODES) {
    assert.ok(/^TR-(0[1-9]|[1-7][0-9]|8[01])$/.test(code), code);
  }
});

check("ASCII folding can never make two provinces ambiguous", () => {
  assert.equal(new Set(TURKEY_IL_NAMES.map(foldProvinceLabel)).size, 81);
  assert.equal(
    new Set(TURKEY_IL_NAMES.map((n) => n.toLocaleLowerCase("tr-TR"))).size,
    81,
  );
});

check("isProvinceCode rejects non-members", () => {
  assert.ok(isProvinceCode("TR-34"));
  for (const bad of ["TR-99", "tr-34", "İstanbul", "", undefined, 34]) {
    assert.ok(!isProvinceCode(bad), String(bad));
  }
});

check("every canonical province name resolves to a distinct code", () => {
  const seen = new Set<string>();
  for (const label of TURKEY_IL_NAMES) {
    const out = resolveProvinceTelemetry(label);
    assert.equal(out.resolutionStatus, "resolved", label);
    assert.ok(isProvinceCode(out.provinceCode), label);
    assert.ok(!seen.has(out.provinceCode as string), `duplicate for ${label}`);
    seen.add(out.provinceCode as string);
  }
  assert.equal(seen.size, 81);
});

check("plain-keyboard and mixed-case spellings resolve", () => {
  for (const v of ["İstanbul", "istanbul", "Istanbul", "ISTANBUL", " istanbul "]) {
    assert.equal(resolveProvinceTelemetry(v).provinceCode, "TR-34", v);
  }
  assert.equal(resolveProvinceTelemetry("Kutahya").provinceCode, "TR-43");
  assert.equal(resolveProvinceTelemetry("Sanliurfa").provinceCode, "TR-63");
  assert.equal(resolveProvinceTelemetry("Mersin").provinceCode, "TR-33");
});

check("no district name can be mistaken for a province", () => {
  // If any district shared a province's name, a district-only `city` value
  // could be encoded as a confidently wrong province.
  const geoSrc = readSrc("src/lib/geo/turkey-districts.ts");
  const provinces = new Set(TURKEY_IL_NAMES);
  let districts = 0;
  let collisions = 0;
  for (const block of geoSrc.split(/"il":\s*"/).slice(1)) {
    const section = block.slice(block.indexOf("["), block.indexOf("]"));
    for (const m of section.matchAll(/"([^"]+)"/g)) {
      districts += 1;
      if (provinces.has(m[1])) collisions += 1;
    }
  }
  assert.ok(districts > 900, `district scan looks wrong (${districts})`);
  assert.equal(collisions, 0, "a district name equals a province name");
});

check("district half is discarded and never returned", () => {
  const out = resolveProvinceTelemetry("İstanbul / Kadıköy");
  assert.equal(out.provinceCode, "TR-34");
  assert.ok(!JSON.stringify(out).includes("Kadıköy"));
});

check("empty / missing location yields unspecified + unknown, no code", () => {
  for (const v of [null, undefined, "", "   ", "/", " / "]) {
    const out = resolveProvinceTelemetry(v);
    assert.equal(out.locationScope, "unspecified", String(v));
    assert.equal(out.resolutionStatus, "unknown");
    assert.equal(out.provinceCode, undefined);
  }
});

check("unresolvable free text is never guessed into a province code", () => {
  for (const v of [
    "Merkez Mah. Atatürk Cad. No:5",
    "İstanbul Anadolu Yakası",
    "Türkiye geneli",
    "Kadıköy",
    "TR-34",
  ]) {
    const out = resolveProvinceTelemetry(v);
    assert.equal(out.resolutionStatus, "unknown", v);
    assert.equal(out.provinceCode, undefined, v);
  }
});

check("resolver output never echoes any part of its input", () => {
  for (const v of [
    "Merkez Mah. Atatürk Cad. No:5 Daire 3",
    "İstanbul / Kadıköy / Moda",
    "0555 111 22 33",
    "ali@example.com",
  ]) {
    const s = JSON.stringify(resolveProvinceTelemetry(v));
    for (const t of v.split(/[\s/.,:@]+/).filter((x) => x.length >= 3)) {
      assert.ok(!s.includes(t), `leaked "${t}"`);
    }
  }
});

check("province code cannot ride along on a non-province scope", () => {
  for (const scope of ["nationwide", "remote", "unspecified"] as const) {
    const out = normalizeLocationTelemetry({
      locationScope: scope,
      resolutionStatus: "resolved",
      provinceCode: "TR-34",
    });
    assert.equal(out.provinceCode, undefined, scope);
    assert.equal(out.resolutionStatus, "unknown", scope);
  }
  const bogus = normalizeLocationTelemetry({
    locationScope: "province",
    resolutionStatus: "resolved",
    provinceCode: "TR-99" as never,
  });
  assert.equal(bogus.provinceCode, undefined);
  assert.equal(bogus.resolutionStatus, "unknown");
});

/* ========================================================================== */
/* 7. CONTEXT SANITIZER                                                        */
/* ========================================================================== */

check("forbidden context keys are dropped and counted", () => {
  const out = sanitizeFanoutContext({
    city: "İstanbul",
    district: "Kadıköy",
    mahalle: "Moda",
    address: "Atatürk Cad. 5",
    title: "Klima montaji",
    matchReason: "Kategori",
    name: "ACME",
    email: "a@b.com",
    phone: "05551112233",
    userId: "u-1",
    stack: "at foo",
    errorMessage: "boom",
    reason: "system_category",
    cap: 200,
  } as never);
  for (const key of [
    "city", "district", "mahalle", "address", "title", "matchReason",
    "name", "email", "phone", "userId", "stack", "errorMessage",
  ]) {
    assert.ok(!(key in out), `forbidden key survived: ${key}`);
  }
  assert.equal(out.reason, "system_category");
  assert.equal(out.cap, 200);
  assert.equal(out.droppedContextKeys, 12);
});

check("free-text string values are dropped even under a safe key", () => {
  const out = sanitizeFanoutContext({
    stage: "Klima montajı için usta lazım",
    other: "Kadıköy",
    tooLong: "a".repeat(65),
    ok: "category_scan",
    code: "TR-34",
  } as never);
  assert.equal(out.stage, undefined);
  assert.equal(out.other, undefined);
  assert.equal(out.tooLong, undefined);
  assert.equal(out.ok, "category_scan");
  assert.equal(out.code, "TR-34");
});

check("all emitted events run under the fanout service", () => {
  assert.equal(sampleByEvent.size, 14);
  for (const entry of sampleByEvent.values()) {
    assert.equal(entry.service, FANOUT_TELEMETRY_SERVICE);
  }
});

check("no emitted event carries a district-shaped key", () => {
  const banned = /(district|ilce|ilçe|mahalle|neighbou?rhood|address|adres)/i;
  for (const entry of sampleByEvent.values()) {
    for (const key of Object.keys(entry.context ?? {})) {
      assert.ok(!banned.test(key), `district-shaped key: ${key}`);
    }
  }
});

check("poisoned input cannot reach the log through any emitter", () => {
  captured.length = 0;
  const poisoned = resolveProvinceTelemetry("İstanbul / Kadıköy");
  logFanoutCategorySkipped({
    requestId: "req_1",
    categorySlug: "Klima montajı" as never,
  });
  logFanoutZeroMatch({
    requestId: "req_1",
    reason: "Şehir (İstanbul)" as never,
    categorySkipped: false,
    categoryLinkedCount: 0,
    cityCandidateCount: 0,
    hasCityInput: "Kadıköy" as never,
    durationMs: 0,
    location: poisoned,
  });
  logBackfillCompleted({
    companyId: "ACME Soğutma" as never,
    outcome: "success",
    reason: "rows_written",
    scan: executedScan("backfill_scan", "Moda Mahallesi" as never),
    scoredRowCount: 0,
    createdCount: 0,
    durationMs: 0,
    location: poisoned,
  });
  const blob = JSON.stringify(captured);
  for (const needle of [
    "Klima montajı", "Kadıköy", "Moda Mahallesi", "ACME Soğutma",
    "Şehir (İstanbul)", "İstanbul",
  ]) {
    assert.ok(!blob.includes(needle), `leaked: ${needle}`);
  }
  assert.ok(blob.includes("TR-34"));
});

check("an unresolved category slug is never logged", () => {
  captured.length = 0;
  logFanoutEstimated({
    outcome: "success",
    categoryResolved: false,
    categorySlug: "made-up-slug",
    byCategory: 0,
    byCity: 0,
    estimatedCompanyCount: 0,
    scan: notRunScan("estimate_city_scan"),
    durationMs: 0,
    location: SAMPLE_LOCATION,
  });
  assert.ok(!JSON.stringify(captured).includes("made-up-slug"));
  assert.equal(
    (captured[0].context as Record<string, unknown>).categoryResolved,
    false,
  );
});

check("zero-match reason is deterministic across all four cases", () => {
  assert.equal(
    deriveZeroMatchReason({ categorySkipped: true, hasCityInput: false }),
    "system_category_and_no_city_input",
  );
  assert.equal(
    deriveZeroMatchReason({ categorySkipped: true, hasCityInput: true }),
    "system_category_and_no_city_match",
  );
  assert.equal(
    deriveZeroMatchReason({ categorySkipped: false, hasCityInput: false }),
    "no_category_companies_and_no_city_input",
  );
  assert.equal(
    deriveZeroMatchReason({ categorySkipped: false, hasCityInput: true }),
    "no_category_companies_and_no_city_match",
  );
});

/* ========================================================================== */
/* 8. BEHAVIOUR UNCHANGED (whitespace-insensitive)                             */
/* ========================================================================== */

check("declared caps still match the caps in the source", () => {
  assert.equal(FANOUT_CAPS.category_scan, 200);
  assert.equal(FANOUT_CAPS.city_scan, 300);
  assert.equal(FANOUT_CAPS.city_only_fallback, 40);
  assert.equal(FANOUT_CAPS.backfill_scan, 100);
  assert.equal(FANOUT_CAPS.estimate_city_scan, 400);
  assert.ok(includesSquashed("take: 200"));
  assert.ok(includesSquashed("take: 300"));
  assert.ok(includesSquashed("if (cityOnlyAdded >= 40) break;"));
  assert.ok(includesSquashed("take: 100"));
  assert.ok(includesSquashed("take: 400"));
});

check("scores and ordering are untouched", () => {
  assert.ok(includesSquashed("score: sameCity ? 100 : 80"));
  assert.ok(includesSquashed("score: 50"));
  assert.ok(includesSquashed("score = 100"));
  assert.ok(includesSquashed("score = 80"));
  assert.ok(includesSquashed("let score = 50"));
  assert.ok(
    includesSquashed("[...scored.values()].sort((a, b) => b.score - a.score)"),
  );
});

check("RequestMatch and Notification writes are unchanged", () => {
  assert.equal(countSquashed("prisma.requestMatch.createMany"), 2);
  assert.equal(countSquashed("skipDuplicates: true"), 2);
  assert.equal(countSquashed("prisma.notification.createMany"), 1);
  assert.ok(
    includesSquashed(
      "if (notifications.length > 0) { await prisma.notification.createMany({ data: notifications }); }",
    ),
  );
});

check("the prisma call surface is unchanged in shape and count", () => {
  const calls = (DISTRIBUTE_SRC.match(/prisma\.[a-zA-Z]+\.[a-zA-Z]+\(/g) ?? [])
    .map((c) => c.replace(/\($/, ""))
    .sort();
  assert.deepEqual(calls, [
    "prisma.category.findUnique",
    "prisma.company.count",
    "prisma.company.findFirst",
    "prisma.company.findMany",
    "prisma.company.findMany",
    "prisma.company.findMany",
    "prisma.companyMember.findMany",
    "prisma.companyMember.findMany",
    "prisma.companyMember.findMany",
    "prisma.companyMember.findMany",
    "prisma.notification.createMany",
    "prisma.notification.findMany",
    "prisma.notification.findMany",
    "prisma.request.findFirst",
    "prisma.request.findMany",
    "prisma.requestMatch.createMany",
    "prisma.requestMatch.createMany",
    "prisma.requestMatch.findMany",
  ]);
});

check("return values are unchanged", () => {
  assert.equal(
    countSquashed("return { matchedCompanyCount: 0, notifiedUserCount: 0 };"),
    2,
  );
  assert.ok(
    includesSquashed(
      "return { matchedCompanyCount: matches.length, notifiedUserCount: notifications.length, };",
    ),
  );
  assert.equal(countSquashed("return { created: 0 };"), 3);
  assert.ok(includesSquashed("return { created: result.count };"));
  assert.equal(
    countSquashed("return { estimatedCompanyCount: 0, byCategory: 0, byCity: 0 };"),
    1,
  );
  assert.ok(
    includesSquashed(
      "return { estimatedCompanyCount: byCategory + byCity, byCategory, byCity, };",
    ),
  );
});

function matchedBody(src: string, openIndex: number, open: string, close: string) {
  let depth = 0;
  for (let i = openIndex; i < src.length; i += 1) {
    if (src[i] === open) depth += 1;
    else if (src[i] === close) {
      depth -= 1;
      if (depth === 0) return src.slice(openIndex, i + 1);
    }
  }
  return src.slice(openIndex);
}

function telemetryCallBodies(src: string): { name: string; body: string }[] {
  const out: { name: string; body: string }[] = [];
  const body = stripComments(src);
  for (const m of body.matchAll(/\b(log[A-Z][A-Za-z0-9]*)\(/g)) {
    const openIndex = m.index + m[0].length - 1;
    out.push({ name: m[1], body: matchedBody(body, openIndex, "(", ")") });
  }
  return out;
}

check("no event is emitted per company, member or request row", () => {
  const body = stripComments(DISTRIBUTE_SRC);
  for (const m of body.matchAll(/\bfor\s*\(/g)) {
    const parens = matchedBody(body, m.index, "(", ")");
    const braceStart = body.indexOf("{", m.index + parens.length);
    if (braceStart < 0) continue;
    const loopBody = matchedBody(body, braceStart, "{", "}");
    assert.ok(!/\blog[A-Z]/.test(loopBody), "telemetry inside a for-loop");
  }
  for (const m of body.matchAll(/\.(map|forEach|filter|flatMap|reduce)\s*\(/g)) {
    const cb = matchedBody(body, m.index + m[0].length - 1, "(", ")");
    assert.ok(!/\blog[A-Z]/.test(cb), `telemetry inside .${m[1]}()`);
  }
});

check("telemetry calls are statements, never values or conditions", () => {
  const body = stripComments(DISTRIBUTE_SRC);
  assert.ok(telemetryCallBodies(DISTRIBUTE_SRC).length >= 18);
  assert.ok(!/=\s*log[A-Z]/.test(body));
  assert.ok(!/await\s+log[A-Z]/.test(body));
  assert.ok(!/if\s*\(\s*log[A-Z]/.test(body));
  assert.ok(!/return\s+log[A-Z]/.test(body));
});

check("no raw text field is passed into any telemetry call", () => {
  const banned = [
    "request.title",
    "request.city",
    "request.category.name",
    "company.city",
    "company.name",
    "matchReason",
    "member.company.name",
    "professionalDescription",
    "rawInput",
    "input.city",
    "error.message",
    "error.stack",
  ];
  for (const { name, body } of telemetryCallBodies(DISTRIBUTE_SRC)) {
    for (const needle of banned) {
      assert.ok(!body.includes(needle), `${name} passes ${needle}`);
    }
  }
});

check("telemetry never re-enters matching state", () => {
  for (const { name, body } of telemetryCallBodies(DISTRIBUTE_SRC)) {
    assert.ok(!body.includes("scored.set"), name);
    assert.ok(!body.includes("matches.push"), name);
    assert.ok(!/\bprisma\./.test(body), name);
    assert.ok(!/\bawait\b/.test(body), name);
  }
});

check("Matching V3 is still not wired into legacy fanout", () => {
  assert.ok(!DISTRIBUTE_SRC.includes("matching-v3"));
  assert.ok(!DISTRIBUTE_SRC.includes("runShadowMatch"));
  assert.ok(!DISTRIBUTE_SRC.includes("shadow-match"));
});

check("no migration, schema or dependency change rides along", () => {
  assert.ok(!DISTRIBUTE_SRC.includes("prisma.$executeRaw"));
  assert.ok(!DISTRIBUTE_SRC.includes("prisma.$queryRaw"));
  assert.ok(!TELEMETRY_SRC.includes("prisma"));
  assert.ok(!TELEMETRY_SRC.includes("fetch("));
  for (const src of [TELEMETRY_SRC, ALLOWLIST_SRC]) {
    for (const m of src.matchAll(/from "([^"]+)"/g)) {
      assert.ok(m[1].startsWith("@/"), `unexpected dependency: ${m[1]}`);
    }
  }
});

/* ========================================================================== */
/* 9. SINK HONESTY GATE (Karar D)                                             */
/* ========================================================================== */

check("PRODUCTION-SINK-NOT-VERIFIED still holds — no sink is registered", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
    }
  };
  walk(path.join(ROOT, "src"));
  const callers = files.filter((f) => {
    if (f.endsWith(path.join("observability", "logger.ts"))) return false;
    return /\baddLogSink\s*\(/.test(fs.readFileSync(f, "utf8"));
  });
  assert.deepEqual(
    callers.map((f) => path.relative(ROOT, f)),
    [],
    "a log sink was registered — sink status must be re-verified and docs updated",
  );
});

/* ========================================================================== */
/* 10. RUNTIME EXCEPTION PATHS — real functions, stubbed Prisma                */
/* ========================================================================== */

type PrismaLike = Record<string, unknown>;

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const dist = await import("../src/server/request/distribute-request");

  function stub(models: Record<string, PrismaLike>) {
    const saved: [string, PropertyDescriptor | undefined][] = [];
    for (const [model, impl] of Object.entries(models)) {
      saved.push([
        model,
        Object.getOwnPropertyDescriptor(prisma as unknown as PrismaLike, model),
      ]);
      Object.defineProperty(prisma as unknown as PrismaLike, model, {
        value: impl,
        configurable: true,
        writable: true,
      });
    }
    return () => {
      for (const [model, desc] of saved) {
        if (desc) {
          Object.defineProperty(prisma as unknown as PrismaLike, model, desc);
        } else {
          delete (prisma as unknown as PrismaLike)[model];
        }
      }
    };
  }

  /** Poisoned on purpose: none of this may appear in any log line. */
  function poisonedError(name: string) {
    const err = new Error(
      "SELECT * FROM \"Request\" WHERE city='Kadıköy' -- ali@example.com 05551112233",
    );
    err.name = name;
    return err;
  }

  async function capture(fn: () => Promise<unknown>) {
    captured.length = 0;
    let thrown: unknown = null;
    try {
      await fn();
    } catch (e) {
      thrown = e;
    }
    return { thrown, events: [...captured] };
  }

  await checkAsync("fanout exception emits failed and re-throws the same error", async () => {
    const boom = poisonedError("PrismaClientKnownRequestError");
    const restore = stub({
      request: {
        findFirst: async () => {
          throw boom;
        },
      },
    });
    try {
      const { thrown, events } = await capture(() =>
        dist.distributeRequestToCompanies("cm4xreq001"),
      );
      assert.equal(thrown, boom, "a different error object was thrown");
      const names = events.map((e) => e.event);
      assert.deepEqual(names, [
        "request.fanout.started",
        "request.fanout.failed",
      ]);
      const failedCtx = events[1].context as Record<string, unknown>;
      assert.equal(failedCtx.reason, "unexpected_error");
      assert.equal(failedCtx.failureStage, "load_request");
      assert.equal(failedCtx.errorName, "PrismaClientKnownRequestError");
      assert.equal(typeof events[1].durationMs, "number");
      const blob = JSON.stringify(events);
      for (const needle of ["SELECT", "Kadıköy", "ali@example.com", "0555"]) {
        assert.ok(!blob.includes(needle), `leaked from error: ${needle}`);
      }
    } finally {
      restore();
    }
  });

  await checkAsync("fanout failure stage tracks how far it got", async () => {
    const boom = poisonedError("Error");
    const restore = stub({
      request: {
        findFirst: async () => ({
          id: "cm4xreq002",
          title: "Klima montajı",
          city: "İstanbul / Kadıköy",
          createdById: "user-1",
          visibleToSuppliersAt: null,
          category: { id: "cat-1", slug: "klima-servisi", name: "Klima" },
        }),
      },
      companyMember: {
        findMany: async () => {
          throw boom;
        },
      },
    });
    try {
      const { thrown, events } = await capture(() =>
        dist.distributeRequestToCompanies("cm4xreq002"),
      );
      assert.equal(thrown, boom);
      const failedEvent = events.find((e) => e.event === "request.fanout.failed");
      assert.ok(failedEvent, "no failed terminal");
      assert.equal(
        (failedEvent.context as Record<string, unknown>).failureStage,
        "load_creator_companies",
      );
      const blob = JSON.stringify(events);
      assert.ok(!blob.includes("Klima montajı"), "request title leaked");
      assert.ok(!blob.includes("Kadıköy"), "raw city leaked");
      assert.ok(!blob.includes("user-1"), "creator id leaked");
    } finally {
      restore();
    }
  });

  await checkAsync("backfill exception emits failed and re-throws", async () => {
    const boom = poisonedError("Error");
    const restore = stub({
      company: {
        findFirst: async () => {
          throw boom;
        },
      },
    });
    try {
      const { thrown, events } = await capture(() =>
        dist.backfillMatchesForCompany("cm4xco001"),
      );
      assert.equal(thrown, boom);
      assert.deepEqual(events.map((e) => e.event), [
        "request.backfill.started",
        "request.backfill.failed",
      ]);
      const ctx = events[1].context as Record<string, unknown>;
      assert.equal(ctx.reason, "unexpected_error");
      assert.equal(ctx.failureStage, "load_company");
      assert.equal(events[1].companyId, "cm4xco001");
      assert.ok(!JSON.stringify(events).includes("Kadıköy"));
    } finally {
      restore();
    }
  });

  await checkAsync("backfill skip reports a scan that never ran", async () => {
    const restore = stub({ company: { findFirst: async () => null } });
    try {
      const { thrown, events } = await capture(() =>
        dist.backfillMatchesForCompany("cm4xco002"),
      );
      assert.equal(thrown, null, "skip path must not throw");
      const done = events.find((e) => e.event === "request.backfill.completed");
      assert.ok(done);
      const ctx = done.context as Record<string, unknown>;
      assert.equal(ctx.scanStatus, "not_run");
      assert.equal(ctx.cap, 100);
      assert.ok(!("found" in ctx), "not_run carried a found value");
      assert.ok(!("capSaturated" in ctx), "not_run carried a verdict");
      assert.equal(ctx.reason, "company_not_found_or_not_distributable");
    } finally {
      restore();
    }
  });

  await checkAsync("backfill with a real empty scan reports executed / 0", async () => {
    const restore = stub({
      company: {
        findFirst: async () => ({
          id: "cm4xco003",
          city: "Ankara",
          categories: [{ categoryId: "cat-1" }],
        }),
      },
      companyMember: { findMany: async () => [] },
      requestMatch: { findMany: async () => [], createMany: async () => ({ count: 0 }) },
      request: { findMany: async () => [] },
    });
    try {
      const { thrown, events } = await capture(() =>
        dist.backfillMatchesForCompany("cm4xco003"),
      );
      assert.equal(thrown, null);
      const done = events.find((e) => e.event === "request.backfill.completed");
      const ctx = done?.context as Record<string, unknown>;
      assert.equal(ctx.scanStatus, "executed");
      assert.equal(ctx.found, 0);
      assert.equal(ctx.capSaturated, false);
      assert.equal(ctx.reason, "no_backfill_rows");
      assert.equal(ctx.provinceCode, "TR-06");
    } finally {
      restore();
    }
  });

  await checkAsync("estimator failure reuses the canonical event and re-throws", async () => {
    const boom = poisonedError("Error");
    const restore = stub({
      category: {
        findUnique: async () => {
          throw boom;
        },
      },
    });
    try {
      const { thrown, events } = await capture(() =>
        dist.countMatchingCompanies({
          categorySlug: "klima-servisi",
          city: "İstanbul / Kadıköy",
        }),
      );
      assert.equal(thrown, boom);
      assert.deepEqual(events.map((e) => e.event), ["request.fanout.estimated"]);
      assert.equal(events[0].outcome, "failure");
      const ctx = events[0].context as Record<string, unknown>;
      assert.equal(ctx.reason, "unexpected_error");
      assert.equal(ctx.failureStage, "load_category");
      assert.equal(ctx.categoryResolved, false);
      assert.ok(!("estimatedCompanyCount" in ctx), "counts emitted on failure");
      assert.equal(ctx.scanStatus, "not_run");
      assert.ok(!("found" in ctx));
      assert.equal(ctx.provinceCode, "TR-34");
      assert.ok(!JSON.stringify(events).includes("Kadıköy"));
    } finally {
      restore();
    }
  });

  await checkAsync("estimator success on an unresolved category never ran a city scan", async () => {
    const restore = stub({
      category: { findUnique: async () => null },
      companyMember: { findMany: async () => [] },
    });
    try {
      const { thrown, events } = await capture(() =>
        dist.countMatchingCompanies({ categorySlug: "yok-boyle-bir-slug", city: "Bolu" }),
      );
      assert.equal(thrown, null);
      const ctx = events[0].context as Record<string, unknown>;
      assert.equal(events[0].outcome, "success");
      assert.equal(ctx.categoryResolved, false);
      assert.ok(!("categorySlug" in ctx), "unresolved slug logged");
      assert.equal(ctx.scanStatus, "not_run");
      assert.ok(!("found" in ctx));
      assert.equal(ctx.provinceCode, "TR-14");
    } finally {
      restore();
    }
  });

  await checkAsync("runtime events still carry no actor identity", async () => {
    const boom = poisonedError("Error");
    const restore = stub({ company: { findFirst: async () => { throw boom; } } });
    try {
      captured.length = 0;
      let thrown: unknown = null;
      await runWithCorrelation(
        {
          correlationId: "corr-runtime",
          requestId: "http-runtime",
          userId: "user-runtime",
          companyId: "company-runtime",
        },
        async () => {
          try {
            await dist.backfillMatchesForCompany("cm4xco004");
          } catch (e) {
            thrown = e;
          }
        },
      );
      assert.equal(thrown, boom);
      const blob = JSON.stringify(captured);
      assert.ok(!blob.includes("user-runtime"), "userId leaked at runtime");
      assert.ok(!blob.includes("company-runtime"), "actor companyId leaked");
      assert.ok(!blob.includes("http-runtime"), "transport requestId leaked");
      for (const entry of captured) assert.equal(entry.userId, undefined);
    } finally {
      restore();
    }
  });

  detachCapture();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main();
