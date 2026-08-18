/**
 * One-shot Prisma relation smoke for Analiz / Teklifler runtime fix.
 * Not part of product surface — delete after diagnosis if desired.
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

async function main() {
  const { prisma } = await import("../src/lib/prisma");

  try {
    const offers = await prisma.offer.findMany({
      where: { status: { not: "DRAFT" } },
      take: 1,
      include: {
        media: { select: { id: true }, orderBy: { sortOrder: "asc" } },
        negotiations: {
          select: {
            id: true,
            amount: true,
            currency: true,
            proposedBySide: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
        attribution: true,
        intelligenceExposure: true,
      },
    });
    console.log(
      "OFFER_FIND_OK",
      offers.length,
      offers[0] ? Object.keys(offers[0]) : [],
    );
  } catch (e) {
    console.error(
      "OFFER_FIND_FAIL",
      e instanceof Error ? e.message : String(e),
    );
  }

  try {
    const rows = await prisma.$queryRawUnsafe<{ c: number }[]>(
      `SELECT COUNT(*)::int AS c FROM "OfferAttribution"`,
    );
    console.log("ATTR_TABLE_OK", rows);
  } catch (e) {
    console.error(
      "ATTR_TABLE_FAIL",
      e instanceof Error ? e.message : String(e),
    );
  }

  try {
    const rows = await prisma.$queryRawUnsafe<{ c: number }[]>(
      `SELECT COUNT(*)::int AS c FROM "OfferIntelligenceExposure"`,
    );
    console.log("OI_TABLE_OK", rows);
  } catch (e) {
    console.error("OI_TABLE_FAIL", e instanceof Error ? e.message : String(e));
  }

  // Mirror Analiz V2 commercial path entrypoints lightly
  try {
    const { getCommercialPerformance } = await import(
      "../src/server/monetization/commercial-performance"
    );
    const owner = { scope: "personal" as const, userId: "diag-user-missing" };
    const to = new Date();
    const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    const result = await getCommercialPerformance(owner, from, to);
    console.log("COMMERCIAL_PERF_OK", {
      completedDeals: result.completedDeals,
      sourceRows: result.sourcePerformance.length,
      oiAvailable: result.intelligenceAssistance.available,
    });
  } catch (e) {
    console.error(
      "COMMERCIAL_PERF_FAIL",
      e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    );
    if (e instanceof Error && e.stack) {
      console.error(e.stack.split("\n").slice(0, 12).join("\n"));
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
