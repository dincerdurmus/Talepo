import { NextResponse } from "next/server";

import { safeErrorResponse } from "@/lib/observability/errors";
import {
  assertRateLimit,
  clientKeyFromRequest,
} from "@/lib/observability/rate-limit";
import { outOfScopeNoticeFor } from "@/lib/request-composer/v2/publish-readiness";
import { isUnsupportedRequestScope } from "@/lib/request-understanding/types";
import { understandRequest } from "@/lib/request-understanding/understand-request";
import { AuthenticationError, requireUser } from "@/server/auth/require-user";
import { runPriceIntelligencePreview } from "@/server/price-intelligence/run-price-intelligence-preview";

type PreviewBody = {
  categorySlug?: string;
  title?: string;
  fieldValues?: { key: string; value: string | null }[] | Record<string, string>;
  budget?: number | string | null;
  city?: string | null;
  district?: string | null;
  includeExternal?: boolean;
  windowDays?: number;
  rawInput?: string | null;
  canonicalUnderstandingVersion?: string;
  structuredOverrides?: {
    categoryId?: string | null;
    city?: string | null;
    district?: string | null;
    fieldValues?: Record<string, string | null | undefined>;
  };
};

function normalizeBodyFieldValues(
  raw: PreviewBody["fieldValues"],
): { key: string; value: string | null }[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return Object.entries(raw).map(([key, value]) => ({ key, value: value ?? null }));
}

export async function POST(request: Request) {
  try {
    assertRateLimit({
      key: clientKeyFromRequest(request, "price.preview"),
      limit: 30,
      windowMs: 60_000,
    });

    // Optional auth — buyers may preview before publish login redirect
    try {
      await requireUser();
    } catch {
      // continue without session
    }

    const body = (await request.json()) as PreviewBody;
    const title = body.title?.trim();
    const rawInput = body.rawInput?.trim() || title;

    if (!title || title.length < 3) {
      return NextResponse.json(
        { ok: false, message: "title en az 3 karakter olmalı." },
        { status: 400 },
      );
    }

    /**
     * KAPSAM KAPISI — FİYAT/İLERLETME YÜZEYİ (2026-09-21).
     *
     * Piyasa analizi de bir ilerletmedir: "ağrı kesici" için bir fiyat aralığı
     * göstermek, talebin Talepo'da yürüdüğünü söylemektir. Kapı API sınırında
     * durur, yani analiz motoru ve dış sağlayıcı HİÇ ÇAĞRILMAZ — engelleme
     * yapısaldır, sonucun filtrelenmesi değildir.
     *
     * Kapsam kararı istemciden gelen bir bayraktan değil, kullanıcının kendi
     * metninden burada yeniden türetilir; `structuredOverrides.categoryId` ile
     * kategori dayatmak kapıyı açmaz.
     */
    const scope = understandRequest({
      rawInput: rawInput ?? title,
    }).requestScope;
    if (isUnsupportedRequestScope(scope.value)) {
      return NextResponse.json(
        {
          ok: false,
          outOfScope: true,
          requestScope: scope.value,
          message: outOfScopeNoticeFor(scope.value),
        },
        { status: 422 },
      );
    }

    // categorySlug no longer required — canonical brain resolves category
    const intelligence = await runPriceIntelligencePreview({
      categorySlug: body.categorySlug,
      title,
      rawInput,
      fieldValues: normalizeBodyFieldValues(body.fieldValues),
      budget: body.budget,
      city: body.city,
      district: body.district,
      includeExternal: body.includeExternal ?? true,
      windowDays: body.windowDays,
      structuredOverrides: body.structuredOverrides ?? {
        categoryId: null,
        city: body.city,
        district: body.district,
        fieldValues: Object.fromEntries(
          normalizeBodyFieldValues(body.fieldValues).map((f) => [f.key, f.value]),
        ),
      },
    });

    return NextResponse.json({ ok: true, intelligence });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    }
    return safeErrorResponse(error, {
      service: "price_intelligence",
      event: "provider.price.failed",
    });
  }
}
