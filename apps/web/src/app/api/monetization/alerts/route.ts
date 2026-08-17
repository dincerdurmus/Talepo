import { NextResponse } from "next/server";

import { entitlementErrorResponse } from "@/lib/api/entitlement-response";
import { validateCanonicalDiscoveryFilter } from "@/lib/discovery";
import { validateAlertRuleAttributes } from "@/lib/monetization/alert-rule-attributes";
import {
  criteriaFromAlertRule,
  criteriaToAlertRuleColumns,
  normalizePreferenceCriteria,
  preferenceCriteriaFingerprint,
  validateBudgetRange,
} from "@/lib/monetization/preference-criteria";
import type { SavedSearchFilters } from "@/lib/monetization/types";
import {
  ownerCreateData,
  ownerScopeWhere,
  requireResourceOwnerFeature,
  type ResourceOwnerContext,
} from "@/lib/membership/resource-owner";
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

async function resolveCategoryId(slug: string | null | undefined) {
  const raw = slug?.trim();
  if (!raw) return null;
  const cat = await prisma.category.findUnique({
    where: { slug: raw.replace(/^tax:/, "").split(":")[0]! },
    select: { id: true },
  });
  return cat?.id ?? null;
}

function criteriaFromBody(input: {
  categorySlug: string | null;
  city?: string | null;
  district?: string | null;
  minBudget?: number | null;
  maxBudget?: number | null;
  keywords?: string | null;
  attributes?: Record<string, string> | null;
  discoveryFilter?: unknown;
}):
  | { ok: true; filters: SavedSearchFilters }
  | { ok: false; message: string } {
  const budget = validateBudgetRange(input.minBudget, input.maxBudget);
  if (!budget.ok) return budget;

  if (input.discoveryFilter !== undefined && input.discoveryFilter !== null) {
    const canonical = validateCanonicalDiscoveryFilter(input.discoveryFilter);
    if (!canonical.ok) {
      return {
        ok: false,
        message: canonical.errors[0] ?? "Geçersiz discovery filter.",
      };
    }
  }

  return normalizePreferenceCriteria({
    version: 1,
    categorySlug: input.categorySlug ?? undefined,
    city: input.city ?? undefined,
    district: input.district ?? undefined,
    budgetMin: input.minBudget ?? undefined,
    budgetMax: input.maxBudget ?? undefined,
    keyword: input.keywords ?? undefined,
    attributes: input.attributes ?? undefined,
    canonical: input.discoveryFilter as SavedSearchFilters["canonical"],
  });
}

