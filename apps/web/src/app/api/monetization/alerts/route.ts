import { NextResponse } from "next/server";

import { entitlementErrorResponse } from "@/lib/api/entitlement-response";
import { validateCanonicalDiscoveryFilter } from "@/lib/discovery";
import { validateAlertRuleAttributes } from "@/lib/monetization/alert-rule-attributes";
import { requireCompanyFeature } from "@/lib/membership/require-company-feature";
import { prisma } from "@/lib/prisma";
import { AuthenticationError, requireUser } from "@/server/auth/require-user";
import type { Prisma } from "@/generated/prisma/client";
import { Prisma as PrismaRuntime } from "@/generated/prisma/client";

async function resolveCategorySlug(categoryId: string | null | undefined) {
  if (!categoryId) return null;
  const cat = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { slug: true },
  });
  return cat?.slug ?? null;
}

export async function GET() {
  try {
    const user = await requireUser();
    const ctx = await requireCompanyFeature(user.id, "smart_alerts");

    const rules = await prisma.alertRule.findMany({
      where: { companyId: ctx.companyId },
      orderBy: { updatedAt: "desc" },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });

    return NextResponse.json({ ok: true, rules });
  } catch (error) {
    const ent = entitlementErrorResponse(error);
    if (ent) return ent;
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    }
    console.error("[alert-rules-v2]", error);
    return NextResponse.json({ ok: false, message: "Kurallar alınamadı." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const ctx = await requireCompanyFeature(user.id, "smart_alerts");
    const body = (await request.json()) as {
      action?: string;
      id?: string;
      name?: string;
      categoryId?: string | null;
      city?: string | null;
      district?: string | null;
      minBudget?: number | null;
      maxBudget?: number | null;
      keywords?: string | null;
      attributes?: Record<string, string> | null;
      discoveryFilter?: unknown;
      isActive?: boolean;
    };

    if (body.action === "create") {
      const name = body.name?.trim();
      if (!name) {
        return NextResponse.json({ ok: false, message: "Kural adı zorunlu." }, { status: 400 });
      }

      const categorySlug = await resolveCategorySlug(body.categoryId);
      const attrCheck = validateAlertRuleAttributes(categorySlug, body.attributes);
      if (!attrCheck.ok) {
        return NextResponse.json({ ok: false, message: attrCheck.message }, { status: 400 });
      }

      let discoveryFilter: Prisma.InputJsonValue | undefined;
      if (body.discoveryFilter !== undefined && body.discoveryFilter !== null) {
        const canonical = validateCanonicalDiscoveryFilter(body.discoveryFilter);
        if (!canonical.ok) {
          return NextResponse.json(
            { ok: false, message: canonical.errors[0] ?? "Geçersiz discovery filter." },
            { status: 400 },
          );
        }
        discoveryFilter = canonical.filter as unknown as Prisma.InputJsonValue;
      }

      const rule = await prisma.alertRule.create({
        data: {
          companyId: ctx.companyId,
          name,
          categoryId: body.categoryId || null,
          city: body.city?.trim() || null,
          district: body.district?.trim() || null,
          minBudget: body.minBudget ?? null,
          maxBudget: body.maxBudget ?? null,
          keywords: body.keywords?.trim() || null,
          ...(attrCheck.value ? { attributes: attrCheck.value } : {}),
          ...(discoveryFilter ? { discoveryFilter } : {}),
        },
      });
      return NextResponse.json({ ok: true, rule });
    }

    if (body.action === "update" && body.id) {
      const existing = await prisma.alertRule.findFirst({
        where: { id: body.id, companyId: ctx.companyId },
      });
      if (!existing) {
        return NextResponse.json({ ok: false, message: "Kural bulunamadı." }, { status: 404 });
      }

      const categoryId =
        body.categoryId !== undefined ? body.categoryId : existing.categoryId;
      const categorySlug = await resolveCategorySlug(categoryId);
      const attrCheck =
        body.attributes !== undefined
          ? validateAlertRuleAttributes(categorySlug, body.attributes)
          : { ok: true as const, value: undefined };

      if (!attrCheck.ok) {
        return NextResponse.json({ ok: false, message: attrCheck.message }, { status: 400 });
      }

      let discoveryFilterUpdate:
        | Prisma.InputJsonValue
        | typeof PrismaRuntime.JsonNull
        | undefined;
      if (body.discoveryFilter !== undefined) {
        if (body.discoveryFilter === null) {
          discoveryFilterUpdate = PrismaRuntime.JsonNull;
        } else {
          const canonical = validateCanonicalDiscoveryFilter(body.discoveryFilter);
          if (!canonical.ok) {
            return NextResponse.json(
              { ok: false, message: canonical.errors[0] ?? "Geçersiz discovery filter." },
              { status: 400 },
            );
          }
          discoveryFilterUpdate = canonical.filter as unknown as Prisma.InputJsonValue;
        }
      }

      const updateData: Prisma.AlertRuleUncheckedUpdateManyInput = {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.categoryId !== undefined
          ? { categoryId: body.categoryId || null }
          : {}),
        ...(body.city !== undefined ? { city: body.city?.trim() || null } : {}),
        ...(body.district !== undefined ? { district: body.district?.trim() || null } : {}),
        ...(body.minBudget !== undefined ? { minBudget: body.minBudget } : {}),
        ...(body.maxBudget !== undefined ? { maxBudget: body.maxBudget } : {}),
        ...(body.keywords !== undefined ? { keywords: body.keywords?.trim() || null } : {}),
        ...(body.attributes !== undefined
          ? {
              attributes:
                attrCheck.ok && attrCheck.value != null
                  ? attrCheck.value
                  : PrismaRuntime.JsonNull,
            }
          : {}),
        ...(discoveryFilterUpdate !== undefined
          ? { discoveryFilter: discoveryFilterUpdate }
          : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      };

      const updated = await prisma.alertRule.updateMany({
        where: { id: body.id, companyId: ctx.companyId },
        data: updateData,
      });

      if (updated.count === 0) {
        return NextResponse.json({ ok: false, message: "Kural bulunamadı." }, { status: 404 });
      }

      const rule = await prisma.alertRule.findFirst({
        where: { id: body.id, companyId: ctx.companyId },
      });
      return NextResponse.json({ ok: true, rule });
    }

    if (body.action === "delete" && body.id) {
      await prisma.alertRule.deleteMany({
        where: { id: body.id, companyId: ctx.companyId },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, message: "Geçersiz işlem." }, { status: 400 });
  } catch (error) {
    const ent = entitlementErrorResponse(error);
    if (ent) return ent;
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    }
    return NextResponse.json({ ok: false, message: "Kural kaydedilemedi." }, { status: 500 });
  }
}
