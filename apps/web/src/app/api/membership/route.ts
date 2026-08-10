import { NextResponse } from "next/server";

import {
  COMPANY_CONTEXT_COOKIE,
  getCompanyContextOptions,
  PERSONAL_CONTEXT_VALUE,
} from "@/lib/membership/company-context";
import { OFFER_CREDIT_PACKS, PLAN_DEFINITIONS, planTierRank, type PlanTierId } from "@/lib/membership/plans";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import { toEntitlementDTO } from "@/lib/membership/serialize";
import { prisma } from "@/lib/prisma";
import { AuthenticationError, requireUser } from "@/server/auth/require-user";

function isMockUpgradeAllowed() {
  return process.env.ALLOW_MOCK_UPGRADE === "true";
}

export async function GET() {
  try {
    const user = await requireUser();
    const entitlements = await resolveEntitlements(
      user.id,
      await getCompanyContextOptions(),
    );

    let companies: { id: string; name: string }[] = [];
    try {
      const memberships = await prisma.companyMember.findMany({
        where: {
          userId: user.id,
          status: "ACTIVE",
          company: {
            deletedAt: null,
            status: { in: ["ACTIVE", "PENDING_VERIFICATION", "DRAFT"] },
          },
        },
        orderBy: { joinedAt: "desc" },
        select: {
          company: { select: { id: true, name: true } },
        },
      });
      companies = memberships.map((item) => ({
        id: item.company.id,
        name: item.company.name,
      }));
    } catch (error) {
      console.error("[membership] Firma listesi alınamadı:", error);
    }

    return NextResponse.json({
      ok: true,
      membershipNumber: user.membershipNumber ?? null,
      entitlements: toEntitlementDTO(entitlements),
      companies,
      membership: {
        userId: entitlements.userId,
        planTier: entitlements.effectivePlanTier,
        planLabel: entitlements.planLabel,
        monthlyOfferQuota: entitlements.quota.limit,
        bonusOfferCredits: entitlements.quota.bonusCredits,
        usedOffersThisMonth: entitlements.quota.used,
        remainingOffers: entitlements.quota.remaining,
        instantRequestAccess: entitlements.features.instant_request_access,
        requestAccessDelayHours: entitlements.requestAccessDelayHours,
        companyId:
          entitlements.subject.type === "company" ? entitlements.subject.id : null,
        companyName:
          entitlements.subject.type === "company"
            ? (entitlements.subject.name ?? null)
            : null,
        storedPlanTier: entitlements.storedPlanTier,
        isExpired: entitlements.isExpired,
        expiresAt: entitlements.expiresAt,
      },
      plans: Object.values(PLAN_DEFINITIONS),
      creditPacks: OFFER_CREDIT_PACKS,
      mockUpgradeEnabled: isMockUpgradeAllowed(),
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { ok: false, message: "Üyelik bilgisi alınamadı." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as {
      action?: string;
      planTier?: PlanTierId;
      pack?: keyof typeof OFFER_CREDIT_PACKS;
      companyId?: string | null;
    };

    if (body.action === "set-company-context") {
      const response = NextResponse.json({
        ok: true,
        message: body.companyId
          ? "Firma bağlamı güncellendi."
          : "Kişisel hesap bağlamına geçildi.",
      });

      if (body.companyId) {
        const membership = await prisma.companyMember.findFirst({
          where: {
            userId: user.id,
            companyId: body.companyId,
            status: "ACTIVE",
            company: {
              deletedAt: null,
              status: { in: ["ACTIVE", "PENDING_VERIFICATION", "DRAFT"] },
            },
          },
          select: { companyId: true },
        });

        if (!membership) {
          return NextResponse.json(
            { ok: false, message: "Bu firmaya erişiminiz yok." },
            { status: 403 },
          );
        }

        response.cookies.set(COMPANY_CONTEXT_COOKIE, body.companyId, {
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 180,
        });
      } else {
        // Explicit personal mode — do not fall back to company-first.
        response.cookies.set(COMPANY_CONTEXT_COOKIE, PERSONAL_CONTEXT_VALUE, {
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 180,
        });
      }

      return response;
    }

    if (body.action === "upgrade" && body.planTier) {
      if (!isMockUpgradeAllowed()) {
        return NextResponse.json(
          {
            ok: false,
            code: "MOCK_UPGRADE_DISABLED",
            message:
              "Plan yükseltme için ödeme entegrasyonu gerekli. Mock upgrade kapalı (ALLOW_MOCK_UPGRADE).",
          },
          { status: 402 },
        );
      }

      const tier = body.planTier;
      if (!PLAN_DEFINITIONS[tier]) {
        return NextResponse.json({ ok: false, message: "Geçersiz plan." }, { status: 400 });
      }

      const ctx = await resolveEntitlements(
        user.id,
        await getCompanyContextOptions(),
      );

      if (
        tier !== "STANDARD" &&
        planTierRank(tier) <= planTierRank(ctx.effectivePlanTier)
      ) {
        return NextResponse.json(
          {
            ok: false,
            message: "Yalnızca daha üst bir plana yükseltme yapılabilir.",
          },
          { status: 400 },
        );
      }

      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      if (ctx.subject.type === "company") {
        await prisma.company.update({
          where: { id: ctx.subject.id },
          data: {
            planTier: tier,
            planExpiresAt: tier === "STANDARD" ? null : expiresAt,
          },
        });
      } else {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            planTier: tier,
            planExpiresAt: tier === "STANDARD" ? null : expiresAt,
          },
        });
      }

      return NextResponse.json({
        ok: true,
        message: `${PLAN_DEFINITIONS[tier].label} planına geçildi (mock).`,
      });
    }

    if (body.action === "buy-credits" && body.pack) {
      const pack = OFFER_CREDIT_PACKS[body.pack];
      if (!pack) {
        return NextResponse.json({ ok: false, message: "Geçersiz paket." }, { status: 400 });
      }

      const ctx = await resolveEntitlements(
        user.id,
        await getCompanyContextOptions(),
      );

      if (ctx.subject.type === "company") {
        await prisma.company.update({
          where: { id: ctx.subject.id },
          data: { bonusOfferCredits: { increment: pack.credits } },
        });
      } else {
        await prisma.user.update({
          where: { id: user.id },
          data: { bonusOfferCredits: { increment: pack.credits } },
        });
      }

      return NextResponse.json({
        ok: true,
        message: `${pack.label} hesabınıza eklendi.`,
      });
    }

    return NextResponse.json({ ok: false, message: "Geçersiz işlem." }, { status: 400 });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    }

    console.error("Üyelik işlemi başarısız:", error);
    return NextResponse.json(
      { ok: false, message: "Üyelik işlemi tamamlanamadı." },
      { status: 500 },
    );
  }
}
