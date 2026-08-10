import { NextResponse } from "next/server";

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
    console.error("[price-intelligence/preview]", error);
    return NextResponse.json(
      { ok: false, message: "Piyasa analizi şu anda kullanılamıyor." },
      { status: 500 },
    );
  }
}
