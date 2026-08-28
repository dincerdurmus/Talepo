/**
 * Seed six acceptance personas on Talepo Staging only.
 * Idempotent — keyed by acceptance-v1-*@talepo.test emails.
 *
 * Run: npm run acceptance:seed-personas
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

import { loadAcceptanceEnv } from "./lib/load-acceptance-env";
/**
 * Product modules are bound inside main(), AFTER the env is verified: a static
 * import would load `src/lib/prisma`, which reads DATABASE_URL at module scope.
 */
let prisma!: typeof import("../src/lib/prisma").prisma;
let hashPassword!: typeof import("../src/lib/auth/password").hashPassword;

/** Bind every runtime product export. Called only after the env is verified. */
async function bindProductModules(): Promise<void> {
  ({ prisma } = await import("../src/lib/prisma"));
  ({ hashPassword } = await import("../src/lib/auth/password"));
}
import {
  ACCEPTANCE_COMPANY,
  ACCEPTANCE_MARKER,
  ACCEPTANCE_TEST_PASSWORD,
  PERSONAS,
  type PersonaKey,
} from "./lib/acceptance-personas-v1.constants";
import { formatAcceptanceError, redactAcceptanceOutput } from "./lib/acceptance-redaction-v1";
import { evaluateAcceptanceDbTarget } from "./lib/acceptance-db-target-v1";

const ACCEPTANCE_ENV_PATH = join(__dirname, "..", ".env.acceptance");

function fail(msg: string): never {
  // Every operator-facing line goes through the single redaction authority.
  console.error(`FAIL — ${redactAcceptanceOutput(msg)}`);
  process.exit(1);
}

function assertAcceptanceEnv(): void {
  if (process.env.TALEPO_ENVIRONMENT !== "acceptance") {
    fail(`TALEPO_ENVIRONMENT must be "acceptance"`);
  }
  if (!existsSync(ACCEPTANCE_ENV_PATH)) {
    fail(".env.acceptance missing");
  }
}

/** Re-runs the canonical target guard; never parses the URL a second way. */
function assertAcceptanceTarget(): void {
  const decision = evaluateAcceptanceDbTarget(process.env);
  if (!decision.ok) {
    fail(`Refusing seed — ${decision.reason}: ${decision.detail}`);
  }
  // The ref is deliberately NOT returned: nothing downstream may carry it.
}

async function upsertPersona(key: PersonaKey) {
  const spec = PERSONAS[key];
  const passwordHash = hashPassword(ACCEPTANCE_TEST_PASSWORD);
  const biography = `${ACCEPTANCE_MARKER} persona ${key}`;

  const existing = await prisma.user.findUnique({
    where: { email: spec.email },
    select: { id: true },
  });

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        name: `[${ACCEPTANCE_MARKER}] ${spec.label}`,
        planTier: spec.planTier,
        passwordHash,
        status: "ACTIVE",
        biography,
      },
      select: { id: true, email: true, planTier: true, membershipNumber: true },
    });
  }

  return prisma.user.create({
    data: {
      email: spec.email,
      name: `[${ACCEPTANCE_MARKER}] ${spec.label}`,
      membershipNumber: spec.membershipNumber,
      planTier: spec.planTier,
      passwordHash,
      status: "ACTIVE",
      biography,
    },
    select: { id: true, email: true, planTier: true, membershipNumber: true },
  });
}

async function main() {
  loadAcceptanceEnv();
  await bindProductModules();
  assertAcceptanceEnv();

  // Defence in depth: the env loader already refused any non-acceptance target.
  assertAcceptanceTarget();

  console.log("=== seed-acceptance-personas-v1 ===");
  console.log("TARGET_CLASSIFICATION=ACCEPTANCE_ALLOWLISTED");
  console.log(`MARKER: ${ACCEPTANCE_MARKER}`);
  console.log("SECRETS PRINTED: no");

  const users = {} as Record<PersonaKey, Awaited<ReturnType<typeof upsertPersona>>>;

  for (const key of Object.keys(PERSONAS) as PersonaKey[]) {
    users[key] = await upsertPersona(key);
  }

  const owner = users.D;
  const member = users.E;

  const company = await prisma.company.upsert({
    where: { slug: ACCEPTANCE_COMPANY.slug },
    update: {
      name: ACCEPTANCE_COMPANY.name,
      planTier: "CORPORATE",
      status: "ACTIVE",
      createdById: owner.id,
    },
    create: {
      name: ACCEPTANCE_COMPANY.name,
      slug: ACCEPTANCE_COMPANY.slug,
      planTier: "CORPORATE",
      status: "ACTIVE",
      createdById: owner.id,
    },
    select: { id: true, name: true, slug: true, planTier: true },
  });

  await prisma.companyMember.upsert({
    where: {
      companyId_userId: { companyId: company.id, userId: owner.id },
    },
    update: {
      role: "OWNER",
      status: "ACTIVE",
      joinedAt: new Date(),
      removedAt: null,
    },
    create: {
      companyId: company.id,
      userId: owner.id,
      role: "OWNER",
      status: "ACTIVE",
      joinedAt: new Date(),
    },
  });

  await prisma.companyMember.upsert({
    where: {
      companyId_userId: { companyId: company.id, userId: member.id },
    },
    update: {
      role: "MEMBER",
      status: "ACTIVE",
      joinedAt: new Date(),
      removedAt: null,
    },
    create: {
      companyId: company.id,
      userId: member.id,
      role: "MEMBER",
      status: "ACTIVE",
      joinedAt: new Date(),
    },
  });

  const activeSeats = await prisma.companyMember.count({
    where: { companyId: company.id, status: "ACTIVE" },
  });

  console.log("PERSONA SEED: ok");
  console.log(`USERS SEEDED: ${Object.keys(users).length}`);
  console.log(`ACCEPTANCE COMPANY: ${company.slug}`);
  console.log(`COMPANY PLAN: ${company.planTier}`);
  console.log(`ACTIVE SEATS: ${activeSeats}`);
  console.log("DB WRITE: yes (acceptance personas only)");
  console.log("PRODUCTION TOUCHED: no");
  console.log("PAYMENT ATTEMPTED: no");
  console.log("\nRun: npm run acceptance:verify-personas");
}

main()
  .catch((e) => {
    // Shared redactor: a Prisma connection error names the host with no URI
    // scheme, which the old URI-only replace let through.
    fail(formatAcceptanceError(e));
  })
  .finally(async () => {
    await prisma?.$disconnect();
  });
