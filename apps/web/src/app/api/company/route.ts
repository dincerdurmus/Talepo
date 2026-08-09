import { NextResponse } from "next/server";

import { COMPANY_CONTEXT_COOKIE } from "@/lib/membership/company-context";
import {
  assertCompanyMembership,
  getCompanyWorkspace,
} from "@/lib/panel/company-workspace";
import {
  AuthenticationError,
  DatabaseUnavailableError,
  requireUser,
} from "@/server/auth/require-user";
import {
  CompanyValidationError,
  createCompanyForUser,
} from "@/server/company/create-company";
import {
  normalizeCategorySlugs,
  syncCompanyCategories,
} from "@/server/company/sync-company-categories";
import {
  CompanyUpdateError,
  updateCompanyProfile,
  type UpdateCompanyInput,
} from "@/server/company/update-company";

function clean(value: unknown, max = 200) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as {
      name?: string;
      city?: string;
      taxNumber?: string;
      description?: string;
      phone?: string;
      email?: string;
      categorySlugs?: string[];
    };

    const name = clean(body.name, 120);
    if (!name) {
      return NextResponse.json(
        { ok: false, message: "Firma adı zorunlu." },
        { status: 400 },
      );
    }

    const company = await createCompanyForUser({
      userId: user.id,
      name,
      city: clean(body.city, 80),
      taxNumber: clean(body.taxNumber, 32),
      description: clean(body.description, 2000),
      phone: clean(body.phone, 40),
      email: clean(body.email, 120) ?? user.email,
      categorySlugs: body.categorySlugs,
    });

    const response = NextResponse.json({
      ok: true,
      message: "Firma oluşturuldu.",
      company,
    });

    response.cookies.set(COMPANY_CONTEXT_COOKIE, company.id, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 180,
    });

    return response;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    }
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 503 });
    }
    if (error instanceof CompanyValidationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
    }

    console.error("[company] create failed", error);
    return NextResponse.json(
      { ok: false, message: "Firma oluşturulamadı." },
      { status: 500 },
    );
  }
}

/** Update active company profile and/or categories (OWNER/ADMIN). */
export async function PATCH(request: Request) {
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
    if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
      return NextResponse.json(
        { ok: false, message: "Firma ayarlarını güncellemek için yetkiniz yok." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as {
      categorySlugs?: string[];
      profile?: UpdateCompanyInput;
    };

    const hasCategories = Array.isArray(body.categorySlugs);
    const hasProfile = Boolean(body.profile && typeof body.profile === "object");

    if (!hasCategories && !hasProfile) {
      return NextResponse.json(
        { ok: false, message: "Güncellenecek alan yok." },
        { status: 400 },
      );
    }

    let categorySlugs: string[] | undefined;
    if (hasCategories) {
      categorySlugs = normalizeCategorySlugs(body.categorySlugs);
      await syncCompanyCategories(workspace.companyId, categorySlugs);
    }

    let company = null;
    if (hasProfile && body.profile) {
      company = await updateCompanyProfile(workspace.companyId, body.profile);
    }

    return NextResponse.json({
      ok: true,
      message: hasProfile
        ? "Firma profili güncellendi."
        : "Firma kategorileri güncellendi.",
      categorySlugs,
      company,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    }
    if (error instanceof CompanyUpdateError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
    }
    console.error("[company] patch failed", error);
    return NextResponse.json(
      { ok: false, message: "Firma güncellenemedi." },
      { status: 500 },
    );
  }
}
