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

    if (body.action === "add" && body.requestId) {
      const item = await prisma.opportunityWatchlistItem.upsert({
        where: {
          companyId_requestId: {
            companyId: ctx.companyId,
            requestId: body.requestId,
          },
        },
        create: {
          companyId: ctx.companyId,
          requestId: body.requestId,
        },
        update: {},
      });
      return NextResponse.json({ ok: true, item });
    }

    if (body.action === "remove" && body.requestId) {
      await prisma.opportunityWatchlistItem.deleteMany({
        where: { companyId: ctx.companyId, requestId: body.requestId },
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
