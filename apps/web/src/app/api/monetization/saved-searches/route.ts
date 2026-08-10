import { NextResponse } from "next/server";

import { entitlementErrorResponse } from "@/lib/api/entitlement-response";
import type { SavedSearchFilters } from "@/lib/monetization/types";
import { requireCompanyFeature } from "@/lib/membership/require-company-feature";
import { prisma } from "@/lib/prisma";
import { AuthenticationError, requireUser } from "@/server/auth/require-user";

export async function GET() {
  try {
    const user = await requireUser();
    const ctx = await requireCompanyFeature(user.id, "saved_searches");

    const searches = await prisma.savedSearch.findMany({
      where: { companyId: ctx.companyId },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ ok: true, searches });
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
    const ctx = await requireCompanyFeature(user.id, "saved_searches");
    const body = (await request.json()) as {
      action?: string;
      id?: string;
      name?: string;
      filters?: SavedSearchFilters;
      isActive?: boolean;
    };

    if (body.action === "create") {
      const name = body.name?.trim();
      if (!name || !body.filters) {
        return NextResponse.json(
          { ok: false, message: "Ad ve filtre zorunlu." },
          { status: 400 },
        );
      }
      const search = await prisma.savedSearch.create({
        data: {
          companyId: ctx.companyId,
          name,
          filters: body.filters,
        },
      });
      return NextResponse.json({ ok: true, search });
    }

    if (body.action === "delete" && body.id) {
      await prisma.savedSearch.deleteMany({
        where: { id: body.id, companyId: ctx.companyId },
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "update" && body.id) {
      await prisma.savedSearch.updateMany({
        where: { id: body.id, companyId: ctx.companyId },
        data: {
          ...(body.name ? { name: body.name.trim() } : {}),
          ...(body.filters ? { filters: body.filters } : {}),
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
