/**
 * Seed the synthetic acceptance fixtures (requests, notifications, one offer
 * conversation) on top of the acceptance personas.
 *
 * Idempotent — every row is keyed by owner + marker-prefixed title, so a second
 * run creates nothing. Requires the personas seed to have run first.
 *
 * Run from apps/web:
 *   npx --yes tsx scripts/seed-acceptance-personas-v1.ts
 *   npx --yes tsx scripts/seed-acceptance-fixtures-v1.ts
 */
import "./lib/load-acceptance-env";

import { prisma } from "../src/lib/prisma";
import { ensureEngineCategories } from "../src/server/company/sync-company-categories";
import { PERSONAS, type PersonaKey } from "./lib/acceptance-personas-v1.constants";
import {
  ACCEPTANCE_FIXTURE_CITY,
  ACCEPTANCE_FIXTURE_DISTRICT,
  FIXTURE_CONVERSATIONS,
  FIXTURE_NOTIFICATIONS,
  FIXTURE_REQUESTS,
  type FixtureRequestKey,
} from "./lib/acceptance-fixtures-v1.constants";

function fail(message: string): never {
  console.error(`FAIL — ${message}`);
  process.exit(1);
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function main(): Promise<void> {
  console.log("=== seed-acceptance-fixtures-v1 ===");

  const users = await prisma.user.findMany({
    where: { email: { in: Object.values(PERSONAS).map((persona) => persona.email) } },
    select: { id: true, email: true },
  });
  const userIdByPersona = new Map<PersonaKey, string>();
  for (const [key, spec] of Object.entries(PERSONAS) as [PersonaKey, { email: string }][]) {
    const row = users.find((candidate) => candidate.email === spec.email);
    if (!row) fail(`persona ${key} is missing — run seed-acceptance-personas-v1 first`);
    userIdByPersona.set(key, row.id);
  }
  console.log(`PERSONAS RESOLVED: ${userIdByPersona.size}`);

  // Global taxonomy is a platform job, not fixture data; make sure it exists.
  await ensureEngineCategories();

  const categorySlugs = [...new Set(FIXTURE_REQUESTS.map((spec) => spec.categorySlug))];
  const categories = await prisma.category.findMany({
    where: { slug: { in: categorySlugs } },
    select: { id: true, slug: true },
  });
  const categoryIdBySlug = new Map(categories.map((row) => [row.slug, row.id]));
  for (const slug of categorySlugs) {
    if (!categoryIdBySlug.has(slug)) fail(`category ${slug} is missing after provisioning`);
  }

  const requestIdByKey = new Map<FixtureRequestKey, string>();
  let createdRequests = 0;
  for (const spec of FIXTURE_REQUESTS) {
    const createdById = userIdByPersona.get(spec.owner)!;
    const existing = await prisma.request.findFirst({
      where: { createdById, title: spec.title },
      select: { id: true },
    });
    if (existing) {
      requestIdByKey.set(spec.key, existing.id);
      continue;
    }
    const created = await prisma.request.create({
      data: {
        createdById,
        categoryId: categoryIdBySlug.get(spec.categorySlug)!,
        title: spec.title,
        description: spec.description,
        rawInput: spec.rawInput,
        status: spec.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
        isUrgent: spec.isUrgent,
        city: ACCEPTANCE_FIXTURE_CITY,
        district: ACCEPTANCE_FIXTURE_DISTRICT,
        budgetMax: spec.budget ?? undefined,
        publishedAt: spec.publishedDaysAgo === null ? null : daysAgo(spec.publishedDaysAgo),
      },
      select: { id: true },
    });
    requestIdByKey.set(spec.key, created.id);
    createdRequests += 1;
  }
  console.log(`REQUESTS: ${requestIdByKey.size} total, ${createdRequests} created`);

  let createdNotifications = 0;
  for (const spec of FIXTURE_NOTIFICATIONS) {
    const userId = userIdByPersona.get(spec.recipient)!;
    const existing = await prisma.notification.findFirst({
      where: { userId, title: spec.title },
      select: { id: true },
    });
    if (existing) continue;
    const requestId = spec.request ? (requestIdByKey.get(spec.request) ?? null) : null;
    await prisma.notification.create({
      data: {
        userId,
        type: "REQUEST_PUBLISHED",
        status: "UNREAD",
        title: spec.title,
        message: spec.message,
        requestId,
        actionUrl: requestId ? `/panel/talepler/${requestId}` : null,
      },
    });
    createdNotifications += 1;
  }
  console.log(`NOTIFICATIONS: ${FIXTURE_NOTIFICATIONS.length} total, ${createdNotifications} created`);

  let createdConversations = 0;
  for (const spec of FIXTURE_CONVERSATIONS) {
    const requestId = requestIdByKey.get(spec.request)!;
    const submittedById = userIdByPersona.get(spec.supplier)!;
    const buyerId = userIdByPersona.get(spec.buyer)!;

    let offer = await prisma.offer.findFirst({
      where: { requestId, submittedById, title: spec.offerTitle },
      select: { id: true },
    });
    if (!offer) {
      offer = await prisma.offer.create({
        data: {
          requestId,
          submittedById,
          title: spec.offerTitle,
          description: spec.offerDescription,
          amount: spec.offerAmount,
          status: "SUBMITTED",
          submittedAt: daysAgo(1),
        },
        select: { id: true },
      });
    }

    const existingConversation = await prisma.conversation.findUnique({
      where: { offerId: offer.id },
      select: { id: true },
    });
    if (existingConversation) continue;

    const conversation = await prisma.conversation.create({
      data: { offerId: offer.id, title: spec.offerTitle, lastMessageAt: daysAgo(1) },
      select: { id: true },
    });
    await prisma.conversationParticipant.createMany({
      data: [
        { conversationId: conversation.id, userId: buyerId },
        { conversationId: conversation.id, userId: submittedById, lastReadAt: daysAgo(1) },
      ],
      skipDuplicates: true,
    });
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderUserId: submittedById,
        content: spec.firstMessage,
      },
    });
    createdConversations += 1;
  }
  console.log(
    `CONVERSATIONS: ${FIXTURE_CONVERSATIONS.length} total, ${createdConversations} created`,
  );

  console.log("MATCH ROWS WRITTEN: 0 (backfill cron must produce them)");
  console.log("SECRETS PRINTED: no");
  console.log("PASS — acceptance fixtures seeded");
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`FAIL — ${message.replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[redacted-uri]")}`);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
