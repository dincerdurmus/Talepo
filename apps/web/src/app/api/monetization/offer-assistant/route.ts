import { NextResponse } from "next/server";

import { entitlementErrorResponse } from "@/lib/api/entitlement-response";
import { requireEntitledFeature } from "@/lib/membership/require-entitled-feature";
import { AuthenticationError, requireUser } from "@/server/auth/require-user";
import { runOfferAssistant } from "@/server/monetization/ai-offer-assistant";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    // Personal Professional may use the draft tool without a company workspace.
    // Canonical personal UI remains /api/ai/offer-assistant.
    await requireEntitledFeature(user.id, "ai_offer_assistant");

    const body = (await request.json()) as {
      requestTitle?: string;
      requestDescription?: string;
      categoryName?: string;
      existingDraft?: string;
    };

    if (!body.requestTitle?.trim()) {
      return NextResponse.json(
        { ok: false, message: "Talep başlığı gerekli." },
        { status: 400 },
      );
    }

    const result = await runOfferAssistant({
      requestTitle: body.requestTitle.trim(),
      requestDescription: body.requestDescription?.trim() ?? "",
      categoryName: body.categoryName,
      existingDraft: body.existingDraft,
    });

    return NextResponse.json({
      ok: result.ok,
      draft: result.draft,
      pricingHint: result.pricingHint,
      provider: result.provider,
      message: result.message,
    });
  } catch (error) {
    const ent = entitlementErrorResponse(error);
    if (ent) return ent;
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { ok: false, message: "Taslak üretilemedi." },
      { status: 500 },
    );
  }
}
