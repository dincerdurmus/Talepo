import { NextResponse } from "next/server";

import {
  assertCompanyMembership,
  getCompanyWorkspace,
} from "@/lib/panel/company-workspace";
import { prisma } from "@/lib/prisma";
import { AuthenticationError, requireUser } from "@/server/auth/require-user";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const workspace = await getCompanyWorkspace(user.id);

    if (!workspace?.features.hidden_inventory) {
      return NextResponse.json(
        { ok: false, message: "Bu işlem için yetkiniz yok." },
        { status: 403 },
      );
    }

    const membership = await assertCompanyMembership(user.id, workspace.companyId);
    if (!membership || membership.role === "VIEWER") {
      return NextResponse.json(
        { ok: false, message: "Envanter silme yetkiniz yok." },
        { status: 403 },
      );
    }

    const existing = await prisma.companyInventoryItem.findFirst({
      where: { id, companyId: workspace.companyId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, message: "Kayıt bulunamadı." },
        { status: 404 },
      );
    }

    await prisma.companyInventoryItem.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { ok: false, message: "Silinemedi." },
      { status: 500 },
    );
  }
}
