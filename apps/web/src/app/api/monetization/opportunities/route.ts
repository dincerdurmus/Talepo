import { NextResponse } from "next/server";

import { entitlementErrorResponse } from "@/lib/api/entitlement-response";
import { requireCompanyFeature } from "@/lib/membership/require-company-feature";
import { prisma } from "@/lib/prisma";
import { AuthenticationError, requireUser } from "@/server/auth/require-user";
import { canAssignOpportunities } from "@/server/monetization/opportunity-assignment";
import { assignOpportunity } from "@/server/monetization/opportunity-hunter";
import { scoreOpportunity } from "@/server/monetization/opportunity-score";
import { getCompetitionSignals } from "@/server/monetization/competition-signals";
import { evaluateBudgetOpportunity } from "@/server/monetization/budget-opportunity";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const ctx = await requireCompanyFeature(user.id, "hot_opportunities");
    const { searchParams } = new URL(request.url);
    const requestId = searchParams.get("requestId");

    if (requestId) {
      const req = await prisma.request.findUnique({
        where: { id: requestId },
        select: {
          id: true,
          aiScore: true,
          isUrgent: true,
          budgetMin: true,
          budgetMax: true,
          offerCount: true,
          viewCount: true,
          publishedAt: true,
          createdAt: true,
        },
      });
      if (!req) {
        return NextResponse.json({ ok: false, message: "Talep bulunamadı." }, { status: 404 });
      }

      const score = await scoreOpportunity({
        request: {
          id: req.id,
          aiScore: req.aiScore,
          isUrgent: req.isUrgent,
          budgetMin: req.budgetMin?.toNumber() ?? null,
          budgetMax: req.budgetMax?.toNumber() ?? null,
          offerCount: req.offerCount,
          viewCount: req.viewCount,
          publishedAt: req.publishedAt,
          createdAt: req.createdAt,
        },
        companyId: ctx.companyId,
      });

      const competition = getCompetitionSignals({
        offerCount: req.offerCount,
        viewCount: req.viewCount,
      });

      const budget = evaluateBudgetOpportunity({
        budgetMin: req.budgetMin?.toNumber() ?? null,
        budgetMax: req.budgetMax?.toNumber() ?? null,
      });

      return NextResponse.json({ ok: true, score, competition, budget });
    }

    const matches = await prisma.opportunityMatch.findMany({
      where: { companyId: ctx.companyId },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: 50,
      include: {
        request: {
          select: {
            id: true,
            title: true,
            city: true,
            isUrgent: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({ ok: true, matches });
  } catch (error) {
    const ent = entitlementErrorResponse(error);
    if (ent) return ent;
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    }
    return NextResponse.json({ ok: false, message: "Fırsatlar alınamadı." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const ctx = await requireCompanyFeature(user.id, "lead_distribution");
    const body = (await request.json()) as {
      action?: string;
      opportunityId?: string;
      memberId?: string | null;
      status?: "VIEWED" | "DISMISSED" | "CONTACTED";
    };

    if (
      (body.action === "assign" || body.action === "unassign") &&
      body.opportunityId
    ) {
      if (!canAssignOpportunities(ctx.role)) {
        return NextResponse.json(
          {
            ok: false,
            message: "Atama için OWNER, ADMIN veya MANAGER rolü gerekir.",
          },
          { status: 403 },
        );
      }
      const memberId =
        body.action === "unassign" ? null : (body.memberId ?? null);
      if (body.action === "assign" && !memberId) {
        return NextResponse.json(
          { ok: false, message: "Üye seçilmedi." },
          { status: 400 },
        );
      }
      try {
        const result = await assignOpportunity(
          body.opportunityId,
          memberId,
          ctx.companyId,
        );
        return NextResponse.json({ ok: true, updated: result.count });
      } catch (e) {
        return NextResponse.json(
          {
            ok: false,
            message: e instanceof Error ? e.message : "Atama başarısız.",
          },
          { status: 400 },
        );
      }
    }

    if (body.action === "status" && body.opportunityId && body.status) {
      const result = await prisma.opportunityMatch.updateMany({
        where: { id: body.opportunityId, companyId: ctx.companyId },
        data: { status: body.status },
      });
      return NextResponse.json({ ok: true, updated: result.count });
    }

    return NextResponse.json({ ok: false, message: "Geçersiz işlem." }, { status: 400 });
  } catch (error) {
    const ent = entitlementErrorResponse(error);
    if (ent) return ent;
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    }
    return NextResponse.json({ ok: false, message: "İşlem başarısız." }, { status: 500 });
  }
}
