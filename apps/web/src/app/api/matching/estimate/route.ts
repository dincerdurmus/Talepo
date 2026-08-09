import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/auth";
import { countMatchingCompanies } from "@/server/request/distribute-request";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const categorySlug = (searchParams.get("category") ?? "").trim();
    const city = (searchParams.get("city") ?? "").trim() || null;

    if (!categorySlug) {
      return NextResponse.json(
        { ok: false, message: "category gerekli." },
        { status: 400 },
      );
    }

    const session = await getServerSession(authOptions);
    const excludeUserId = session?.user?.id ?? null;

    const counts = await countMatchingCompanies({
      categorySlug,
      city,
      excludeUserId,
    });

    const expectedOfferCount = Math.max(
      0,
      Math.round(counts.estimatedCompanyCount * 0.45),
    );

    return NextResponse.json({
      ok: true,
      estimatedCompanyCount: counts.estimatedCompanyCount,
      expectedOfferCount,
      byCategory: counts.byCategory,
      byCity: counts.byCity,
      explanation:
        counts.estimatedCompanyCount > 0
          ? "Kayıtlı firma kategorileri ve şehir eşleşmesine göre canlı sayı."
          : "Bu kategori/şehir için henüz kayıtlı uygun firma yok. Firmalar kategori seçtikçe sayı artar.",
    });
  } catch (error) {
    console.error("[matching/estimate] failed", error);
    return NextResponse.json(
      {
        ok: false,
        estimatedCompanyCount: 0,
        expectedOfferCount: 0,
        message: "Eşleşme sayısı alınamadı.",
      },
      { status: 500 },
    );
  }
}
