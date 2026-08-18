import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { assertMfaSession } from "@/server/admin/mfa";
import { requirePlatformAdmin } from "@/server/auth/require-platform-admin";

const DAY = 86_400_000;

function parseDate(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

async function getMetrics(from: Date, to: Date) {
  const stale = new Date(Date.now() - DAY);
  const range = { gte: from, lte: to };
  const [newUsers, companyRegistrations, companyClosures, requests, published, offers, accepted, noOffer, activeSellers, openCases, failedBilling] = await Promise.all([
    prisma.user.count({ where: { createdAt: range, deletedAt: null } }),
    prisma.company.count({ where: { createdAt: range, deletedAt: null } }),
    prisma.company.count({ where: { deletedAt: range } }),
    prisma.request.count({ where: { createdAt: range, deletedAt: null } }),
    prisma.request.count({ where: { publishedAt: range, deletedAt: null } }),
    prisma.offer.count({ where: { createdAt: range } }),
    prisma.offer.count({ where: { acceptedAt: range } }),
    prisma.request.count({ where: { publishedAt: { lte: new Date(Math.min(to.getTime(), stale.getTime())), gte: from }, offerCount: 0, deletedAt: null, status: { in: ["PUBLISHED", "RECEIVING_OFFERS"] } } }),
    prisma.offer.groupBy({ by: ["submittedById"], where: { createdAt: range } }),
    prisma.moderationCase.count({ where: { status: { in: ["OPEN", "INVESTIGATING"] } } }),
    prisma.billingEvent.count({ where: { status: "FAILED", createdAt: range } }),
  ]);
  return { newUsers, companyRegistrations, companyClosures, requests, published, offers, accepted, acceptanceRate: offers ? Math.round((accepted / offers) * 1000) / 10 : 0, offerCoverage: published ? Math.round(((published - noOffer) / published) * 1000) / 10 : 100, noOffer, activeSellers: activeSellers.length, openCases, failedBilling };
}

async function getTrend(from: Date, to: Date) {
  const totalDays = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / DAY));
  const bucketDays = totalDays > 90 ? 7 : 1;
  const buckets = Array.from({ length: Math.ceil(totalDays / bucketDays) }, (_, index) => {
    const start = new Date(from.getTime() + index * bucketDays * DAY);
    const end = new Date(Math.min(to.getTime(), start.getTime() + bucketDays * DAY - 1));
    return { start, end };
  });
  return Promise.all(buckets.map(async ({ start, end }) => {
    const [newUsers, companyRegistrations, companyClosures, published, offers, accepted, failedBilling] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: start, lte: end }, deletedAt: null } }),
      prisma.company.count({ where: { createdAt: { gte: start, lte: end }, deletedAt: null } }),
      prisma.company.count({ where: { deletedAt: { gte: start, lte: end } } }),
      prisma.request.count({ where: { publishedAt: { gte: start, lte: end }, deletedAt: null } }),
      prisma.offer.count({ where: { createdAt: { gte: start, lte: end } } }),
      prisma.offer.count({ where: { acceptedAt: { gte: start, lte: end } } }),
      prisma.billingEvent.count({ where: { status: "FAILED", createdAt: { gte: start, lte: end } } }),
    ]);
    return { date: start.toISOString(), newUsers, companyRegistrations, companyClosures, published, offers, accepted, failedBilling };
  }));
}

export async function GET(request: Request) {
  try {
    const admin = await requirePlatformAdmin("analytics.view");
    assertMfaSession(request, admin.id);
    const url = new URL(request.url);
    const requestedDays = Number(url.searchParams.get("days") ?? "30");
    const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
    const defaultTo = new Date();
    const defaultFrom = new Date(defaultTo.getTime() - days * DAY);
    const from = parseDate(url.searchParams.get("from"), defaultFrom);
    const to = parseDate(url.searchParams.get("to"), defaultTo);
    const duration = Math.max(DAY, to.getTime() - from.getTime());
    const previousFrom = parseDate(url.searchParams.get("previousFrom"), new Date(from.getTime() - duration));
    const previousTo = parseDate(url.searchParams.get("previousTo"), new Date(from.getTime() - 1));
    const [metrics, previousMetrics, trend, categories] = await Promise.all([
      getMetrics(from, to),
      getMetrics(previousFrom, previousTo),
      getTrend(from, to),
      prisma.request.groupBy({ by: ["categoryId"], where: { publishedAt: { gte: from, lte: to }, deletedAt: null }, _count: { _all: true }, _sum: { offerCount: true }, orderBy: { _count: { categoryId: "desc" } }, take: 8 }),
    ]);
    const categoryRecords = await prisma.category.findMany({ where: { id: { in: categories.map((item) => item.categoryId) } }, select: { id: true, name: true } });
    const categoryNames = new Map(categoryRecords.map((category) => [category.id, category.name]));
    return NextResponse.json({
      ok: true,
      lastUpdatedAt: new Date().toISOString(),
      periodDays: days,
      period: { from: from.toISOString(), to: to.toISOString() },
      previousPeriod: { from: previousFrom.toISOString(), to: previousTo.toISOString() },
      metrics,
      previousMetrics,
      trend,
      categoryGaps: categories.map((item) => ({ categoryId: item.categoryId, categoryName: categoryNames.get(item.categoryId) ?? "Bilinmeyen kategori", requests: item._count._all, offers: item._sum.offerCount ?? 0, gap: Math.max(0, item._count._all - (item._sum.offerCount ?? 0)) })),
    });
  } catch (error) {
    console.error("[admin/health]", error);
    return NextResponse.json({ ok: false, message: "Sağlık metrikleri alınamadı." }, { status: 403 });
  }
}
