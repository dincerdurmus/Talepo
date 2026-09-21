import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/auth";
import { outOfScopeNoticeFor } from "@/lib/request-composer/v2/publish-readiness";
import { isUnsupportedRequestScope } from "@/lib/request-understanding/types";
import { understandRequest } from "@/lib/request-understanding/understand-request";
import { toMatchingEstimateInput } from "@/lib/request-understanding/consumer-adapters";
import { countMatchingCompanies } from "@/server/request/distribute-request";

/**
 * Matching estimate — category derived from canonical understanding when rawInput given.
 * Query params:
 * - rawInput (preferred) + optional city / categoryLocked
 * - legacy: category + city (compatibility; treated as structured override only if categoryLocked=1)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawInput = (searchParams.get("rawInput") ?? "").trim();
    const cityParam = (searchParams.get("city") ?? "").trim() || null;
    const legacyCategory = (searchParams.get("category") ?? "").trim();
    const categoryLocked = searchParams.get("categoryLocked") === "1";

    const session = await getServerSession(authOptions);
    const excludeUserId = session?.user?.id ?? null;

    let categorySlug: string | null = null;
    let matchingStatus: "READY" | "INSUFFICIENT_UNDERSTANDING" = "READY";
    let reasons: string[] = [];
    let strategy: string | null = null;
    let intent: string | null = null;

    if (rawInput) {
      const understanding = understandRequest({
        rawInput,
        structured: {
          categoryId: categoryLocked && legacyCategory ? legacyCategory : null,
          city: cityParam,
        },
      });
      /**
       * KAPSAM KAPISI — ARAMA/İLERLETME YÜZEYİ (2026-09-21).
       *
       * Kurucunun cümlesi "ilaç arayan kişi bunu arayamamalı ve site
       * ilerletmemeli" yalnız yayın kapısını değil, kullanıcıya "kaç firma
       * bulunur" diyen bu yüzeyi de kapsar: bir sayı göstermek talebi
       * ilerletmektir.
       *
       * Bugün ilaç metni tesadüfen duruyordu (kategori çözülemediği için
       * `INSUFFICIENT_UNDERSTANDING`). TESADÜF KAPI DEĞİLDİR: istemci
       * `categoryLocked=1` ile kategori dayatabildiği için kapsam kararı
       * burada AÇIKÇA okunur ve kapsam dışı metin hiçbir sayı üretmez.
       * Durum kendi adını taşır — "anlaşılmadı" demek yanlış olurdu, metin
       * gayet iyi anlaşıldı; kapsam dışı olduğu için durduruldu.
       */
      if (isUnsupportedRequestScope(understanding.requestScope.value)) {
        return NextResponse.json({
          ok: true,
          estimatedCompanyCount: 0,
          expectedOfferCount: 0,
          byCategory: 0,
          byCity: 0,
          status: "OUT_OF_SCOPE",
          requestScope: understanding.requestScope.value,
          reasons: ["request scope is outside Talepo"],
          strategy: null,
          intent: null,
          categorySlug: null,
          explanation: outOfScopeNoticeFor(understanding.requestScope.value),
          canonicalUnderstandingVersion: understanding.version,
        });
      }

      const matchingInput = toMatchingEstimateInput(understanding, {
        cityOverride: cityParam,
        categoryLocked: categoryLocked && Boolean(legacyCategory),
      });
      categorySlug = matchingInput.categorySlug;
      matchingStatus = matchingInput.status;
      reasons = matchingInput.reasons;
      strategy = matchingInput.strategy;
      intent = matchingInput.intent;

      if (matchingStatus === "INSUFFICIENT_UNDERSTANDING" || !categorySlug) {
        return NextResponse.json({
          ok: true,
          estimatedCompanyCount: 0,
          expectedOfferCount: 0,
          byCategory: 0,
          byCity: 0,
          status: "INSUFFICIENT_UNDERSTANDING",
          reasons,
          strategy,
          intent,
          categorySlug: null,
          explanation:
            "Talep anlamı henüz eşleşme için yeterli değil. Kategori netleşince sayı güncellenir.",
          canonicalUnderstandingVersion: understanding.version,
        });
      }
    } else if (legacyCategory) {
      // Legacy callers without rawInput — category treated as opaque filter key only
      categorySlug = legacyCategory;
      reasons = ["legacy category param (no rawInput)"];
    } else {
      return NextResponse.json(
        { ok: false, message: "rawInput veya category gerekli." },
        { status: 400 },
      );
    }

    const counts = await countMatchingCompanies({
      categorySlug,
      city: cityParam,
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
      status: matchingStatus,
      reasons,
      strategy,
      intent,
      categorySlug,
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