async function findDuplicateActiveAlert(
  ctx: ResourceOwnerContext,
  fingerprint: string,
  excludeId?: string,
) {
  const rules = await prisma.alertRule.findMany({
    where: {
      ...ownerScopeWhere(ctx),
      isActive: true,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: {
      id: true,
      name: true,
      city: true,
      district: true,
      minBudget: true,
      maxBudget: true,
      keywords: true,
      attributes: true,
      discoveryFilter: true,
      category: { select: { slug: true } },
    },
    take: 200,
  });

  return (
    rules.find((rule) => {
      const criteria = criteriaFromAlertRule({
        categorySlug: rule.category?.slug,
        city: rule.city,
        district: rule.district,
        minBudget: rule.minBudget,
        maxBudget: rule.maxBudget,
        keywords: rule.keywords,
        attributes: rule.attributes,
        discoveryFilter: rule.discoveryFilter,
      });
      return preferenceCriteriaFingerprint(criteria) === fingerprint;
    }) ?? null
  );
}

export async function GET() {
  try {
    const user = await requireUser();
    const ctx = await requireResourceOwnerFeature(user.id, "smart_alerts");

    const rules = await prisma.alertRule.findMany({
      where: ownerScopeWhere(ctx),
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
    const ctx = await requireResourceOwnerFeature(user.id, "smart_alerts");
    const body = (await request.json()) as {
      action?: string;
      id?: string;
      savedSearchId?: string;
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
      // Client ownership fields are ignored (server-authoritative)
      ownerType?: unknown;
      userId?: unknown;
      companyId?: unknown;
    };

    if (body.action === "createFromSavedSearch" && body.savedSearchId) {
      const search = await prisma.savedSearch.findFirst({
        where: { id: body.savedSearchId, ...ownerScopeWhere(ctx) },
      });
      if (!search) {
        return NextResponse.json(
          { ok: false, message: "Kayıtlı arama bulunamadı." },
          { status: 404 },
        );
      }

      const normalized = normalizePreferenceCriteria(
        search.filters as SavedSearchFilters,
      );
      if (!normalized.ok) {
        return NextResponse.json(
          { ok: false, message: normalized.message },
          { status: 400 },
        );
      }

      const fingerprint = preferenceCriteriaFingerprint(normalized.filters);
      const duplicate = await findDuplicateActiveAlert(ctx, fingerprint);
      if (duplicate) {
        const rule = await prisma.alertRule.findFirst({
          where: { id: duplicate.id, ...ownerScopeWhere(ctx) },
          include: { category: { select: { id: true, name: true, slug: true } } },
        });
        return NextResponse.json({
          ok: true,
          alreadyExists: true,
          rule,
        });
      }

      const columns = criteriaToAlertRuleColumns(normalized.filters);
      const categoryId = await resolveCategoryId(columns.categorySlug);
      const categorySlug = columns.categorySlug;
      const attrCheck = validateAlertRuleAttributes(
        categorySlug,
        columns.attributes as Record<string, string> | null,
      );
      if (!attrCheck.ok) {
        return NextResponse.json({ ok: false, message: attrCheck.message }, { status: 400 });
      }

      const rule = await prisma.alertRule.create({
        data: {
          ...ownerCreateData(ctx),
          name: search.name,
          categoryId,
          city: columns.city,
          district: columns.district,
          minBudget: columns.minBudget,
          maxBudget: columns.maxBudget,
          keywords: columns.keywords,
          ...(attrCheck.value ? { attributes: attrCheck.value } : {}),
          ...(columns.discoveryFilter
            ? {
                discoveryFilter:
                  columns.discoveryFilter as unknown as Prisma.InputJsonValue,
              }
            : {}),
        },
        include: { category: { select: { id: true, name: true, slug: true } } },
      });
      return NextResponse.json({ ok: true, alreadyExists: false, rule });
    }

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

      const normalized = criteriaFromBody({
        categorySlug,
        city: body.city,
        district: body.district,
        minBudget: body.minBudget,
        maxBudget: body.maxBudget,
        keywords: body.keywords,
        attributes: body.attributes,
        discoveryFilter: body.discoveryFilter,
      });
      if (!normalized.ok) {
        return NextResponse.json({ ok: false, message: normalized.message }, { status: 400 });
      }

      const fingerprint = preferenceCriteriaFingerprint(normalized.filters);
      const duplicate = await findDuplicateActiveAlert(ctx, fingerprint);
      if (duplicate) {
        return NextResponse.json(
          {
            ok: false,
            alreadyExists: true,
            message: "Bu kriterler için zaten aktif bir alarm var.",
            ruleId: duplicate.id,
          },
          { status: 409 },
        );
      }

      const columns = criteriaToAlertRuleColumns(normalized.filters);
      const rule = await prisma.alertRule.create({
        data: {
          ...ownerCreateData(ctx),
          name,
          categoryId: body.categoryId || null,
          city: columns.city,
          district: columns.district,
          minBudget: columns.minBudget,
          maxBudget: columns.maxBudget,
          keywords: columns.keywords,
          ...(attrCheck.value ? { attributes: attrCheck.value } : {}),
          ...(columns.discoveryFilter
            ? {
                discoveryFilter:
                  columns.discoveryFilter as unknown as Prisma.InputJsonValue,
              }
            : {}),
        },
      });
      return NextResponse.json({ ok: true, rule });
    }

    if (body.action === "update" && body.id) {
      const existing = await prisma.alertRule.findFirst({
        where: { id: body.id, ...ownerScopeWhere(ctx) },
      });
      if (!existing) {
        return NextResponse.json({ ok: false, message: "Kural bulunamadı." }, { status: 404 });
      }

      const criteriaTouched =
        body.categoryId !== undefined ||
        body.city !== undefined ||
        body.district !== undefined ||
        body.minBudget !== undefined ||
        body.maxBudget !== undefined ||
        body.keywords !== undefined ||
        body.attributes !== undefined ||
        body.discoveryFilter !== undefined;

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

      let columns:
        | ReturnType<typeof criteriaToAlertRuleColumns>
        | undefined;
      if (criteriaTouched) {
        const merged = criteriaFromAlertRule({
          categorySlug,
          city: body.city !== undefined ? body.city : existing.city,
          district: body.district !== undefined ? body.district : existing.district,
          minBudget: body.minBudget !== undefined ? body.minBudget : existing.minBudget,
          maxBudget: body.maxBudget !== undefined ? body.maxBudget : existing.maxBudget,
          keywords: body.keywords !== undefined ? body.keywords : existing.keywords,
          attributes:
            body.attributes !== undefined ? body.attributes : existing.attributes,
          discoveryFilter:
            body.discoveryFilter !== undefined
              ? body.discoveryFilter
              : existing.discoveryFilter,
        });
        const normalized = normalizePreferenceCriteria(merged);
        if (!normalized.ok) {
          return NextResponse.json(
            { ok: false, message: normalized.message },
            { status: 400 },
          );
        }
        const fingerprint = preferenceCriteriaFingerprint(normalized.filters);
        const duplicate = await findDuplicateActiveAlert(ctx, fingerprint, body.id);
        if (duplicate && (body.isActive === undefined || body.isActive)) {
          return NextResponse.json(
            {
              ok: false,
              alreadyExists: true,
              message: "Bu kriterler için zaten aktif bir alarm var.",
              ruleId: duplicate.id,
            },
            { status: 409 },
          );
        }
        columns = criteriaToAlertRuleColumns(normalized.filters);
      }

      const updateData: Prisma.AlertRuleUncheckedUpdateManyInput = {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.categoryId !== undefined
          ? { categoryId: body.categoryId || null }
          : {}),
        ...(columns
          ? {
              city: columns.city,
              district: columns.district,
              minBudget: columns.minBudget,
              maxBudget: columns.maxBudget,
              keywords: columns.keywords,
              discoveryFilter: columns.discoveryFilter
                ? (columns.discoveryFilter as unknown as Prisma.InputJsonValue)
                : PrismaRuntime.JsonNull,
            }
          : {}),
        ...(body.attributes !== undefined
          ? {
              attributes:
                attrCheck.ok && attrCheck.value != null
                  ? attrCheck.value
                  : PrismaRuntime.JsonNull,
            }
          : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      };

      const updated = await prisma.alertRule.updateMany({
        where: { id: body.id, ...ownerScopeWhere(ctx) },
        data: updateData,
      });

      if (updated.count === 0) {
        return NextResponse.json({ ok: false, message: "Kural bulunamadı." }, { status: 404 });
      }

      const rule = await prisma.alertRule.findFirst({
        where: { id: body.id, ...ownerScopeWhere(ctx) },
      });
      return NextResponse.json({ ok: true, rule });
    }

    if (body.action === "delete" && body.id) {
      await prisma.alertRule.deleteMany({
        where: { id: body.id, ...ownerScopeWhere(ctx) },
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
