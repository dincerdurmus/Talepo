/**
 * REQ-001 — request publish contract + regression for JSON body 500s.
 * Run: npx tsx scripts/verify-request-publish-v1.ts
 */
import { config as loadDotenv } from "dotenv";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

loadDotenv({ path: join(__dirname, "..", ".env") });
loadDotenv({ path: join(__dirname, "..", ".env.local"), override: true });

import {
  parseCreateRequestInput,
  parseJsonObject,
  RequestValidationError,
} from "../src/server/request/request-schema";
import {
  DomainErrorCode,
  firstApplicationFrame,
  mapUnknownToSafeError,
  safeDiagnosticMessage,
  safeErrorResponse,
} from "../src/lib/observability/errors";
import {
  clearRecentLogs,
  getRecentLogs,
} from "../src/lib/observability/logger";

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
const routeSrc = readFileSync(join(root, "src/app/api/requests/route.ts"), "utf8");

const validPayload = {
  title: "10 adet ergonomik ofis sandalyesi",
  description:
    "İstanbul'da ofisimiz için 10 adet ergonomik çalışma sandalyesi arıyoruz.",
  category: { slug: "furniture", name: "Mobilya ve Ofis" },
  city: "İstanbul",
  quantity: "10",
  budget: "8000",
  publishVersion: "ai",
  fields: [
    {
      key: "furnitureType",
      label: "Ürün türü",
      type: "text",
      required: true,
      value: "Ofis sandalyesi",
    },
  ],
};

check(
  "route reads body text before requireUser",
  routeSrc.indexOf("await request.text()") !== -1 &&
    routeSrc.indexOf("await request.text()") < routeSrc.indexOf("requireUser()"),
);

check(
  "route does not call request.json()",
  !routeSrc.includes("request.json()"),
);

check("route uses parseJsonObject", routeSrc.includes("parseJsonObject"));

try {
  parseJsonObject("");
  check("empty JSON body is validation error", false, "did not throw");
} catch (error) {
  check(
    "empty JSON body is validation error",
    error instanceof RequestValidationError,
  );
}

try {
  parseJsonObject("{");
  check("broken JSON is validation error not SyntaxError leak", false, "did not throw");
} catch (error) {
  check(
    "broken JSON is validation error not SyntaxError leak",
    error instanceof RequestValidationError &&
      !(error instanceof SyntaxError && error.name === "SyntaxError" && !(error instanceof RequestValidationError)),
  );
}

const parsed = parseJsonObject(JSON.stringify({ ok: true, n: 1 }));
check(
  "valid JSON object parses",
  typeof parsed === "object" &&
    parsed !== null &&
    (parsed as { ok?: boolean }).ok === true,
);

const mappedBroken = mapUnknownToSafeError(
  (() => {
    try {
      parseJsonObject("{not-json");
    } catch (error) {
      return error;
    }
    return new Error("unreachable");
  })(),
  "corr-json",
);
check(
  "broken JSON maps to 400 VALIDATION_FAILED",
  mappedBroken.status === 400 &&
    mappedBroken.body.code === DomainErrorCode.VALIDATION_FAILED &&
    mappedBroken.body.correlationId === "corr-json" &&
    !JSON.stringify(mappedBroken.body).includes("Unexpected"),
);

try {
  parseCreateRequestInput({ description: "kısa" });
  check("missing title/category is validation error", false, "did not throw");
} catch (error) {
  const mapped = mapUnknownToSafeError(error, "corr-val");
  check(
    "missing title/category is validation error",
    error instanceof RequestValidationError &&
      mapped.status === 400 &&
      mapped.body.code === DomainErrorCode.VALIDATION_FAILED,
  );
}

const input = parseCreateRequestInput(validPayload);
check(
  "valid publish payload parses",
  input.title.length >= 3 &&
    input.category.slug === "furniture" &&
    input.fields.some((field) => field.key === "furnitureType" && field.value),
);

const authError = new Error("Bu işlem için giriş yapmanız gerekiyor.");
authError.name = "AuthenticationError";
const authMapped = mapUnknownToSafeError(authError, "corr-auth");
check(
  "unauthorized maps to 401 AUTH_REQUIRED",
  authMapped.status === 401 &&
    authMapped.body.code === DomainErrorCode.AUTH_REQUIRED &&
    !JSON.stringify(authMapped.body).includes("stack"),
);

