import { NextResponse } from "next/server";

import { entitlementErrorResponse } from "@/lib/api/entitlement-response";
import { requireCompanyFeature } from "@/lib/membership/require-company-feature";
import { prisma } from "@/lib/prisma";
import { AuthenticationError, requireUser } from "@/server/auth/require-user";

export async function GET() {
  try {
    const user = await requireUser();
    const ctx = await requireCompanyFeature(user.id, "watchlist");

    const items = await prisma.opportunityWatchlistItem.findMany({
      where: { companyId: ctx.companyId },
      orderBy: { createdAt: "desc" },
      include: {
        request: {
          select: {
            id: true,
            title: true,
            status: true,
            city: true,
            isUrgent: true,
            budgetMin: true,
            budgetMax: true,
          },
        },
      },
      take: 100,
    });

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    const ent = entitlementErrorResponse(error);
    if (ent) return ent;
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    }
    return NextResponse.json({ ok: false, message: "Watchlist alınamadı." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const ctx = await requireCompanyFeature(user.id, "watchlist");
    const body = (await request.json()) as {
      action?: string;
      requestId?: string;
    };
    const requestId =
      typeof body.requestId === "string" ? body.requestId.trim() : "";
    // Owner is always the authenticated company workspace. Client owner ids are ignored.
    const companyId = ctx.companyId;

    if (body.action === "add" && requestId) {
      const item = await prisma.opportunityWatchlistItem.upsert({
        where: {
          companyId_requestId: {
            companyId,
            requestId,
          },
        },
        create: {
          companyId,
          requestId,
        },
        update: {},
      });
      return NextResponse.json({ ok: true, item });
    }

    if (body.action === "remove" && requestId) {
      await prisma.opportunityWatchlistItem.deleteMany({
        where: { companyId, requestId },
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
    return NextResponse.json({ ok: false, message: "Watchlist işlenemedi." }, { status: 500 });
  }
}
