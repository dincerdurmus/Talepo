/**
 * Phase 4A — Observability foundation verify suite.
 * Run: npx tsx scripts/verify-phase4a-observability-v1.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  bindCorrelationFromRequest,
  getCorrelationId,
  runWithCorrelation,
} from "../src/lib/observability/correlation";
import {
  DomainError,
  DomainErrorCode,
  mapUnknownToSafeError,
} from "../src/lib/observability/errors";
import { MARKETPLACE_FUNNELS } from "../src/lib/observability/funnel";
import {
  clearRecentLogs,
  getRecentLogs,
  logOperational,
} from "../src/lib/observability/logger";
import { BUSINESS_METRICS } from "../src/lib/observability/metrics";
import {
  clearRecentProductEvents,
  getRecentProductEvents,
  ProductEventName,
  trackProductEvent,
} from "../src/lib/observability/product-events";
import {
  evaluateProviderHealth,
  recordProviderOperationalMetric,
} from "../src/lib/observability/provider-health";
import {
  REDACTED,
  redactHeaders,
  redactObject,
  sanitizeTelemetryMetadata,
} from "../src/lib/observability/redaction";
import {
  clearRecentShadowEvents,
  emitShadowCandidate,
  getRecentShadowEvents,
} from "../src/lib/observability/shadow";
import { getPlatformVersionMetadata } from "../src/lib/observability/versions";
import { validateEnvironment } from "../src/lib/observability/env";
import { GET as healthGet } from "../src/app/api/health/route";

let pass = 0;
let fail = 0;
const errors: string[] = [];

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass += 1;
    console.log(`PASS — ${name}`);
  } else {
    fail += 1;
    const msg = detail ? `${name}: ${detail}` : name;
    errors.push(msg);
    console.log(`FAIL — ${msg}`);
  }
}

const root = join(__dirname, "..");
function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

// 1 structured log shape
clearRecentLogs();
const entry = logOperational({
  level: "info",
  event: "request.publish.completed",
  service: "request",
  outcome: "success",
  durationMs: 12,
  context: { password: "secret", categorySlug: "technology" },
});
check(
  "1 structured log shape",
  Boolean(entry.timestamp && entry.level && entry.event && entry.service) &&
    entry.context?.password === REDACTED &&
    entry.context?.categorySlug === "technology",
);

// 2 correlation ID
const corr = runWithCorrelation(
  { correlationId: "corr-test-1", requestId: "req-1" },
  () => getCorrelationId(),
);
check("2 correlation ID", corr === "corr-test-1");

// 3 secret redaction
const redacted = redactObject({
  token: "abc",
  api_key: "x",
  safe: "ok",
});
check(
  "3 secret redaction",
  redacted.token === REDACTED &&
    redacted.api_key === REDACTED &&
    redacted.safe === "ok",
);

// 4 auth header redaction
const headers = redactHeaders({
  authorization: "Bearer abc.def.ghi",
  cookie: "session=1",
  "x-correlation-id": "c1",
});
check(
  "4 auth header redaction",
  headers.authorization === REDACTED &&
    headers.cookie === REDACTED &&
    headers["x-correlation-id"] === "c1",
);

// 5 safe error mapping
const prismaLike = new Error("Unique constraint failed on the fields: (`email`) P2002");
const mapped = mapUnknownToSafeError(prismaLike, "corr-x");
check(
  "5 safe error mapping",
  mapped.body.code === DomainErrorCode.INTERNAL_ERROR &&
    !mapped.body.message.includes("P2002") &&
    mapped.body.correlationId === "corr-x",
);

// 5b message validation error maps like its siblings (AC-1, 2026-08-31)
// Ölçülen canlı kusur: yetkisiz konuşmaya mesaj POST'u guard'da
// MessageValidationError fırlatıyor ama mapUnknownToSafeError bu adı
// tanımadığı için 500 INTERNAL_ERROR dönüyordu; sınır tutuyor (yazma yok)
// fakat hata sınıfı yanlıştı. Kardeş doğrulama hatalarıyla AYNI eşleme.
const messageValidationLike = new Error("Bu sohbete erişiminiz yok.");
messageValidationLike.name = "MessageValidationError";
const mappedMessage = mapUnknownToSafeError(messageValidationLike, "corr-m");
check(
  "5b MessageValidationError → 400 VALIDATION_FAILED",
  mappedMessage.status === 400 &&
    mappedMessage.body.code === DomainErrorCode.VALIDATION_FAILED &&
    mappedMessage.body.message === "Bu sohbete erişiminiz yok.",
);

// 6 provider success metric
clearRecentLogs();
recordProviderOperationalMetric({
  provider: "dataforseo",
  operation: "price_lookup",
  durationMs: 40,
  success: true,
  resultCount: 3,
});
check(
  "6 provider success metric",
  getRecentLogs().some((l) => l.event === "provider.price.completed"),
);

// 7 provider failure metric
clearRecentLogs();
recordProviderOperationalMetric({
  provider: "dataforseo",
  operation: "price_lookup",
  durationMs: 90,
  success: false,
  failureCategory: "PROVIDER_TIMEOUT",
  timedOut: true,
});
check(
  "7 provider failure metric",
  getRecentLogs().some(
    (l) => l.event === "provider.price.failed" && l.errorCode === "PROVIDER_TIMEOUT",
  ),
);

// 8 latency capture
check(
  "8 latency capture",
  getRecentLogs().some((l) => typeof l.durationMs === "number" && l.durationMs === 90),
);

// 9 product event contract
clearRecentProductEvents();
const pe = trackProductEvent({
  eventName: ProductEventName.REQUEST_PUBLISHED,
  actorType: "buyer",
  surface: "test",
  requestId: "r1",
  metadata: { description: "should not appear", status: "PUBLISHED" },
});
check(
  "9 product event contract",
  pe.eventName === "REQUEST_PUBLISHED" &&
    pe.occurredAt.length > 0 &&
    pe.metadata?.description === undefined &&
    pe.metadata?.status === "PUBLISHED",
);

// 10 PII minimization
const sanitized = sanitizeTelemetryMetadata({
  email: "a@b.com",
  phone: "555",
  password: "x",
  plan: "PREMIUM",
});
check(
  "10 PII minimization",
  sanitized.email === undefined &&
    sanitized.phone === undefined &&
    sanitized.password === undefined &&
    sanitized.plan === "PREMIUM",
);

async function main() {
  // 11 health
  const healthRes = await healthGet();
  const healthJson = (await healthRes.json()) as { ok: boolean; status: string };
  check("11 health", healthRes.status === 200 && healthJson.status === "alive");

  // 12 readiness route exists (handler import may hit DB — check file + env summary)
  check(
    "12 readiness",
    read("src/app/api/ready/route.ts").includes("critical") &&
      read("src/app/api/ready/route.ts").includes("price_provider") &&
      read("src/app/api/ready/route.ts").includes("critical: false"),
  );

  // 13 DB readiness check is present and cheap
  check(
    "13 DB readiness",
    read("src/app/api/ready/route.ts").includes("SELECT 1"),
  );

  // 14 optional provider does not kill readiness
  check(
    "14 optional provider does not kill readiness",
    read("src/app/api/ready/route.ts").includes("critical: false") &&
      evaluateProviderHealth("dataforseo", [
        { provider: "dataforseo", durationMs: 1, success: false },
        { provider: "dataforseo", durationMs: 1, success: false },
        { provider: "dataforseo", durationMs: 1, success: false },
        { provider: "dataforseo", durationMs: 1, success: false },
        { provider: "dataforseo", durationMs: 1, success: false },
      ]).state === "UNAVAILABLE",
  );

  // 15 tenant violation event
  check(
    "15 tenant violation event",
    read("src/server/monetization/opportunity-hunter.ts").includes(
      "tenancy.company_scope_violation",
    ) &&
      read("src/server/monetization/opportunity-hunter.ts").includes(
        "COMPANY_SCOPE_VIOLATION",
      ),
  );

  // 16 entitlement denied event
  check(
    "16 entitlement denied event",
    read("src/lib/membership/assert-entitlement.ts").includes("entitlement.denied"),
  );

  // 17 funnel event definitions
  check(
    "17 funnel event definitions",
    MARKETPLACE_FUNNELS.length >= 4 &&
      MARKETPLACE_FUNNELS.some((f) => f.id === "buyer_request_to_conversation") &&
      BUSINESS_METRICS.some((m) => m.id === "accepted_offer"),
  );

  // 18 no raw free-text telemetry
  check(
    "18 no raw free-text telemetry",
    getRecentProductEvents().every((e) => e.metadata?.description === undefined) &&
      !JSON.stringify(pe).includes("should not appear"),
  );

  // 19 shadow event contract
  clearRecentShadowEvents();
  emitShadowCandidate({
    subsystem: "understanding",
    mode: "SHADOW",
    productionDecisionId: "p1",
    candidateDecisionId: "c1",
    diffSummary: { equal: false, changedKeys: ["categoryId"] },
    versions: { production: "v1", candidate: "v1-shadow" },
  });
  check(
    "19 shadow event contract",
    getRecentShadowEvents()[0]?.kind === "shadow_candidate" &&
      getRecentShadowEvents()[0]?.mode === "SHADOW",
  );

  // 20 version metadata
  const versions = getPlatformVersionMetadata();
  check(
    "20 version metadata",
    versions.some((v) => v.surface === "understanding" && v.version === "v1") &&
      versions.some((v) => v.surface === "discovery_projection"),
  );

  // Extra: correlation bind from request header
  const req = new Request("http://localhost/api/x", {
    headers: { "x-correlation-id": "from-header" },
  });
  check(
    "correlation bind from header",
    bindCorrelationFromRequest(req).correlationId === "from-header",
  );

  // Extra: DomainError user-safe
  const de = new DomainError({
    code: DomainErrorCode.COMPANY_SCOPE_VIOLATION,
    userMessage: "Bu kayda erişemezsiniz.",
    diagnostic: "internal company mismatch",
  });
  const mappedDomain = mapUnknownToSafeError(de);
  check(
    "DomainError user-safe",
    mappedDomain.body.message === "Bu kayda erişemezsiniz." &&
      !JSON.stringify(mappedDomain.body).includes("internal company"),
  );

  // Extra: env validation does not leak values
  const envResult = validateEnvironment({ nodeEnv: "development" });
  check(
    "env validation shape",
    typeof envResult.ok === "boolean" && Array.isArray(envResult.missingRequired),
  );

  console.log(`\nPhase 4A observability: ${pass} passed, ${fail} failed`);
  if (fail > 0) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
}

void main();
