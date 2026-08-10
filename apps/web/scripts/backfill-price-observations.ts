/**
 * Backfill price observations for ALL existing Request/Offer records.
 *   npx tsx scripts/backfill-price-observations.ts --dry-run
 *   npx tsx scripts/backfill-price-observations.ts
 *
 * - All categories (engine-driven, not hardcoded subset)
 * - Idempotent via idempotencyKey upsert
 * - NEVER backfills TALEPO_CONFIRMED_TRANSACTION (no deal confirmation)
 */
import "dotenv/config";

import { prisma } from "../src/lib/prisma";
import {
  recordAcceptedOfferObservation,
  recordOfferPriceObservation,
  recordRequestPriceObservation,
} from "../src/server/price-intelligence/record-observation";

const dryRun = process.argv.includes("--dry-run");

async function countEligibleRequests() {
  const requests = await prisma.request.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      budgetMin: true,
      budgetMax: true,
      category: { select: { slug: true } },
    },
  });

  let wouldCreate = 0;
  for (const r of requests) {
    const price = r.budgetMax?.toNumber() ?? r.budgetMin?.toNumber() ?? null;
    if (price != null && price > 0) wouldCreate++;
  }
  return { total: requests.length, wouldCreate };
}

async function countEligibleOffers() {
  const offers = await prisma.offer.findMany({
    where: { status: { not: "DRAFT" } },
    select: { id: true, status: true },
  });
  const accepted = offers.filter((o) => o.status === "ACCEPTED").length;
  return {
    total: offers.length,
    wouldOffer: offers.length,
    wouldAccepted: accepted,
  };
}

async function main() {
  const reqCounts = await countEligibleRequests();
  const offerCounts = await countEligibleOffers();

  console.log(`backfill-price-observations: ${dryRun ? "DRY-RUN" : "APPLY"}`);
  console.log(`  TALEPO_REQUEST would create: ${reqCounts.wouldCreate} (${reqCounts.total} requests scanned)`);
  console.log(`  TALEPO_OFFER would create: ${offerCounts.wouldOffer}`);
  console.log(`  TALEPO_ACCEPTED_OFFER would create: ${offerCounts.wouldAccepted}`);
  console.log(`  TALEPO_CONFIRMED_TRANSACTION: SKIPPED (requires deal confirmation — never backfilled)`);

  if (dryRun) {
    const byCategory = await prisma.request.groupBy({
      by: ["categoryId"],
      where: { deletedAt: null },
      _count: { id: true },
    });
    console.log(`  categories with requests: ${byCategory.length}`);
    return;
  }

  const requests = await prisma.request.findMany({
    where: { deletedAt: null },
    select: { id: true, category: { select: { slug: true } } },
    orderBy: { createdAt: "asc" },
  });

  let requestOk = 0;
  let requestSkip = 0;

  for (const req of requests) {
    try {
      await recordRequestPriceObservation(req.id);
      requestOk++;
    } catch (error) {
      requestSkip++;
      console.error(`[backfill] request ${req.id} (${req.category.slug}):`, error);
    }
  }

  const offers = await prisma.offer.findMany({
    where: { status: { not: "DRAFT" } },
    select: { id: true, status: true, request: { select: { category: { select: { slug: true } } } } },
    orderBy: { createdAt: "asc" },
  });

  let offerOk = 0;
  let acceptedOk = 0;
  let offerSkip = 0;

  for (const offer of offers) {
    try {
      await recordOfferPriceObservation(offer.id);
      offerOk++;

      if (offer.status === "ACCEPTED") {
        await recordAcceptedOfferObservation(offer.id);
        acceptedOk++;
      }
    } catch (error) {
      offerSkip++;
      console.error(
        `[backfill] offer ${offer.id} (${offer.request.category.slug}):`,
        error,
      );
    }
  }

  const bySource = await prisma.priceObservation.groupBy({
    by: ["sourceType"],
    _count: { id: true },
  });

  const withFingerprint = await prisma.priceObservation.count({
    where: { productFingerprint: { not: null } },
  });
  const withoutFingerprint = await prisma.priceObservation.count({
    where: { productFingerprint: null },
  });

  console.log("backfill-price-observations: DONE");
  console.log(`  requests: ${requestOk} ok, ${requestSkip} skipped (${requests.length} total)`);
  console.log(`  offers: ${offerOk} ok, ${acceptedOk} accepted, ${offerSkip} skipped (${offers.length} total)`);
  console.log(`  fingerprint: ${withFingerprint} with, ${withoutFingerprint} without`);
  console.log("  by sourceType:", Object.fromEntries(bySource.map((r) => [r.sourceType, r._count.id])));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
