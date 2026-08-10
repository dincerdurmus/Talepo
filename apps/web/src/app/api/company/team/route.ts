import { NextResponse } from "next/server";

import {
  assertCompanyMembership,
  getCompanyWorkspace,
} from "@/lib/panel/company-workspace";
import {
  isMembershipNumberInput,
  normalizeMembershipNumberInput,
} from "@/lib/auth/membership-number";
import { prisma } from "@/lib/prisma";
import { AuthenticationError, requireUser } from "@/server/auth/require-user";

const MANAGER_ROLES = new Set(["OWNER", "ADMIN", "MANAGER"]);
const REMOVE_ROLES = new Set(["OWNER", "ADMIN"]);
const OFFER_VIEW_ROLES = new Set(["OWNER", "ADMIN"]);

export async function GET() {
  try {
    const user = await requireUser();
    const workspace = await getCompanyWorkspace(user.id);

    if (!workspace) {
      return NextResponse.json(
        { ok: false, message: "Firma bağlamı seçili değil." },
        { status: 400 },
      );
    }

    const membership = await assertCompanyMembership(user.id, workspace.companyId);
    const canViewOffers =
      !!membership && OFFER_VIEW_ROLES.has(membership.role);

    const members = await prisma.companyMember.findMany({
      where: {
        companyId: workspace.companyId,
        status: { in: ["ACTIVE", "INVITED"] },
      },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true, membershipNumber: true },
        },
      },
    });

    const offersByUserId: Record<
      string,
      Array<{
        id: string;
        title: string | null;
        amount: string;
        currency: string;
        status: string;
        submittedAt: Date | null;
        request: { id: string; title: string; city: string | null };
      }>
    > = {};

    if (canViewOffers) {
      const offers = await prisma.offer.findMany({
        where: {
          companyId: workspace.companyId,
          status: { not: "DRAFT" },
          submittedById: { in: members.map((m) => m.userId) },
        },
        orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
        take: 200,
        select: {
          id: true,
          title: true,
          amount: true,
          currency: true,
          status: true,
          submittedAt: true,
          submittedById: true,
          request: {
            select: { id: true, title: true, city: true },
          },
        },
      });

      for (const offer of offers) {
        const list = offersByUserId[offer.submittedById] ?? [];
        list.push({
          id: offer.id,
          title: offer.title,
          amount: offer.amount.toString(),
          currency: offer.currency,
          status: offer.status,
          submittedAt: offer.submittedAt,
          request: offer.request,
        });
        offersByUserId[offer.submittedById] = list;
      }
    }

    return NextResponse.json({
      ok: true,
      companyName: workspace.companyName,
      members,
      canRemove: !!membership && REMOVE_ROLES.has(membership.role),
      canViewOffers,
      offersByUserId: canViewOffers ? offersByUserId : undefined,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { ok: false, message: "Ekip listesi alınamadı." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const workspace = await getCompanyWorkspace(user.id);

    if (!workspace) {
      return NextResponse.json(
        { ok: false, message: "Firma bağlamı seçili değil." },
        { status: 400 },
      );
    }

    const membership = await assertCompanyMembership(user.id, workspace.companyId);
    if (!membership || !MANAGER_ROLES.has(membership.role)) {
      return NextResponse.json(
        { ok: false, message: "Davet gönderme yetkiniz yok." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as {
      email?: string;
      invite?: string;
      membershipNumber?: string;
      role?: "ADMIN" | "MANAGER" | "MEMBER" | "VIEWER";
    };

    const rawInvite =
      body.invite?.trim() ||
      body.membershipNumber?.trim() ||
      body.email?.trim();

    if (!rawInvite) {
      return NextResponse.json(
        { ok: false, message: "E-posta veya üyelik numarası zorunlu." },
        { status: 400 },
      );
    }

    const role = body.role ?? "MEMBER";

    let invitee: {
      id: string;
      name: string | null;
      email: string | null;
    } | null = null;

    if (isMembershipNumberInput(rawInvite)) {
      const membershipNumber = normalizeMembershipNumberInput(rawInvite)!;
      invitee = await prisma.user.findUnique({
        where: { membershipNumber },
        select: { id: true, name: true, email: true },
      });

      if (!invitee) {
        return NextResponse.json(
          {
            ok: false,
            message: "Bu üyelik numarası ile kayıtlı kullanıcı bulunamadı.",
          },
          { status: 404 },
        );
      }
    } else {
      const email = rawInvite.toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json(
          {
            ok: false,
            message: "Geçerli bir e-posta veya üyelik numarası girin.",
          },
          { status: 400 },
        );
      }

      invitee = await prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { id: true, name: true, email: true },
      });

      if (!invitee) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "Bu e-posta ile kayıtlı kullanıcı yok. Önce Talepo’ya kayıt olmalı.",
          },
          { status: 404 },
        );
      }
    }

    if (invitee.id === user.id) {
      return NextResponse.json(
        { ok: false, message: "Kendinizi davet edemezsiniz." },
        { status: 400 },
      );
    }

    const existing = await prisma.companyMember.findUnique({
      where: {
        companyId_userId: {
          companyId: workspace.companyId,
          userId: invitee.id,
        },
      },
    });

    if (existing?.status === "ACTIVE") {
      return NextResponse.json(
        { ok: false, message: "Bu kullanıcı zaten ekipte." },
        { status: 409 },
      );
    }

    const wasPendingInvite = existing?.status === "INVITED";

    const member = existing
      ? await prisma.companyMember.update({
          where: { id: existing.id },
          data: {
            status: "INVITED",
            role,
            invitedAt: new Date(),
            removedAt: null,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
                membershipNumber: true,
              },
            },
          },
        })
      : await prisma.companyMember.create({
          data: {
            companyId: workspace.companyId,
            userId: invitee.id,
            role,
            status: "INVITED",
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
                membershipNumber: true,
              },
            },
          },
        });

    await prisma.notification.create({
      data: {
        userId: invitee.id,
        type: "COMPANY_INVITATION",
        title: "Firma daveti",
        message: `${workspace.companyName} sizi ekibe davet etti.`,
        actionUrl: "/panel/bildirimler",
        companyId: workspace.companyId,
      },
    });

    const inviteeLabel =
      invitee.name?.trim() || invitee.email?.trim() || "Kullanıcı";

    return NextResponse.json({
      ok: true,
      member,
      message: wasPendingInvite
        ? `${inviteeLabel} için davet yenilendi.`
        : `${inviteeLabel} davet edildi.`,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    }
    console.error("[team] invite failed", error);
    return NextResponse.json(
      { ok: false, message: "Davet gönderilemedi." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    const workspace = await getCompanyWorkspace(user.id);

    if (!workspace) {
      return NextResponse.json(
        { ok: false, message: "Firma bağlamı seçili değil." },
        { status: 400 },
      );
    }

    const membership = await assertCompanyMembership(user.id, workspace.companyId);
    if (!membership || !REMOVE_ROLES.has(membership.role)) {
      return NextResponse.json(
        { ok: false, message: "Üye çıkarma yetkiniz yok." },
        { status: 403 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      memberId?: string;
    };
    const url = new URL(request.url);
    const memberId = body.memberId?.trim() || url.searchParams.get("memberId");

    if (!memberId) {
      return NextResponse.json(
        { ok: false, message: "Üye kimliği zorunlu." },
        { status: 400 },
      );
    }

    const target = await prisma.companyMember.findFirst({
      where: {
        id: memberId,
        companyId: workspace.companyId,
        status: { in: ["ACTIVE", "INVITED"] },
      },
      select: {
        id: true,
        userId: true,
        role: true,
        status: true,
        user: { select: { name: true, email: true } },
      },
    });

    if (!target) {
      return NextResponse.json(
        { ok: false, message: "Üye bulunamadı." },
        { status: 404 },
      );
    }

    if (target.userId === user.id) {
      return NextResponse.json(
        { ok: false, message: "Kendinizi ekipten çıkaramazsınız." },
        { status: 400 },
      );
    }

    if (target.role === "OWNER" && membership.role !== "OWNER") {
      return NextResponse.json(
        { ok: false, message: "Sahibi yalnızca başka bir sahip çıkarabilir." },
        { status: 403 },
      );
    }

    if (target.role === "OWNER" && target.status === "ACTIVE") {
      const ownerCount = await prisma.companyMember.count({
        where: {
          companyId: workspace.companyId,
          role: "OWNER",
          status: "ACTIVE",
        },
      });
      if (ownerCount <= 1) {
        return NextResponse.json(
          { ok: false, message: "Son sahip ekipten çıkarılamaz." },
          { status: 400 },
        );
      }
    }

    await prisma.companyMember.update({
      where: { id: target.id },
      data: {
        status: "REMOVED",
        removedAt: new Date(),
      },
    });

    const label = target.user.name ?? target.user.email ?? "Üye";
    return NextResponse.json({
      ok: true,
      message: `${label} ekipten çıkarıldı.`,
      memberId: target.id,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    }
    console.error("[team] remove failed", error);
    return NextResponse.json(
      { ok: false, message: "Üye çıkarılamadı." },
      { status: 500 },
    );
  }
}
