import { NextResponse } from "next/server";

import { entitlementErrorResponse } from "@/lib/api/entitlement-response";
import { criteriaFromAlertRule, normalizePreferenceCriteria, preferenceCriteriaFingerprint } from "@/lib/monetization/preference-criteria";
import type { SavedSearchFilters } from "@/lib/monetization/types";
import {
  ownerCreateData,
  ownerScopeWhere,
  requireResourceOwnerFeature,
} from "@/lib/membership/resource-owner";
import { prisma } from "@/lib/prisma";
import { AuthenticationError, requireUser } from "@/server/auth/require-user";

export async function GET() {
  try {
    const user = await requireUser();
    const ctx = await requireResourceOwnerFeature(user.id, "saved_searches");

    const searches = await prisma.savedSearch.findMany({
      where: ownerScopeWhere(ctx),
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({
      ok: true,
      searches: searches.map((search) => ({
        ...search,
        criteriaFingerprint: preferenceCriteriaFingerprint(
          search.filters as SavedSearchFilters,
        ),
      })),
    });
  } catch (error) {
    const ent = entitlementErrorResponse(error);
    if (ent) return ent;
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    }
    return NextResponse.json({ ok: false, message: "Kayıtlar alınamadı." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const ctx = await requireResourceOwnerFeature(user.id, "saved_searches");
    const body = (await request.json()) as {
      action?: string;
      id?: string;
      name?: string;
      filters?: SavedSearchFilters;
      isActive?: boolean;
      // Client ownership fields are ignored (server-authoritative)
      ownerType?: unknown;
      userId?: unknown;
      companyId?: unknown;
    };

    if (body.action === "create") {
      const name = body.name?.trim();
      if (!name || !body.filters) {
        return NextResponse.json(
          { ok: false, message: "Ad ve filtre zorunlu." },
          { status: 400 },
        );
      }
      const normalized = normalizePreferenceCriteria(body.filters);
      if (!normalized.ok) {
        return NextResponse.json(
          { ok: false, message: normalized.message },
          { status: 400 },
        );
      }
      const search = await prisma.savedSearch.create({
        data: {
          ...ownerCreateData(ctx),
          name,
          filters: normalized.filters,
        },
      });
      return NextResponse.json({ ok: true, search });
    }

    if (body.action === "delete" && body.id) {
      const existing = await prisma.savedSearch.findFirst({
        where: { id: body.id, ...ownerScopeWhere(ctx) },
      });
      if (existing) {
        const fingerprint = preferenceCriteriaFingerprint(
          existing.filters as SavedSearchFilters,
        );
        const relatedAlerts = await prisma.alertRule.findMany({
          where: ownerScopeWhere(ctx),
          select: {
            id: true,
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
        const matchingIds = relatedAlerts
          .filter((rule) => {
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
          })
          .map((rule) => rule.id);
        if (matchingIds.length > 0) {
          await prisma.alertRule.deleteMany({
            where: { id: { in: matchingIds }, ...ownerScopeWhere(ctx) },
          });
        }
      }
      await prisma.savedSearch.deleteMany({
        where: { id: body.id, ...ownerScopeWhere(ctx) },
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "update" && body.id) {
      let filtersUpdate: SavedSearchFilters | undefined;
      if (body.filters) {
        const normalized = normalizePreferenceCriteria(body.filters);
        if (!normalized.ok) {
          return NextResponse.json(
            { ok: false, message: normalized.message },
            { status: 400 },
          );
        }
        filtersUpdate = normalized.filters;
      }
      await prisma.savedSearch.updateMany({
        where: { id: body.id, ...ownerScopeWhere(ctx) },
        data: {
          ...(body.name ? { name: body.name.trim() } : {}),
          ...(filtersUpdate ? { filters: filtersUpdate } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        },
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
    return NextResponse.json({ ok: false, message: "Kayıt işlenemedi." }, { status: 500 });
  }
}
