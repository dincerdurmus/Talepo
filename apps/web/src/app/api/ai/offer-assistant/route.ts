import { NextResponse } from "next/server";

import { listAssistantRequests } from "@/lib/ai/list-assistant-requests";
import {
  formatTry,
  generateOfferAssistantDraft,
} from "@/lib/ai/offer-assistant";
import { parseRequest } from "@/lib/ai/parser/parser";
import { estimatePrice } from "@/lib/ai/pricing/estimate";
import { displayRequestFieldValue } from "@/lib/field-display";
import {
  assertCanAccessRequest,
} from "@/lib/membership/assert-entitlement";
import { getCompanyContextOptions } from "@/lib/membership/company-context";
import { resolveEntitlements } from "@/lib/membership/resolve-entitlements";
import { EntitlementError } from "@/lib/membership/types";
import { prisma } from "@/lib/prisma";
import { AuthenticationError, requireUser } from "@/server/auth/require-user";

export async function GET() {
  try {
    const user = await requireUser();
    const entitlements = await resolveEntitlements(
      user.id,
      await getCompanyContextOptions(),
    );

    if (
      !entitlements.features.ai_offer_assistant &&
      !entitlements.features.advanced_ai_pricing
    ) {
      return NextResponse.json(
        { ok: false, message: "Bu özellik planınızda kapalı." },
        { status: 403 },
      );
    }

    const requests = await listAssistantRequests(user.id);

    return NextResponse.json({ ok: true, requests });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    }
    console.error("[ai/offer-assistant] GET failed", error);
    return NextResponse.json(
      { ok: false, message: "Talepler yüklenemedi." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const entitlements = await resolveEntitlements(
      user.id,
      await getCompanyContextOptions(),
    );

    const body = (await request.json()) as {
      requestId?: string;
      pastedText?: string;
      mode?: "draft" | "pricing";
    };

    const pricingOnly =
      body.mode === "pricing" || !entitlements.features.ai_offer_assistant;
    const draftAllowed = entitlements.features.ai_offer_assistant;
    const pricingAllowed = entitlements.features.advanced_ai_pricing;

    if (pricingOnly && !pricingAllowed) {
      return NextResponse.json(
        { ok: false, message: "Gelişmiş fiyat analizi planınızda kapalı." },
        { status: 403 },
      );
    }

    if (!pricingOnly && !draftAllowed) {
      return NextResponse.json(
        { ok: false, message: "AI teklif asistanı planınızda kapalı." },
        { status: 403 },
      );
    }

    if (body.requestId) {
      const dbRequest = await prisma.request.findFirst({
        where: {
          id: body.requestId,
          deletedAt: null,
          createdById: { not: user.id },
          status: { in: ["PUBLISHED", "RECEIVING_OFFERS", "OFFER_SELECTED", "IN_PROGRESS"] },
        },
        include: {
          category: { select: { name: true, slug: true } },
          fieldValues: {
            orderBy: { field: { sortOrder: "asc" } },
            include: { field: true },
          },
        },
      });

      if (!dbRequest) {
        return NextResponse.json(
          { ok: false, message: "Talep bulunamadı." },
          { status: 404 },
        );
      }

      assertCanAccessRequest(entitlements, dbRequest);

      const fieldSummaries = dbRequest.fieldValues
        .map((row) => {
          const value = displayRequestFieldValue({
            ...row,
            categoryId: dbRequest.category.slug,
          });
          if (!value || value === "—") return null;
          return `${row.field.label}: ${value}`;
        })
        .filter(Boolean) as string[];

      const quantityRow = dbRequest.fieldValues.find(
        (row) =>
          row.field.key === "quantity" ||
          row.field.key === "adet" ||
          row.field.label.toLowerCase().includes("adet"),
      );
      const quantity =
        quantityRow?.numberValue != null
          ? Number(quantityRow.numberValue)
          : undefined;

      const input = {
        title: dbRequest.title,
        description: dbRequest.professionalDescription ?? dbRequest.description,
        categorySlug: dbRequest.category.slug,
        categoryName: dbRequest.category.name,
        city: dbRequest.city,
        quantity: quantity ?? undefined,
        budgetMin: dbRequest.budgetMin ? Number(dbRequest.budgetMin) : null,
        budgetMax: dbRequest.budgetMax ? Number(dbRequest.budgetMax) : null,
        isUrgent: dbRequest.isUrgent,
        fieldSummaries,
      };

      const draft = generateOfferAssistantDraft(input);

      return NextResponse.json({
        ok: true,
        requestId: dbRequest.id,
        requestTitle: dbRequest.title,
        draft: pricingOnly
          ? {
              priceMin: draft.priceMin,
              priceMax: draft.priceMax,
              suggestedAmount: draft.suggestedAmount,
              confidence: draft.confidence,
              pricingExplanation: draft.pricingExplanation,
              priceLabel: `${formatTry(draft.priceMin)} – ${formatTry(draft.priceMax)}`,
            }
          : draft,
      });
    }

    const pasted = body.pastedText?.trim();
    if (!pasted) {
      return NextResponse.json(
        { ok: false, message: "Talep seçin veya metin yapıştırın." },
        { status: 400 },
      );
    }

    const parsed = parseRequest(pasted);
    const pricing = estimatePrice(parsed);

    if (pricingOnly) {
      return NextResponse.json({
        ok: true,
        draft: {
          priceMin: pricing.min,
          priceMax: pricing.max,
          suggestedAmount: Math.round((pricing.min + pricing.max) / 2),
          confidence: pricing.confidence,
          pricingExplanation: pricing.explanation,
          priceLabel: `${formatTry(pricing.min)} – ${formatTry(pricing.max)}`,
          categoryId: parsed.categoryId,
          city: parsed.city ?? null,
        },
      });
    }

    const draft = generateOfferAssistantDraft({
      title: pasted.split("\n")[0]?.slice(0, 120) || "Talep özeti",
      description: pasted,
      categorySlug: parsed.categoryId,
      categoryName: parsed.categoryId,
      city: parsed.city,
      quantity: parsed.quantity,
      budgetMax: parsed.budget ?? null,
      isUrgent: false,
    });

    return NextResponse.json({ ok: true, draft });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    }
    if (error instanceof EntitlementError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: error.status },
      );
    }

    console.error("[ai/offer-assistant] POST failed", error);
    return NextResponse.json(
      { ok: false, message: "Taslak oluşturulamadı." },
      { status: 500 },
    );
  }
}
