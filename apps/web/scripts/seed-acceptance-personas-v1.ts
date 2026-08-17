/**
 * Seed six acceptance personas on Talepo Staging only.
 * Idempotent — keyed by acceptance-v1-*@talepo.test emails.
 *
 * Run: npm run acceptance:seed-personas
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import "./lib/load-acceptance-env";
import { hashPassword } from "../src/lib/auth/password";
import { prisma } from "../src/lib/prisma";
import {
  ACCEPTANCE_COMPANY,
  ACCEPTANCE_MARKER,
  ACCEPTANCE_TEST_PASSWORD,
  BLOCKED_PRIMARY_PROJECT_REF,
  PERSONAS,
  TARGET_PROJECT_REF,
  type PersonaKey,
} from "./lib/acceptance-personas-v1.constants";

const ACCEPTANCE_ENV_PATH = join(__dirname, "..", ".env.acceptance");

function fail(msg: string): never {
  console.error(`FAIL — ${msg}`);
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

function projectRefFromDirectUrl(): string | null {
  const direct = process.env.DIRECT_URL?.trim() ?? "";
  const userMatch = direct.match(/postgres(?:ql)?:\/\/([^:@/]+):/i);
  const user = userMatch?.[1] ? decodeURIComponent(userMatch[1]) : "";
  const ref = user.match(/^postgres\.([a-z0-9]+)$/i);
  return ref?.[1] ?? null;
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
  assertAcceptanceEnv();

  const projectRef = projectRefFromDirectUrl();
  if (projectRef === BLOCKED_PRIMARY_PROJECT_REF) {
    fail("Refusing seed — primary/production project ref detected");
  }
  if (projectRef && projectRef !== TARGET_PROJECT_REF) {
    fail(`Unexpected project ref (expected ${TARGET_PROJECT_REF})`);
  }

  console.log("=== seed-acceptance-personas-v1 ===");
  console.log(`TARGET PROJECT REF: ${projectRef ?? TARGET_PROJECT_REF}`);
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
    const msg = e instanceof Error ? e.message : String(e);
    fail(msg.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[redacted-uri]"));
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
