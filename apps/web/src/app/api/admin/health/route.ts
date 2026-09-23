import { countBillingEntitlementDrift } from "@/server/billing/reconcile";
import { NextResponse } from "next/server";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { assertMfaSession } from "@/server/admin/mfa";
import {
  PlatformAuthorizationError,
  requirePlatformAdmin,
} from "@/server/auth/require-platform-admin";
import {
  AuthenticationError,
  DatabaseUnavailableError,
} from "@/server/auth/require-user";

const DAY = 86_400_000;
const REQUEST_STATUSES = ["DRAFT", "PUBLISHED", "RECEIVING_OFFERS", "OFFER_SELECTED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "EXPIRED"] as const;

type RequestFilters = { city: string; requestStatus: (typeof REQUEST_STATUSES)[number] | null };

function parseDate(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function requestScope(filters: RequestFilters) {
  return {
    deletedAt: null,
    ...(filters.city ? { city: { equals: filters.city, mode: "insensitive" as const } } : {}),
    ...(filters.requestStatus ? { status: filters.requestStatus } : {}),
  };
}

async function getMetrics(db: Prisma.TransactionClient, from: Date, to: Date, filters: RequestFilters) {
  const stale = new Date(Date.now() - DAY);
  const range = { gte: from, lte: to };
  const scope = requestScope(filters);
  // Keep the read workload on one transaction connection. The deployment uses
  // a deliberately small direct-DB pool and a wide Promise.all can starve writes.
  const newUsers = await db.user.count({ where: { createdAt: range, deletedAt: null } });
  const companyRegistrations = await db.company.count({ where: { createdAt: range, deletedAt: null } });
  const companyClosures = await db.company.count({ where: { deletedAt: range } });
  const requests = await db.request.count({ where: { createdAt: range, ...scope } });
  const published = await db.request.count({ where: { publishedAt: range, ...scope } });
  const offers = await db.offer.count({ where: { createdAt: range, request: scope } });
  const accepted = await db.offer.count({ where: { acceptedAt: range, request: scope } });
  const noOffer = await db.request.count({ where: { ...scope, publishedAt: { lte: new Date(Math.min(to.getTime(), stale.getTime())), gte: from }, offerCount: 0, status: filters.requestStatus ?? { in: ["PUBLISHED", "RECEIVING_OFFERS"] } } });
  const activeSellers = await db.offer.groupBy({ by: ["submittedById"], where: { createdAt: range, request: scope } });
  const openCases = await db.moderationCase.count({ where: { status: { in: ["OPEN", "INVESTIGATING"] } } });
  const failedBilling = await db.billingEvent.count({ where: { status: "FAILED", createdAt: range } });
  const zeroReach = await db.request.count({
    where: {
      ...scope,
      status: { in: ["PUBLISHED", "RECEIVING_OFFERS"] },
      publishedAt: { gte: from, lte: new Date(Math.min(to.getTime(), Date.now() - 10 * 60_000)) },
      matches: { none: {} },
    },
  });
  return { newUsers, companyRegistrations, companyClosures, requests, published, offers, accepted, acceptanceRate: offers ? Math.round((accepted / offers) * 1000) / 10 : 0, offerCoverage: published ? Math.round(((published - noOffer) / published) * 1000) / 10 : 100, noOffer, activeSellers: activeSellers.length, openCases, failedBilling, zeroReach };
}

async function getTrend(db: Prisma.TransactionClient, from: Date, to: Date, filters: RequestFilters) {
  const totalDays = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / DAY));
  const bucketDays = totalDays > 90 ? 7 : 1;
  const scope = requestScope(filters);
  const buckets = Array.from({ length: Math.ceil(totalDays / bucketDays) }, (_, index) => {
    const start = new Date(from.getTime() + index * bucketDays * DAY);
    const end = new Date(Math.min(to.getTime(), start.getTime() + bucketDays * DAY - 1));
    return { start, end };
  });
  const points = buckets.map(({ start }) => ({
    date: start.toISOString(),
    newUsers: 0,
    companyRegistrations: 0,
    companyClosures: 0,
    published: 0,
    offers: 0,
    accepted: 0,
    failedBilling: 0,
  }));
  const range = { gte: from, lte: to };
  const users = await db.user.findMany({ where: { createdAt: range, deletedAt: null }, select: { createdAt: true } });
  const companyRegistrations = await db.company.findMany({ where: { createdAt: range, deletedAt: null }, select: { createdAt: true } });
  const companyClosures = await db.company.findMany({ where: { deletedAt: range }, select: { deletedAt: true } });
  const requests = await db.request.findMany({ where: { publishedAt: range, ...scope }, select: { publishedAt: true } });
  const offers = await db.offer.findMany({
    where: { request: scope, OR: [{ createdAt: range }, { acceptedAt: range }] },
    select: { createdAt: true, acceptedAt: true },
  });
  const failedBilling = await db.billingEvent.findMany({ where: { status: "FAILED", createdAt: range }, select: { createdAt: true } });

  const increment = (date: Date | null, key: Exclude<keyof (typeof points)[number], "date">) => {
    if (!date || date < from || date > to) return;
    const index = Math.min(points.length - 1, Math.max(0, Math.floor((date.getTime() - from.getTime()) / (bucketDays * DAY))));
    points[index][key] += 1;
  };
  users.forEach((item) => increment(item.createdAt, "newUsers"));
  companyRegistrations.forEach((item) => increment(item.createdAt, "companyRegistrations"));
  companyClosures.forEach((item) => increment(item.deletedAt, "companyClosures"));
  requests.forEach((item) => increment(item.publishedAt, "published"));
  offers.forEach((item) => {
    increment(item.createdAt, "offers");
    increment(item.acceptedAt, "accepted");
  });
  failedBilling.forEach((item) => increment(item.createdAt, "failedBilling"));
  return points;
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
    const requestStatus = url.searchParams.get("requestStatus");
    const filters: RequestFilters = {
      city: (url.searchParams.get("city") ?? "").trim().slice(0, 80),
      requestStatus: REQUEST_STATUSES.includes(requestStatus as typeof REQUEST_STATUSES[number]) ? requestStatus as typeof REQUEST_STATUSES[number] : null,
    };
    const result = await prisma.$transaction(async (tx) => {
      const scope = requestScope(filters);
      const metrics = await getMetrics(tx, from, to, filters);
      const previousMetrics = await getMetrics(tx, previousFrom, previousTo, filters);
      const trend = await getTrend(tx, from, to, filters);
      const categories = await tx.request.groupBy({ by: ["categoryId"], where: { publishedAt: { gte: from, lte: to }, ...scope }, _count: { _all: true }, _sum: { offerCount: true }, orderBy: { _count: { categoryId: "desc" } }, take: 8 });
      const categoryRecords = await tx.category.findMany({ where: { id: { in: categories.map((item) => item.categoryId) } }, select: { id: true, name: true } });
      return { metrics, previousMetrics, trend, categories, categoryRecords };
    }, { isolationLevel: "ReadCommitted", maxWait: 5_000, timeout: 20_000 });
    // Current billing drift is measured once, outside the historical snapshot.
    // A failed scan must not remove the other health metrics or imply zero drift.
    const drift = await countBillingEntitlementDrift().catch((error) => {
      console.error("[admin/health] billing drift scan failed:", error);
      return null;
    });
    const categoryNames = new Map(result.categoryRecords.map((category) => [category.id, category.name]));
    return NextResponse.json({
      ok: true,
      lastUpdatedAt: new Date().toISOString(),
      periodDays: days,
      period: { from: from.toISOString(), to: to.toISOString() },
      previousPeriod: { from: previousFrom.toISOString(), to: previousTo.toISOString() },
      filters,
      metrics: {
        ...result.metrics,
        billingDrift: drift ? drift.drifting : -1,
        billingDriftScanned: drift ? drift.scanned : -1,
        billingDriftTruncated: drift ? (drift.truncated ? 1 : 0) : -1,
      },
      previousMetrics: result.previousMetrics,
      trend: result.trend,
      categoryGaps: result.categories.map((item) => ({ categoryId: item.categoryId, categoryName: categoryNames.get(item.categoryId) ?? "Bilinmeyen kategori", requests: item._count._all, offers: item._sum.offerCount ?? 0, gap: Math.max(0, item._count._all - (item._sum.offerCount ?? 0)) })),
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    }
    if (error instanceof PlatformAuthorizationError || (error instanceof Error && error.message === "ADMIN_MFA_REQUIRED")) {
      return NextResponse.json({ ok: false, message: "Sağlık metrikleri için yönetici doğrulaması gerekiyor." }, { status: 403 });
    }
    if (error instanceof DatabaseUnavailableError || isDatabaseCapacityError(error)) {
      console.warn("[admin/health] database capacity temporarily unavailable");
      return NextResponse.json(
        { ok: false, message: "Sağlık metrikleri geçici olarak kullanılamıyor. Lütfen tekrar deneyin." },
        { status: 503, headers: { "Retry-After": "3" } },
      );
    }
    console.error("[admin/health]", error);
    return NextResponse.json({ ok: false, message: "Sağlık metrikleri alınamadı." }, { status: 500 });
  }
}

function isDatabaseCapacityError(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error
    ? (error as { code?: unknown }).code
    : null;
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return code === "P2024" || code === "P2028" || message.includes("timeout exceeded when trying to connect");
}
