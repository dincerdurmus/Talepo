import { NextResponse } from "next/server";

import {
  PlatformAuthorizationError,
  requirePlatformAdmin,
} from "@/server/auth/require-platform-admin";
import {
  AuthenticationError,
  DatabaseUnavailableError,
} from "@/server/auth/require-user";
import { prisma } from "@/lib/prisma";
import { writeAdminAudit } from "@/server/admin/audit";
import { getBuiltInCategoryById } from "@/lib/request-category-engine";

export async function GET() {
  try {
    await requirePlatformAdmin("categories.manage");
    const categories = await prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        isActive: true,
        sortOrder: true,
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
    return NextResponse.json({ ok: true, categories: categories.map((category) => ({ ...category, isBuiltIn: Boolean(getBuiltInCategoryById(category.slug)) })) });
  } catch (error) {
    return categoryErrorResponse(error, "Kategoriler alınamadı.");
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requirePlatformAdmin("categories.manage");
    const body = await readJsonObject(request);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const requestedSlug = typeof body.slug === "string" ? body.slug.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const slug = normalizeSlug(requestedSlug || name);
    if (name.length < 2 || name.length > 80) {
      return NextResponse.json({ ok: false, message: "Kategori adı 2-80 karakter olmalı." }, { status: 400 });
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return NextResponse.json({ ok: false, message: "Slug yalnızca küçük harf, sayı ve tire içerebilir." }, { status: 400 });
    }
    const existing = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
    if (existing) return NextResponse.json({ ok: false, message: "Bu slug zaten kullanılıyor." }, { status: 409 });

    const category = await prisma.$transaction(async (tx) => {
      const last = await tx.category.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
      const created = await tx.category.create({
        data: {
          name,
          slug,
          description: description || null,
          sortOrder: (last?.sortOrder ?? 0) + 1,
          isActive: true,
        },
        select: { id: true, name: true, slug: true, description: true, isActive: true, sortOrder: true },
      });
      await writeAdminAudit(tx, {
        actorId: admin.id,
        action: "CATEGORY_STATUS_CHANGED",
        reason: `Kategori oluşturuldu: ${name}`,
        metadata: { resourceType: "CATEGORY", categoryId: created.id, operation: "CREATE", slug },
        request,
      });
      return created;
    });
    return NextResponse.json({ ok: true, category }, { status: 201 });
  } catch (error) {
    return categoryErrorResponse(error, "Kategori oluşturulamadı.");
  }
}

function categoryErrorResponse(error: unknown, fallbackMessage: string) {
  if (error instanceof AuthenticationError) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
  }
  if (error instanceof PlatformAuthorizationError) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 403 });
  }
  if (error instanceof DatabaseUnavailableError) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 503 });
  }
  console.error("[admin/categories]", error);
  return NextResponse.json({ ok: false, message: fallbackMessage }, { status: 500 });
}

function normalizeSlug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const value = await request.json().catch(() => null);
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
