import { NextResponse } from "next/server";

import {
  assertCompanyMembership,
  getCompanyWorkspace,
} from "@/lib/panel/company-workspace";
import { prisma } from "@/lib/prisma";
import { AuthenticationError, requireUser } from "@/server/auth/require-user";

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

    if (!workspace.features.hidden_inventory) {
      return NextResponse.json(
        { ok: false, message: "Gizli envanter bu planda kapalı." },
        { status: 403 },
      );
    }

    const items = await prisma.companyInventoryItem.findMany({
      where: { companyId: workspace.companyId, isActive: true },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { ok: false, message: "Envanter alınamadı." },
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

    if (!workspace.features.hidden_inventory) {
      return NextResponse.json(
        { ok: false, message: "Gizli envanter bu planda kapalı." },
        { status: 403 },
      );
    }

    const membership = await assertCompanyMembership(user.id, workspace.companyId);
    if (!membership || ["VIEWER"].includes(membership.role)) {
      return NextResponse.json(
        { ok: false, message: "Envanter ekleme yetkiniz yok." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as {
      title?: string;
      categoryLabel?: string;
      quantity?: number;
      unit?: string;
      sku?: string;
      city?: string;
      notes?: string;
    };

    const title = body.title?.trim();
    if (!title) {
      return NextResponse.json(
        { ok: false, message: "Ürün adı zorunlu." },
        { status: 400 },
      );
    }

    const quantity = Number(body.quantity ?? 1);
    if (!Number.isFinite(quantity) || quantity < 1) {
      return NextResponse.json(
        { ok: false, message: "Geçerli bir adet girin." },
        { status: 400 },
      );
    }

    const item = await prisma.companyInventoryItem.create({
      data: {
        companyId: workspace.companyId,
        title,
        categoryLabel: body.categoryLabel?.trim() || null,
        quantity: Math.floor(quantity),
        unit: body.unit?.trim() || "adet",
        sku: body.sku?.trim() || null,
        city: body.city?.trim() || null,
        notes: body.notes?.trim() || null,
      },
    });

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    }
    console.error("[inventory] create failed", error);
    return NextResponse.json(
      { ok: false, message: "Envanter eklenemedi." },
      { status: 500 },
    );
  }
}
