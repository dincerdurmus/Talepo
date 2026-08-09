import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AuthenticationError, requireUser } from "@/server/auth/require-user";

function clean(value: unknown, max = 200) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export async function PATCH(request: Request) {
  try {
    const sessionUser = await requireUser();
    const body = (await request.json()) as {
      name?: string;
      phone?: string;
      city?: string;
      district?: string;
      country?: string;
      biography?: string;
    };

    const name = clean(body.name, 120);
    if (!name) {
      return NextResponse.json(
        { ok: false, message: "Ad soyad zorunlu." },
        { status: 400 },
      );
    }

    const phone = clean(body.phone, 40);
    const city = clean(body.city, 80);
    const district = clean(body.district, 80);
    const country = clean(body.country, 80) ?? "Türkiye";
    const biography = clean(body.biography, 1000);

    const user = await prisma.user.update({
      where: { id: sessionUser.id },
      data: {
        name,
        phone,
        city,
        district,
        country,
        biography,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        city: true,
        district: true,
        country: true,
        biography: true,
        image: true,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Profil güncellendi.",
      user,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    }

    console.error("[profile] update failed", error);
    return NextResponse.json(
      { ok: false, message: "Profil güncellenemedi." },
      { status: 500 },
    );
  }
}
