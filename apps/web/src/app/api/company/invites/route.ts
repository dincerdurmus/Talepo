import { NextResponse } from "next/server";

import { COMPANY_CONTEXT_COOKIE } from "@/lib/membership/company-context";
import { prisma } from "@/lib/prisma";
import {
  AuthenticationError,
  DatabaseUnavailableError,
  requireUser,
} from "@/server/auth/require-user";
import {
  acceptCompanyInvite,
  InviteError,
  rejectCompanyInvite,
} from "@/server/company/respond-invite";

/** List pending invites for the current user. */
export async function GET() {
  try {
    const user = await requireUser();

    const invites = await prisma.companyMember.findMany({
      where: {
        userId: user.id,
        status: "INVITED",
        company: {
          deletedAt: null,
          status: { in: ["ACTIVE", "PENDING_VERIFICATION", "DRAFT"] },
        },
      },
      orderBy: { invitedAt: "desc" },
      select: {
        id: true,
        role: true,
        invitedAt: true,
        company: {
          select: { id: true, name: true, city: true },
        },
      },
    });

    return NextResponse.json({ ok: true, invites });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    }
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 503 });
    }
    return NextResponse.json(
      { ok: false, message: "Davetler alınamadı." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as {
      action?: "accept" | "reject";
      companyId?: string;
    };

    const companyId = body.companyId?.trim();
    if (!companyId) {
      return NextResponse.json(
        { ok: false, message: "companyId zorunlu." },
        { status: 400 },
      );
    }

    if (body.action === "accept") {
      const result = await acceptCompanyInvite(user.id, companyId);
      const response = NextResponse.json({
        ok: true,
        message: result.alreadyActive
          ? "Zaten ekip üyesisiniz."
          : "Davet kabul edildi.",
        company: result.membership.company,
      });

      response.cookies.set(COMPANY_CONTEXT_COOKIE, companyId, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 180,
      });

      return response;
    }

    if (body.action === "reject") {
      const result = await rejectCompanyInvite(user.id, companyId);
      return NextResponse.json({
        ok: true,
        message: result.alreadyRejected
          ? "Davet zaten reddedilmiş."
          : "Davet reddedildi.",
      });
    }

    return NextResponse.json(
      { ok: false, message: "Geçersiz işlem. action: accept | reject" },
      { status: 400 },
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    }
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 503 });
    }
    if (error instanceof InviteError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: error.status },
      );
    }

    console.error("[company/invites] failed", error);
    return NextResponse.json(
      { ok: false, message: "Davet işlemi tamamlanamadı." },
      { status: 500 },
    );
  }
}
