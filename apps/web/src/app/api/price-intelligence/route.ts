import { NextResponse } from "next/server";

import { entitlementErrorResponse } from "@/lib/api/entitlement-response";
import { requireEntitledFeature } from "@/lib/membership/require-entitled-feature";
import { AuthenticationError, requireUser } from "@/server/auth/require-user";
import {
  getPriceIntelligence,
  getProductSignalDebug,
} from "@/server/price-intelligence/price-intelligence-engine";
import { normalizeProductFromRequest } from "@/server/price-intelligence/normalize-product";
import { prisma } from "@/lib/prisma";
import { toProPriceIntelligence } from "@/server/price-intelligence/pro-price-intelligence";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId");
    const debug = searchParams.get("debug") === "1";
    const includeExternal = searchParams.get("includeExternal") === "1";
    const advanced = searchParams.get("advanced") === "1";

    if (!categoryId) {
      return NextResponse.json(
        { ok: false, message: "categoryId gerekli." },
        { status: 400 },
      );
    }

    await requireEntitledFeature(user.id, advanced ? "advanced_ai_pricing" : "basic_market_insights");

    const productFingerprint = searchParams.get("productFingerprint");
    const city = searchParams.get("city");
    const district = searchParams.get("district");
    const condition = searchParams.get("condition");
    const windowDays = searchParams.get("windowDays")
      ? Number(searchParams.get("windowDays"))
      : undefined;

    if (debug && process.env.NODE_ENV === "development") {
      const signals = await getProductSignalDebug({
        categoryId,
        productFingerprint,
      });
      return NextResponse.json({ ok: true, debug: signals });
    }

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { slug: true },
    });

    let title: string | undefined;
    let fieldValues: { key: string; value: string | null }[] | undefined;

    const requestId = searchParams.get("requestId");
    if (requestId) {
      const req = await prisma.request.findUnique({
        where: { id: requestId },
        select: {
          title: true,
          fieldValues: {
            select: { textValue: true, field: { select: { key: true } } },
          },
        },
      });
      if (req) {
        title = req.title;
        fieldValues = req.fieldValues.map((fv) => ({
          key: fv.field.key,
          value: fv.textValue,
        }));
      }
    }

    const normalizedProduct =
      category && title
        ? normalizeProductFromRequest({
            categoryId,
            categorySlug: category.slug,
            title,
            fieldValues,
            city,
            district,
          })
        : undefined;

    const result = await getPriceIntelligence({
      categoryId,
      categorySlug: category?.slug,
      productFingerprint,
      city,
      district,
      condition,
      windowDays,
      includeExternal: includeExternal && Boolean(category?.slug && title),
      title,
      fieldValues,
      normalizedProduct,
    });

    return NextResponse.json({ ok: true, intelligence: advanced ? toProPriceIntelligence(result) : result });
  } catch (error) {
    const ent = entitlementErrorResponse(error);
    if (ent) return ent;
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    }
    console.error("[price-intelligence]", error);
    return NextResponse.json(
      { ok: false, message: "Fiyat analizi alınamadı." },
      { status: 500 },
    );
  }
}