const dbError = new Error(
  "connect ECONNREFUSED postgresql://user:secret@localhost:5432/db for admin@x.com",
);
dbError.stack = "Error: connect\n    at createRequest (src/server/request/create-request.ts:127:11)";
const dbMapped = mapUnknownToSafeError(dbError, "corr-db");
check(
  "DB/transaction error maps to 5xx without leaking internals",
  dbMapped.status >= 500 &&
    dbMapped.body.message ===
      "İşlem tamamlanamadı. Lütfen biraz sonra tekrar deneyin." &&
    !dbMapped.body.message.includes("ECONNREFUSED") &&
    !dbMapped.body.message.includes("postgresql") &&
    !JSON.stringify(dbMapped.body).includes("create-request.ts"),
);

check(
  "safe diagnostic redacts connection strings",
  safeDiagnosticMessage(dbError).includes("[REDACTED]") &&
    !safeDiagnosticMessage(dbError).includes("secret"),
);

check(
  "application frame stays relative to src/",
  firstApplicationFrame(dbError) === "src/server/request/create-request.ts:127:11",
);

clearRecentLogs();
const logged = safeErrorResponse(dbError, {
  service: "request",
  event: "request.publish.failed",
  correlationId: "corr-db",
  context: { operation: "publish.create" },
});
check("5xx HTTP status on safeErrorResponse", logged.status === 500);
const log = getRecentLogs().find((entry) => entry.event === "request.publish.failed");
check(
  "server log keeps class, message, operation, frame",
  Boolean(
    log &&
      log.correlationId === "corr-db" &&
      log.context?.errorName === "Error" &&
      String(log.context?.errorMessage ?? "").includes("ECONNREFUSED") &&
      log.context?.operation === "publish.create" &&
      log.context?.applicationFrame ===
        "src/server/request/create-request.ts:127:11" &&
      !JSON.stringify(log.context).includes("user:secret"),
  ),
);

async function livePublishChecks() {
  const hasDb = Boolean(
    process.env.DATABASE_URL?.trim() || process.env.DIRECT_URL?.trim(),
  );
  if (!hasDb) {
    check("live publish skipped (no DATABASE_URL)", false, "env missing");
    return;
  }

  const { prisma } = await import("../src/lib/prisma");
  const { createRequest } = await import("../src/server/request/create-request");
  const BUYER_EMAIL = "e2e-alici-20260817184814@talepo.test";
  const createdIds: string[] = [];

  try {
    const user = await prisma.user.findUnique({
      where: { email: BUYER_EMAIL },
      select: { id: true },
    });
    if (!user) {
      check("live buyer exists", false, "buyer not found");
      return;
    }
    check("live buyer exists", true);

    const created = await createRequest(
      user.id,
      parseCreateRequestInput({
        ...validPayload,
        idempotencyKey: "req001-live-idem-01",
      }),
    );
    createdIds.push(created.id);
    check(
      "valid payload creates request with id",
      Boolean(created.id) && created.status === "PUBLISHED",
    );

    const replay = await createRequest(
      user.id,
      parseCreateRequestInput({
        ...validPayload,
        idempotencyKey: "req001-live-idem-01",
      }),
    );
    check(
      "idempotent replay returns same request id",
      replay.id === created.id,
    );
  } catch (error) {
    check(
      "live createRequest",
      false,
      error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    );
  } finally {
    for (const id of createdIds) {
      await prisma.notification.deleteMany({ where: { requestId: id } }).catch(() => undefined);
      await prisma.priceObservation.deleteMany({ where: { requestId: id } }).catch(() => undefined);
      await prisma.requestMatch.deleteMany({ where: { requestId: id } }).catch(() => undefined);
      await prisma.idempotencyRecord
        .deleteMany({ where: { resourceId: id } })
        .catch(() => undefined);
      await prisma.request.delete({ where: { id } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  }
}

async function main() {
  await livePublishChecks();
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) {
    for (const msg of errors) console.error(` - ${msg}`);
    process.exit(1);
  }
}

void main();
