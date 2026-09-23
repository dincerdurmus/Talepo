import { NextResponse } from "next/server";
import { addOneCalendarMonth } from "@/server/request/public-visibility";

import { prisma } from "@/lib/prisma";
import { writeAdminAudit } from "@/server/admin/audit";
import {
  PlatformAuthorizationError,
  requirePlatformAdmin,
} from "@/server/auth/require-platform-admin";
import {
  AuthenticationError,
  DatabaseUnavailableError,
} from "@/server/auth/require-user";
import { getBuiltInCategoryById } from "@/lib/request-category-engine";

const OPEN_STATUSES = ["PUBLISHED", "RECEIVING_OFFERS"] as const;

class CategoryRouteError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly dependencies?: Record<string, number>,
  ) {
    super(message);
    this.name = "CategoryRouteError";
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requirePlatformAdmin("categories.manage");
    const { id } = await context.params;
    const body = await readJsonObject(request);
    const isActive = body.isActive;
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (typeof isActive !== "boolean") {
      return NextResponse.json({ ok: false, message: "Aktiflik durumu belirtilmedi." }, { status: 400 });
    }
    if (reason.length < 5) {
      return NextResponse.json({ ok: false, message: "Gerekçe en az 5 karakter olmalı." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.category.findUnique({
        where: { id },
        select: { id: true, name: true, isActive: true },
      });
      if (!current) throw new Error("CATEGORY_NOT_FOUND");
      if (current.isActive === isActive) return { category: current, paused: 0, restored: 0, expired: 0 };

      const category = await tx.category.update({
        where: { id },
        data: { isActive },
        select: { id: true, name: true, isActive: true },
      });
      let paused = 0;
      let restored = 0;
      let expired = 0;

      if (!isActive) {
        const changed = await tx.request.updateMany({
          where: {
            categoryId: id,
            deletedAt: null,
            status: { in: [...OPEN_STATUSES] },
            categoryPausedAt: null,
          },
          data: { categoryPausedAt: new Date() },
        });
        paused = changed.count;
      } else {
        const pausedRequests = await tx.request.findMany({
          where: { categoryId: id, categoryPausedAt: { not: null }, status: { in: [...OPEN_STATUSES] } },
          select: { id: true, publishedAt: true, expiresAt: true, createdAt: true },
        });
        const now = new Date();
        const restorable: string[] = [];
        const expiredIds: string[] = [];
        for (const item of pausedRequests) {
          const expiresAt = item.expiresAt ?? (item.publishedAt ? addOneCalendarMonth(item.publishedAt) : null);
          (expiresAt && expiresAt > now ? restorable : expiredIds).push(item.id);
        }
        if (restorable.length) {
          restored = (await tx.request.updateMany({ where: { id: { in: restorable } }, data: { categoryPausedAt: null } })).count;
        }
        if (expiredIds.length) {
          expired = (await tx.request.updateMany({ where: { id: { in: expiredIds } }, data: { categoryPausedAt: null, status: "EXPIRED" } })).count;
        }
      }

      await writeAdminAudit(tx, {
        actorId: admin.id,
        action: "CATEGORY_STATUS_CHANGED",
        reason,
        before: { categoryId: id, isActive: current.isActive },
        after: { categoryId: id, isActive, paused, restored, expired },
        metadata: { resourceType: "CATEGORY", categoryId: id, operation: isActive ? "ACTIVATE" : "ARCHIVE" },
        request,
      });
      return { category, paused, restored, expired };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof Error && error.message === "CATEGORY_NOT_FOUND") {
      return NextResponse.json({ ok: false, message: "Kategori bulunamadı." }, { status: 404 });
    }
    return categoryErrorResponse(error, "status", "Kategori durumu güncellenemedi.");
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requirePlatformAdmin("categories.manage");
    if (admin.platformRole !== "SUPER_ADMIN") {
      return NextResponse.json(
        { ok: false, message: "Kategoriyi kalıcı silme yetkisi yalnızca Süper Admin rolündedir." },
        { status: 403 },
      );
    }

    const { id } = await context.params;
    const body = await readJsonObject(request);
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (reason.length < 5) {
      return NextResponse.json(
        { ok: false, message: "Silme gerekçesi en az 5 karakter olmalı." },
        { status: 400 },
      );
    }

    const deletedCategoryId = await retryTransactionStart(() => prisma.$transaction(async (tx) => {
      const category = await tx.category.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          _count: {
            select: {
              requests: true,
              companyCategories: true,
              forms: true,
              suggestions: true,
              alertRules: true,
              inventoryItems: true,
              priceObservations: true,
            },
          },
        },
      });
      if (!category) throw new CategoryRouteError(404, "Kategori bulunamadı.");
      if (getBuiltInCategoryById(category.slug)) {
        throw new CategoryRouteError(
          409,
          "Yerleşik beyin kategorileri kalıcı silinemez; arşivleyebilirsiniz.",
        );
      }
      if (typeof body.confirmationName !== "string" || body.confirmationName !== category.name) {
        throw new CategoryRouteError(
          400,
          "Kalıcı silme için kategori adını birebir doğrulamanız gerekir.",
        );
      }

      const dependencies = {
        requests: category._count.requests,
        companies: category._count.companyCategories,
        forms: category._count.forms,
        suggestions: category._count.suggestions,
        alerts: category._count.alertRules,
        inventory: category._count.inventoryItems,
        priceObservations: category._count.priceObservations,
      };
      if (Object.values(dependencies).some((count) => count > 0)) {
        throw new CategoryRouteError(
          409,
          "Kategoriye bağlı kayıtlar bulunduğu için kalıcı silinemez; önce arşivleyin veya bağlantıları güvenli şekilde taşıyın.",
          dependencies,
        );
      }

      await writeAdminAudit(tx, {
        actorId: admin.id,
        action: "CATEGORY_STATUS_CHANGED",
        reason,
        before: { categoryId: category.id, name: category.name, slug: category.slug, isActive: category.isActive },
        after: { deleted: true },
        metadata: { resourceType: "CATEGORY", categoryId: category.id, operation: "DELETE", slug: category.slug },
        request,
      });
      await tx.category.delete({ where: { id: category.id } });
      return category.id;
    }, { isolationLevel: "Serializable" }));

    return NextResponse.json({ ok: true, deletedCategoryId });
  } catch (error) {
    return categoryErrorResponse(error, "delete", "Kategori kalıcı olarak silinemedi.");
  }
}

function categoryErrorResponse(error: unknown, operation: string, fallbackMessage: string) {
  if (error instanceof AuthenticationError) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
  }
  if (error instanceof PlatformAuthorizationError) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 403 });
  }
  if (error instanceof DatabaseUnavailableError) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 503 });
  }
  if (error instanceof CategoryRouteError) {
    return NextResponse.json(
      { ok: false, message: error.message, ...(error.dependencies ? { dependencies: error.dependencies } : {}) },
      { status: error.status },
    );
  }
  console.error(`[admin/categories] ${operation}`, error);
  return NextResponse.json({ ok: false, message: fallbackMessage }, { status: 500 });
}

async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const value = await request.json().catch(() => null);
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

async function retryTransactionStart<T>(operation: () => Promise<T>): Promise<T> {
  const delays = [250, 750];
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error
        ? (error as { code?: unknown }).code
        : null;
      const message = error instanceof Error ? error.message : "";
      if (code !== "P2028" || !message.includes("Unable to start a transaction") || attempt >= delays.length) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
    }
  }
}
