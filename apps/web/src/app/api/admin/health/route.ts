import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { assertMfaSession } from "@/server/admin/mfa";
import { requirePlatformAdmin } from "@/server/auth/require-platform-admin";

export async function GET(request: Request) {
  try {
    const admin = await requirePlatformAdmin("analytics.view");
    assertMfaSession(request, admin.id);
    const since = new Date(Date.now() - 30 * 86_400_000);
    const stale = new Date(Date.now() - 86_400_000);
    const [newUsers, requests, published, offers, accepted, noOffer, activeSellers, openCases, failedBilling, categories] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: since }, deletedAt: null } }),
      prisma.request.count({ where: { createdAt: { gte: since }, deletedAt: null } }),
      prisma.request.count({ where: { publishedAt: { gte: since }, deletedAt: null } }),
      prisma.offer.count({ where: { createdAt: { gte: since } } }),
      prisma.offer.count({ where: { acceptedAt: { gte: since } } }),
      prisma.request.count({ where: { publishedAt: { lte: stale, gte: since }, offerCount: 0, deletedAt: null, status: { in: ["PUBLISHED", "RECEIVING_OFFERS"] } } }),
      prisma.offer.groupBy({ by: ["submittedById"], where: { createdAt: { gte: since } } }),
      prisma.moderationCase.count({ where: { status: { in: ["OPEN", "INVESTIGATING"] } } }),
      prisma.billingEvent.count({ where: { status: "FAILED", createdAt: { gte: since } } }),
      prisma.request.groupBy({ by: ["categoryId"], where: { publishedAt: { gte: since }, deletedAt: null }, _count: { _all: true }, _sum: { offerCount: true }, orderBy: { _count: { categoryId: "desc" } }, take: 8 }),
    ]);
    const categoryRecords = await prisma.category.findMany({ where: { id: { in: categories.map((item) => item.categoryId) } }, select: { id: true, name: true } });
    const categoryNames = new Map(categoryRecords.map((category) => [category.id, category.name]));
    const acceptanceRate = offers ? Math.round((accepted / offers) * 1000) / 10 : 0;
    const offerCoverage = published ? Math.round(((published - noOffer) / published) * 1000) / 10 : 100;
    return NextResponse.json({
      ok: true,
      periodDays: 30,
      metrics: { newUsers, requests, published, offers, accepted, acceptanceRate, offerCoverage, noOffer, activeSellers: activeSellers.length, openCases, failedBilling },
      categoryGaps: categories.map((item) => ({ categoryId: item.categoryId, categoryName: categoryNames.get(item.categoryId) ?? "Bilinmeyen kategori", requests: item._count._all, offers: item._sum.offerCount ?? 0, gap: Math.max(0, item._count._all - (item._sum.offerCount ?? 0)) })),
    });
  } catch (error) {
    console.error("[admin/health]", error);
    return NextResponse.json({ ok: false, message: "Sağlık metrikleri alınamadı." }, { status: 403 });
  }
}
